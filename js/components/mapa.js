import {
  generateHeatmapByConjunto,
  generateAlimentadorIntensityMap,
  normKey,
  extractAlimBase
} from '../services/data-service.js';

let map;
let heatLayer;            // conjunto heat
let markersLayer;         // conjunto bolinhas
let alimentadorLayer;     // linhas do KML
let legendControl;
let modeControl;

let currentMode = 'ALIMENTADOR'; // 'ALIMENTADOR' | 'CONJUNTO'
let kmlLoaded = false;

// alimBase -> { segments: Array<Array<[lat,lng]>>, bounds: LatLngBounds }
const kmlNetwork = new Map();

// Ajuste aqui se o arquivo no assets tiver outro nome
const KML_URL_CANDIDATES = [
  'assets/doc.kml',
  'assets/TRAMOS.kml',
  'assets/tramos.kml',
  'assets/TRAMOS.kmz', // se estiver kmz não vai parsear (precisa ser .kml)
];

// ====== CORES (0..50 => mais escuro) ======
// clamp 0..50, 50+ vira máximo.
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
function clampTo50(v) {
  const n = Number(v || 0);
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(50, n));
}

// Escala simples: 0 cinza, 1..50 vai amarelo->laranja->vermelho escuro
function colorForIntensity(v) {
  const x = clampTo50(v) / 50; // 0..1
  if (x <= 0) return '#9CA3AF'; // cinza

  // Interpolação por faixas:
  // 0..0.35: amarelo (#FDE047) -> laranja (#FB923C)
  // 0.35..0.75: laranja (#FB923C) -> vermelho (#EF4444)
  // 0.75..1: vermelho (#EF4444) -> vermelho escuro (#7F1D1D)
  const lerp = (a, b, t) => a + (b - a) * t;

  const hexToRgb = (h) => {
    const s = h.replace('#', '');
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
    };
  };
  const rgbToHex = ({ r, g, b }) =>
    '#' +
    [r, g, b]
      .map(v => Math.round(v).toString(16).padStart(2, '0'))
      .join('');

  const c1 = '#FDE047';
  const c2 = '#FB923C';
  const c3 = '#EF4444';
  const c4 = '#7F1D1D';

  let a, b, t;

  if (x <= 0.35) {
    a = hexToRgb(c1); b = hexToRgb(c2);
    t = x / 0.35;
  } else if (x <= 0.75) {
    a = hexToRgb(c2); b = hexToRgb(c3);
    t = (x - 0.35) / (0.75 - 0.35);
  } else {
    a = hexToRgb(c3); b = hexToRgb(c4);
    t = (x - 0.75) / (1 - 0.75);
  }

  const out = {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
  return rgbToHex(out);
}

function opacityForIntensity(v) {
  const x = clampTo50(v) / 50;
  if (x <= 0) return 0.25;
  return 0.45 + (0.55 * x); // 0.45..1.0
}

// ====== KML PARSER ======
function parseKmlCoordinates(coordText) {
  // coordText: "lon,lat,alt lon,lat,alt ..."
  const pts = [];
  const chunks = String(coordText || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  for (const c of chunks) {
    const parts = c.split(',');
    if (parts.length < 2) continue;
    const lon = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (!isFinite(lat) || !isFinite(lon)) continue;
    pts.push([lat, lon]);
  }
  return pts;
}

function getPlacemarkName(pm) {
  // tenta <name>, senão styleUrl/id
  const name = pm.querySelector('name')?.textContent?.trim();
  if (name) return name;

  const styleUrl = pm.querySelector('styleUrl')?.textContent?.trim();
  if (styleUrl) return styleUrl.replace('#', '');

  const id = pm.getAttribute('id');
  if (id) return id;

  return 'SEM_NOME';
}

async function fetchFirstAvailableKml() {
  for (const url of KML_URL_CANDIDATES) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const text = await r.text();
      if (text && text.includes('<kml')) return { url, text };
    } catch (_) {}
  }
  return null;
}

async function loadKmlOnce() {
  if (kmlLoaded) return;
  kmlLoaded = true;

  const res = await fetchFirstAvailableKml();
  if (!res) {
    console.warn('[KML] Não encontrei KML em assets. Verifique nome/URL.');
    return;
  }

  const xml = new DOMParser().parseFromString(res.text, 'text/xml');
  const placemarks = Array.from(xml.getElementsByTagName('Placemark'));

  let totalSegments = 0;
  let totalLines = 0;

  for (const pm of placemarks) {
    // pode ter múltiplas LineString ou MultiGeometry
    const lineStrings = pm.getElementsByTagName('LineString');
    if (!lineStrings || !lineStrings.length) continue;

    const rawName = getPlacemarkName(pm);
    const alimBase = extractAlimBase(rawName); // ARR01, IPU01...
    if (!alimBase) continue;

    for (const ls of Array.from(lineStrings)) {
      const coordNode = ls.getElementsByTagName('coordinates')[0];
      const coordsText = coordNode?.textContent;
      const latlngs = parseKmlCoordinates(coordsText);
      if (latlngs.length < 2) continue;

      totalLines++;
      totalSegments += Math.max(0, latlngs.length - 1);

      if (!kmlNetwork.has(alimBase)) {
        kmlNetwork.set(alimBase, {
          segments: [],
          bounds: L.latLngBounds(latlngs),
          display: alimBase
        });
      }

      const bucket = kmlNetwork.get(alimBase);
      bucket.segments.push(latlngs);
      bucket.bounds.extend(L.latLngBounds(latlngs));
    }
  }

  console.log('[KML] carregado de:', res.url, '| alimentadores:', kmlNetwork.size, '| linhas:', totalLines, '| segmentos:', totalSegments);
}

// ====== CONTROLS (toggle + legenda) ======
function addModeControl() {
  if (modeControl) return;

  modeControl = L.control({ position: 'topright' });
  modeControl.onAdd = function () {
    const div = L.DomUtil.create('div', 'leaflet-bar');
    div.style.background = 'white';
    div.style.padding = '8px';
    div.style.borderRadius = '10px';
    div.style.boxShadow = '0 6px 18px rgba(0,0,0,.12)';
    div.style.display = 'flex';
    div.style.gap = '6px';
    div.style.alignItems = 'center';

    const btnConj = L.DomUtil.create('button', '', div);
    btnConj.textContent = 'Conjuntos';
    btnConj.style.border = '1px solid #ddd';
    btnConj.style.padding = '6px 10px';
    btnConj.style.borderRadius = '8px';
    btnConj.style.cursor = 'pointer';
    btnConj.style.fontWeight = '700';

    const btnAlim = L.DomUtil.create('button', '', div);
    btnAlim.textContent = 'Alimentadores';
    btnAlim.style.border = '1px solid #ddd';
    btnAlim.style.padding = '6px 10px';
    btnAlim.style.borderRadius = '8px';
    btnAlim.style.cursor = 'pointer';
    btnAlim.style.fontWeight = '700';

    const setActive = () => {
      const activeBg = '#0A4A8C';
      const activeColor = 'white';
      const idleBg = 'white';
      const idleColor = '#111';

      if (currentMode === 'CONJUNTO') {
        btnConj.style.background = activeBg;
        btnConj.style.color = activeColor;
        btnAlim.style.background = idleBg;
        btnAlim.style.color = idleColor;
      } else {
        btnAlim.style.background = activeBg;
        btnAlim.style.color = activeColor;
        btnConj.style.background = idleBg;
        btnConj.style.color = idleColor;
      }
    };

    setActive();

    // impede o clique no mapa ao clicar nos botões
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    btnConj.addEventListener('click', () => {
      currentMode = 'CONJUNTO';
      setActive();
      // força re-render com os últimos dados (guardados no mapa.js)
      if (window.__LAST_MAP_DATA__) updateHeatmap(window.__LAST_MAP_DATA__);
    });

    btnAlim.addEventListener('click', () => {
      currentMode = 'ALIMENTADOR';
      setActive();
      if (window.__LAST_MAP_DATA__) updateHeatmap(window.__LAST_MAP_DATA__);
    });

    return div;
  };

  modeControl.addTo(map);
}

function addLegendControl() {
  if (legendControl) return;

  legendControl = L.control({ position: 'bottomright' });
  legendControl.onAdd = function () {
    const div = L.DomUtil.create('div', '');
    div.style.background = 'white';
    div.style.padding = '10px 12px';
    div.style.borderRadius = '10px';
    div.style.boxShadow = '0 6px 18px rgba(0,0,0,.12)';
    div.style.fontSize = '12px';
    div.style.lineHeight = '1.2';
    div.style.minWidth = '170px';

    const title = document.createElement('div');
    title.textContent = 'Intensidade (0–50+)';
    title.style.fontWeight = '800';
    title.style.marginBottom = '8px';
    div.appendChild(title);

    const bar = document.createElement('div');
    bar.style.height = '10px';
    bar.style.borderRadius = '8px';
    bar.style.border = '1px solid #e5e7eb';
    bar.style.background = 'linear-gradient(90deg, #9CA3AF 0%, #FDE047 20%, #FB923C 55%, #EF4444 78%, #7F1D1D 100%)';
    div.appendChild(bar);

    const labels = document.createElement('div');
    labels.style.display = 'flex';
    labels.style.justifyContent = 'space-between';
    labels.style.marginTop = '6px';
    labels.innerHTML = `<span>0</span><span>25</span><span>50+</span>`;
    div.appendChild(labels);

    // trava interação no mapa
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    return div;
  };

  legendControl.addTo(map);
}

// ====== INIT ======
export function initMap() {
  const el = document.getElementById('mapaCeara');
  if (!el) return;

  if (map) return;

  map = L.map('mapaCeara', { preferCanvas: true }).setView([-4.8, -39.5], 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  alimentadorLayer = L.layerGroup().addTo(map);

  addModeControl();
  addLegendControl();
}

// ====== RENDER MODOS ======
function clearConjuntoLayers() {
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }
  if (markersLayer) markersLayer.clearLayers();
}

function clearAlimentadorLayers() {
  if (alimentadorLayer) alimentadorLayer.clearLayers();
}

function renderConjunto(data) {
  clearAlimentadorLayers();

  const points = generateHeatmapByConjunto(data);
  if (!points.length) {
    clearConjuntoLayers();
    return;
  }

  // remove heat anterior
  if (heatLayer) map.removeLayer(heatLayer);
  if (markersLayer) markersLayer.clearLayers();

  heatLayer = L.heatLayer(
    points.map(p => [p.lat, p.lng, p.intensity]),
    {
      radius: 28,
      blur: 18,
      maxZoom: 10,
      gradient: {
        0.30: 'blue',
        0.60: 'orange',
        1.00: 'red'
      }
    }
  ).addTo(map);

  points.forEach(p => {
    L.circleMarker([p.lat, p.lng], {
      radius: 7,
      color: '#ffffff',
      fillColor: '#003876',
      fillOpacity: 0.85,
      weight: 2
    })
      .bindPopup(
        `<strong>${p.label}</strong><br>
         Reiteradas (total): <b>${p.intensity}</b>`
      )
      .addTo(markersLayer);
  });

  map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [40, 40] });
}

function renderAlimentador(data) {
  clearConjuntoLayers();
  clearAlimentadorLayers();

  // mapa de intensidade por ALIM base (ARR01, IPU01...)
  const intensityMap = generateAlimentadorIntensityMap(data);

  // Se não tem KML carregado, não tem o que desenhar
  if (!kmlNetwork.size) {
    console.warn('[ALIM] Sem KML carregado/parseado. Não há linhas para desenhar.');
    return;
  }

  let anyHot = false;
  let boundsHot = null;
  let boundsAll = null;

  // desenha todas as linhas; quem não tem intensidade fica cinza/leve
  for (const [alimBase, info] of kmlNetwork.entries()) {
    const total = intensityMap[alimBase]?.total || 0;

    const color = colorForIntensity(total);
    const opacity = opacityForIntensity(total);
    const weight = total > 0 ? 4 : 2;

    const popupHtml = `
      <strong>Alimentador: ${alimBase}</strong><br>
      Reiteradas (total): <b>${total}</b>
    `;

    for (const seg of info.segments) {
      const pl = L.polyline(seg, {
        color,
        opacity,
        weight,
        lineCap: 'round',
        lineJoin: 'round'
      });

      // clique + hover “profissional”
      pl.bindPopup(popupHtml);

      pl.on('mouseover', () => {
        pl.setStyle({ weight: Math.max(weight, 5), opacity: Math.min(1, opacity + 0.15) });
      });
      pl.on('mouseout', () => {
        pl.setStyle({ weight, opacity });
      });

      pl.addTo(alimentadorLayer);
    }

    // bounds
    if (!boundsAll) boundsAll = info.bounds;
    else boundsAll = boundsAll.extend(info.bounds);

    if (total > 0) {
      anyHot = true;
      if (!boundsHot) boundsHot = info.bounds;
      else boundsHot = boundsHot.extend(info.bounds);
    }
  }

  // melhor zoom: se tiver “quentes”, foca neles; senão mostra tudo do KML
  const b = anyHot ? boundsHot : boundsAll;
  if (b) map.fitBounds(b, { padding: [40, 40] });
}

// ====== API usada pelo main.js ======
export async function updateHeatmap(data) {
  if (!map) initMap();
  if (!map) return;

  // guarda para o toggle poder re-renderizar sem depender do main.js
  window.__LAST_MAP_DATA__ = data;

  // KML é necessário para ALIMENTADOR
  if (currentMode === 'ALIMENTADOR') {
    await loadKmlOnce();
  }

  if (currentMode === 'CONJUNTO') {
    renderConjunto(data);
  } else {
    renderAlimentador(data);
  }
}
