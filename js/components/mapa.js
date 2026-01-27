import {
  generateHeatmapByAlimentador,
  generateHeatmapByConjunto
} from '../services/data-service.js';

let map;
let heatLayer;
let markersLayer;

let kmlLinesLayer;          // ✅ camada das linhas (alimentadores)
let alimentadorCoords = null;
let alimentadorLines = null; // ✅ prefixo -> GeoJSON feature(s)
let kmlLoading = null;

let currentMode = 'ALIMENTADOR'; // ALIMENTADOR | CONJUNTO
let lastData = [];

const MAX_INTENSITY = 50;

/* =========================
   HELPERS
========================= */
function normKey(v) {
  return String(v ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAlimPrefix(nameNorm) {
  // tenta pegar algo como QXD01 / IPU02 / etc
  const m = nameNorm.match(/([A-Z]{3}\s?\d{2})/);
  if (!m) return null;
  return m[1].replace(/\s+/g, '');
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/* =========================
   KML -> (coords + lines)
========================= */
async function loadKML(url = 'assets/doc.kml') {
  if (kmlLoading) return kmlLoading;

  kmlLoading = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao carregar KML: ${res.status} ${res.statusText}`);
    const kmlText = await res.text();

    const xml = new DOMParser().parseFromString(kmlText, 'text/xml');

    // ✅ toGeoJSON (via script no index.html)
    const geojson = window.toGeoJSON.kml(xml);

    // 1) montar linhas por alimentador (prefixo)
    const byPrefix = new Map(); // prefix -> features[]
    const centroidAcc = new Map(); // prefix -> {sumLat,sumLng,n}

    for (const f of geojson.features || []) {
      const nameRaw = (f.properties && (f.properties.name || f.properties.NAME)) || '';
      const prefix = extractAlimPrefix(normKey(nameRaw));
      if (!prefix) continue;

      // guarda feature
      if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
      byPrefix.get(prefix).push(f);

      // calcula um "centro" simples dos pontos das linhas (para marcador / heat)
      // pega todos os coords das geometrias (LineString / MultiLineString)
      const coords = [];
      const g = f.geometry;

      if (!g) continue;
      if (g.type === 'LineString') coords.push(...g.coordinates);
      if (g.type === 'MultiLineString') g.coordinates.forEach(ls => coords.push(...ls));
      if (g.type === 'Point') coords.push(g.coordinates);

      for (const c of coords) {
        const [lon, lat] = c;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        if (!centroidAcc.has(prefix)) centroidAcc.set(prefix, { sumLat: 0, sumLng: 0, n: 0 });
        const a = centroidAcc.get(prefix);
        a.sumLat += lat;
        a.sumLng += lon;
        a.n += 1;
      }
    }

    // 2) gerar coords por prefixo (centroide simples)
    const coordsOut = {};
    centroidAcc.forEach((a, prefix) => {
      coordsOut[normKey(prefix)] = {
        lat: a.sumLat / a.n,
        lng: a.sumLng / a.n,
        display: prefix
      };
    });

    alimentadorCoords = coordsOut;
    alimentadorLines = byPrefix;

    console.log('[KML] alimentadores carregados:', Object.keys(coordsOut).length, 'linhas:', byPrefix.size);

    return { coordsOut, byPrefix };
  })();

  return kmlLoading;
}

/* =========================
   UI: Toggle (simples)
========================= */
function injectSmallCSSOnce() {
  if (document.getElementById('mapExtrasCSS')) return;
  const style = document.createElement('style');
  style.id = 'mapExtrasCSS';
  style.textContent = `
    .map-toggle{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 12px}
    .map-toggle .tbtn{border:1px solid rgba(10,74,140,.18);background:rgba(255,255,255,.9);padding:8px 10px;border-radius:10px;font-weight:800;font-size:12px;cursor:pointer;color:#0A4A8C}
    .map-toggle .tbtn.active{background:#0A4A8C;color:#fff;border-color:#0A4A8C}
  `;
  document.head.appendChild(style);
}

function ensureToggleUI() {
  const mapEl = document.getElementById('mapaCeara');
  if (!mapEl) return;
  if (document.getElementById('mapToggleWrap')) return;

  injectSmallCSSOnce();

  const wrap = document.createElement('div');
  wrap.id = 'mapToggleWrap';
  wrap.className = 'map-toggle';
  wrap.innerHTML = `
    <button id="btnModeAlim" class="tbtn">ALIMENTADOR (KML)</button>
    <button id="btnModeConj" class="tbtn">CONJUNTO (Cidades)</button>
  `;
  mapEl.parentNode.insertBefore(wrap, mapEl);

  const btnAlim = document.getElementById('btnModeAlim');
  const btnConj = document.getElementById('btnModeConj');

  const setActive = () => {
    btnAlim?.classList.toggle('active', currentMode === 'ALIMENTADOR');
    btnConj?.classList.toggle('active', currentMode === 'CONJUNTO');
  };

  btnAlim?.addEventListener('click', async () => {
    currentMode = 'ALIMENTADOR';
    setActive();
    await renderAllLayers(lastData);
  });

  btnConj?.addEventListener('click', async () => {
    currentMode = 'CONJUNTO';
    setActive();
    await renderAllLayers(lastData);
  });

  setActive();
}

/* =========================
   INIT MAP
========================= */
export function initMap() {
  const el = document.getElementById('mapaCeara');
  if (!el) return;
  if (map) return;

  map = L.map('mapaCeara').setView([-4.8, -39.5], 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  kmlLinesLayer = L.layerGroup().addTo(map);

  ensureToggleUI();

  // carrega KML logo no início (pra desenhar linhas)
  loadKML('assets/doc.kml').catch(err => console.error('[KML] erro:', err));
}

/* =========================
   Render linhas do KML (com intensidade)
========================= */
function clearMapLayers() {
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
  if (markersLayer) markersLayer.clearLayers();
  if (kmlLinesLayer) kmlLinesLayer.clearLayers();
}

function intensityStyle(intensity) {
  // 0..50 => 0..1
  const rel = clamp01(intensity / MAX_INTENSITY);

  // cor fixa (vermelho) variando opacidade + espessura
  // (Leaflet polyline aceita "opacity" e "weight")
  const weight = 2 + Math.round(rel * 6);     // 2..8
  const opacity = 0.25 + rel * 0.70;          // 0.25..0.95

  return { color: '#D32F2F', weight, opacity };
}

function renderKmlLines(intensityByPrefix) {
  if (!alimentadorLines || !kmlLinesLayer) return;

  for (const [prefix, features] of alimentadorLines.entries()) {
    const total = intensityByPrefix.get(prefix) || 0;
    if (total <= 0) continue;

    const st = intensityStyle(total);

    features.forEach(f => {
      const layer = L.geoJSON(f, {
        style: () => st
      });

      layer.eachLayer(l => {
        l.bindPopup(
          `<strong>Alimentador: ${prefix}</strong><br>` +
          `Reiteradas (total): <b>${total}</b>`
        );
      });

      layer.addTo(kmlLinesLayer);
    });
  }
}

/* =========================
   Render heat + markers + linhas
========================= */
async function renderAllLayers(data) {
  if (!map) initMap();
  if (!map) return;

  lastData = Array.isArray(data) ? data : [];

  clearMapLayers();

  if (!lastData.length) return;

  if (currentMode === 'ALIMENTADOR') {
    // garante KML carregado
    if (!alimentadorCoords || !alimentadorLines) {
      await loadKML('assets/doc.kml').catch(() => null);
    }
    if (!alimentadorCoords || !alimentadorLines) return;

    // 1) heatmap points
    const points = generateHeatmapByAlimentador(lastData, alimentadorCoords);
    if (!points.length) return;

    // 2) desenha heat
    const heatPoints = points.map(p => [p.lat, p.lng, clamp01(p.intensity / MAX_INTENSITY)]);
    heatLayer = L.heatLayer(heatPoints, {
      radius: 45,
      blur: 30,
      minOpacity: 0.35,
      maxZoom: 11,
      gradient: {
        0.10: '#6EC6FF',
        0.30: '#2196F3',
        0.55: '#FFC107',
        0.75: '#FF9800',
        1.00: '#B71C1C'
      }
    }).addTo(map);

    // 3) markers
    points.forEach(p => {
      const rel = clamp01(p.intensity / MAX_INTENSITY);
      const r = 6 + Math.round(rel * 12);
      const op = 0.55 + rel * 0.40;

      L.circleMarker([p.lat, p.lng], {
        radius: r,
        color: '#ffffff',
        fillColor: '#003876',
        fillOpacity: op,
        weight: 2
      })
        .bindPopup(
          `<strong>Alimentador: ${p.label}</strong><br>` +
          `Reiteradas (total): <b>${p.intensity}</b>`
        )
        .addTo(markersLayer);
    });

    // 4) linhas do KML com intensidade por alimentador
    const intensityByPrefix = new Map();
    points.forEach(p => intensityByPrefix.set(p.label, p.intensity));
    // ⚠️ p.label aqui é o "display" (prefix). garantimos isso no KML loader
    renderKmlLines(intensityByPrefix);

    map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [40, 40] });
    if (map.getZoom() > 10) map.setZoom(10);
  } else {
    // CONJUNTO
    const points = generateHeatmapByConjunto(lastData);
    if (!points.length) return;

    const heatPoints = points.map(p => [p.lat, p.lng, clamp01(p.intensity / MAX_INTENSITY)]);
    heatLayer = L.heatLayer(heatPoints, {
      radius: 45,
      blur: 30,
      minOpacity: 0.35,
      maxZoom: 11,
      gradient: {
        0.10: '#6EC6FF',
        0.30: '#2196F3',
        0.55: '#FFC107',
        0.75: '#FF9800',
        1.00: '#B71C1C'
      }
    }).addTo(map);

    points.forEach(p => {
      const rel = clamp01(p.intensity / MAX_INTENSITY);
      const r = 6 + Math.round(rel * 12);
      const op = 0.55 + rel * 0.40;

      L.circleMarker([p.lat, p.lng], {
        radius: r,
        color: '#ffffff',
        fillColor: '#003876',
        fillOpacity: op,
        weight: 2
      })
        .bindPopup(
          `<strong>Conjunto: ${p.label}</strong><br>` +
          `Reiteradas (total): <b>${p.intensity}</b>`
        )
        .addTo(markersLayer);
    });

    map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [40, 40] });
    if (map.getZoom() > 10) map.setZoom(10);
  }
}

export function updateHeatmap(data) {
  renderAllLayers(data);
}
