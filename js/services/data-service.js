/**
 * Serviço de Dados - Lógica de negócio para rankings e análises
 *
 * ✅ AJUSTADO para o mapa por ALIMENTADOR via KML (linhas):
 * - mantém sufixo (ex: QXD01P3)
 * - cria "base" (ex: QXD01) para fallback quando a planilha não traz sufixo
 * - expõe helpers para o mapa.js pintar linhas por intensidade (0..50)
 */

/* =========================
   HELPERS GERAIS
========================= */

function normKey(v) {
  return String(v ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^\w\s]/g, ' ')        // pontuação vira espaço
    .replace(/_/g, ' ')              // underscore vira espaço
    .replace(/\s+/g, ' ')            // colapsa espaços
    .trim();
}

// Key “dura” (sem espaços/pontuação) p/ casar alimentadores do KML
export function normalizeAlimKey(v) {
  return String(v ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]/g, '') // remove tudo que não é letra/número/_
    .replace(/_/g, '')
    .trim();
}

// base do alimentador (ex: QXD01) a partir de QXD01P3 / QXD01 / "QXD 01"
export function baseFromAlimKey(v) {
  const k = normalizeAlimKey(v);

  // tenta achar: letras (2-4) + 2 dígitos (QXD01, ARR01, IPU01 etc)
  const m = k.match(/^([A-Z]{2,4}\d{2})/);
  return m ? m[1] : k;
}

function getAlimentadorRaw(item) {
  return (
    item.ALIMENT ||
    item.ALIMENTADOR ||
    item.ALIMEN ||
    item.ALIM ||
    item['ALIMENT.'] ||
    item['ALIMEN.'] ||
    ''
  );
}

/* =========================
   RANKING POR ELEMENTO
========================= */
export function generateRankingElemento(data) {
  const elementos = {};

  data.forEach(item => {
    const elemento = item.ELEMENTO || item.ELEMENTOS || '';
    if (!elemento) return;

    if (!elementos[elemento]) elementos[elemento] = [];
    elementos[elemento].push(item);
  });

  return Object.entries(elementos)
    .filter(([_, ocorrencias]) => ocorrencias.length > 1)
    .map(([elemento, ocorrencias]) => ({
      elemento,
      count: ocorrencias.length,
      ocorrencias
    }))
    .sort((a, b) => b.count - a.count);
}

/* =========================
   CONTAGEM POR ALIMENTADOR (para KML)
========================= */
/**
 * Retorna Map<alimKeyNormalizada, count>
 *
 * mode:
 *  - "TOTAL": total de ocorrências no alimentador
 *  - "REITERADAS": soma apenas incidências repetidas (>=2) dentro do alimentador
 */
export function countByAlimentador(data, mode = 'TOTAL') {
  const by = new Map(); // alimKey -> array items

  for (const item of data) {
    const raw = getAlimentadorRaw(item);
    const key = normalizeAlimKey(raw);
    if (!key) continue;

    if (!by.has(key)) by.set(key, []);
    by.get(key).push(item);
  }

  const counts = new Map();

  for (const [alimKey, items] of by.entries()) {
    if (mode === 'TOTAL') {
      counts.set(alimKey, items.length);
      continue;
    }

    // REITERADAS: incidência repetida dentro do alimentador
    const incid = new Map();
    for (const it of items) {
      const id = String(it.INCIDENCIA ?? '').trim();
      if (!id) continue;
      incid.set(id, (incid.get(id) || 0) + 1);
    }

    let total = 0;
    for (const c of incid.values()) {
      if (c >= 2) total += c;
    }
    counts.set(alimKey, total);
  }

  return counts;
}

/**
 * Faz o "match" das contagens da planilha com as chaves do KML
 *
 * kmlSegmentKeys: ex: ["QXD01P3","QXD01P4","ARR01L1"...]
 *
 * strategy:
 *  - "EXACT": casa QXD01P3 com QXD01P3
 *  - "BASE": casa por base QXD01 e aplica pros segmentos desse alimentador
 */
export function mapCountsToKmlSegments(countsPlanilha, kmlSegmentKeys, strategy = 'BASE') {
  const out = new Map(); // kmlKeyOriginal -> count

  // índice normalizado (planilha)
  const idx = new Map();
  for (const [k, v] of countsPlanilha.entries()) {
    idx.set(normalizeAlimKey(k), Number(v || 0));
  }

  for (const segKeyRaw of kmlSegmentKeys) {
    const segKeyNorm = normalizeAlimKey(segKeyRaw);
    let val = 0;

    if (strategy === 'EXACT') {
      val = idx.get(segKeyNorm) || 0;
    } else {
      // BASE
      const base = baseFromAlimKey(segKeyNorm);
      val = idx.get(base) || 0;

      // fallback extra: se por acaso a planilha tiver o sufixo e o base não achar
      if (!val) val = idx.get(segKeyNorm) || 0;
    }

    out.set(segKeyRaw, val);
  }

  return out;
}

/* =========================
   INTENSIDADE / COR (0..50)
========================= */
export function intensity01(count, maxTarget = 50) {
  const c = Number(count || 0);
  if (c <= 0) return 0;
  return Math.min(1, c / maxTarget);
}

// 0 => #ffcccc (claro) | 1 => #ff0000 (escuro)
export function colorFromIntensity01(t) {
  const clamp = (x) => Math.max(0, Math.min(255, x));
  const r = 255;
  const g = clamp(Math.round(204 - 204 * t));
  const b = clamp(Math.round(204 - 204 * t));

  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/* =========================
   HEATMAP POR CONJUNTO (CIDADES) - mantém seu atual
========================= */
export function generateHeatmapByConjunto(data) {
  const byConjunto = new Map(); // conjunto -> elemento -> count

  data.forEach(item => {
    const conjuntoRaw = item.CONJUNTO;
    const conjunto = normKey(conjuntoRaw);
    const elemento = normKey(item.ELEMENTO || item.ELEMENTOS);
    if (!conjunto || !elemento) return;

    if (!byConjunto.has(conjunto)) {
      byConjunto.set(conjunto, {
        display: String(conjuntoRaw ?? '').trim(),
        elementCounts: new Map()
      });
    }

    const bucket = byConjunto.get(conjunto);
    bucket.elementCounts.set(elemento, (bucket.elementCounts.get(elemento) || 0) + 1);
  });

  const coordenadasConjuntos = {
    'NOVA RUSSAS': [-4.7058, -40.5659],
    'MACAOCA': [-4.4519, -40.7262],
    'CANINDÉ': [-4.3583, -39.3116],
    'QUIXERAMOBIM': [-5.1990, -39.2927],
    'IPU': [-4.3220, -40.7107],
    'INDEPENDÊNCIA': [-5.3960, -40.3080],
    'ARARENDA': [-4.7448, -40.8311],
    'BOA VIAGEM': [-5.1271, -39.7336],
    'INHUPORANGA': [-4.4369, -40.8892],
    'SANTA QUITÉRIA': [-4.3324, -40.1572],
    'CRATEÚS': [-5.1783, -40.6696],
    'MONSENHOR TABOSA': [-4.7923, -40.0645],
    'ARARAS I': [-4.2096, -40.4498],
    'BANABUIÚ': [-5.3054, -38.9182],
    'QUIXADÁ': [-4.9716, -39.0161]
  };

  const coords = {};
  const displayByKey = {};
  Object.entries(coordenadasConjuntos).forEach(([k, v]) => {
    const nk = normKey(k);
    coords[nk] = v;
    displayByKey[nk] = k;
  });

  const heatmap = [];
  const missing = [];

  for (const [conjuntoNorm, bucket] of byConjunto.entries()) {
    let reiteradasTotal = 0;
    for (const count of bucket.elementCounts.values()) {
      if (count >= 2) reiteradasTotal += count;
    }
    if (reiteradasTotal <= 0) continue;

    const coord = coords[conjuntoNorm];
    if (!coord) {
      missing.push(bucket.display);
      continue;
    }

    heatmap.push({
      lat: coord[0],
      lng: coord[1],
      intensity: reiteradasTotal,
      label: displayByKey[conjuntoNorm]
    });
  }

  console.log('[HEATMAP-CONJ] conjuntos lidos:', byConjunto.size, 'pontos:', heatmap.length);
  if (missing.length) console.warn('[HEATMAP-CONJ] sem coords (top 30):', missing.slice(0, 30));

  return heatmap;
}

/* =========================
   UTILIDADES EXISTENTES
========================= */
export function getAllColumns(data) {
  const cols = new Set();
  data.forEach(i => Object.keys(i).forEach(k => cols.add(k)));
  return Array.from(cols);
}

export function getOcorrenciasByElemento(data, elemento) {
  return data.filter(i => i.ELEMENTO === elemento);
}
