/**
 * Serviço de Dados - Lógica de negócio para rankings e análises
 */

import { DataService } from './firebase-service.js';

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
   MAPA DE CALOR POR REITERAÇÃO
========================= */
export function generateHeatmapData(data) {
  // ✅ normalização forte: remove acentos, pontuação, múltiplos espaços etc.
  const normKey = (v) =>
    String(v ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // remove acentos
      .replace(/[^\w\s]/g, ' ')         // pontuação vira espaço
      .replace(/_/g, ' ')               // underscore vira espaço
      .replace(/\s+/g, ' ')             // colapsa espaços
      .trim();

  // conjuntoNorm -> { displayName, elementCounts(Map) }
  const byConjunto = new Map();

  data.forEach(item => {
    const conjuntoRaw = item.CONJUNTO;
    const conjunto = normKey(conjuntoRaw);
    const elemento = normKey(item.ELEMENTO || item.ELEMENTOS);

    if (!conjunto || !elemento) return;

    if (!byConjunto.has(conjunto)) {
      // guarda um nome “bonito” (o primeiro que aparecer)
      byConjunto.set(conjunto, { displayName: String(conjuntoRaw ?? '').trim(), elementCounts: new Map() });
    }

    const bucket = byConjunto.get(conjunto);
    bucket.elementCounts.set(elemento, (bucket.elementCounts.get(elemento) || 0) + 1);
  });

  // ✅ suas coordenadas (em formato humano)
  const coordenadasConjuntos = {
    'NOVA RUSSAS': [-4.7058, -40.5659],
    'MACAOCA': [-4.4519, -40.7262],          // Distrito (Madalena/CE)
    'CANINDÉ': [-4.3583, -39.3116],
    'QUIXERAMOBIM': [-5.1990, -39.2927],
    'IPU': [-4.3220, -40.7107],
    'INDEPENDÊNCIA': [-5.3960, -40.3080],
    'ARARENDA': [-4.7448, -40.8311],
    'BOA VIAGEM': [-5.1271, -39.7336],
    'INHUPORANGA': [-4.4369, -40.8892],      // Distrito (Cariré/CE)
    'SANTA QUITÉRIA': [-4.3324, -40.1572],
    'CRATEÚS': [-5.1783, -40.6696],
    'MONSENHOR TABOSA': [-4.7923, -40.0645],
    'ARARAS I': [-4.2096, -40.4498],         // Distrito de Ararendá/CE
    'BANABUIÚ': [-5.3054, -38.9182],
    'QUIXADÁ': [-4.9716, -39.0161]
  };

  // ✅ normaliza as chaves das coordenadas
  const coords = {};
  const displayByKey = {}; // chave normalizada -> nome bonito do dicionário
  for (const [k, v] of Object.entries(coordenadasConjuntos)) {
    const nk = normKey(k);
    coords[nk] = v;
    displayByKey[nk] = k; // mantém acento/forma correta do conjunto
  }

  // ✅ resolve coordenada mesmo se vier "ARARAS I", "ARARAS 1", "ARARAS-I", etc.
  function resolveCoords(conjuntoNorm) {
    if (coords[conjuntoNorm]) return { coord: coords[conjuntoNorm], display: displayByKey[conjuntoNorm] };

    // match parcial por melhor chave (mais longa)
    let bestKey = null;
    for (const key of Object.keys(coords)) {
      if (conjuntoNorm.startsWith(key) || conjuntoNorm.includes(key)) {
        if (!bestKey || key.length > bestKey.length) bestKey = key;
      }
    }

    if (!bestKey) return null;
    return { coord: coords[bestKey], display: displayByKey[bestKey] };
  }

  const heatmap = [];
  const missing = [];

  for (const [conjuntoNorm, bucket] of byConjunto.entries()) {
    // ✅ total de reiteradas por conjunto:
    // soma as ocorrências somente dos elementos repetidos (>=2)
    let reiteradasTotal = 0;
    for (const count of bucket.elementCounts.values()) {
      if (count >= 2) reiteradasTotal += count;
    }
    if (reiteradasTotal <= 0) continue;

    const resolved = resolveCoords(conjuntoNorm);
    if (!resolved) {
      missing.push(bucket.displayName || conjuntoNorm);
      continue;
    }

    heatmap.push({
      lat: resolved.coord[0],
      lng: resolved.coord[1],
      intensity: reiteradasTotal,
      conjunto: resolved.display // ✅ nome “bonito” vindo do seu dicionário
    });
  }

  // Debug útil
  if (heatmap.length === 0) {
    console.warn('[HEATMAP] Nenhum ponto gerado. Exemplos de CONJUNTO:', Array.from(byConjunto.keys()).slice(0, 20));
  }
  if (missing.length) {
    console.warn('[HEATMAP] CONJUNTO sem coords (primeiros 30):', missing.slice(0, 30));
  }

  return heatmap;
}


/* =========================
   FILTRO POR DATA
========================= */
export function filterByDateRange(data, di, df) {
  if (!di && !df) return data;

  return data.filter(item => {
    const d = item.DATA;
    if (!d) return false;
    if (di && d < di) return false;
    if (df && d > df) return false;
    return true;
  });
}

export function getAllColumns(data) {
  const cols = new Set();
  data.forEach(i => Object.keys(i).forEach(k => cols.add(k)));
  return Array.from(cols);
}

export function getOcorrenciasByElemento(data, elemento) {
  return data.filter(i => i.ELEMENTO === elemento);
}
