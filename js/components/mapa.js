import { generateHeatmapData } from '../services/data-service.js';

let map;
let heatLayer;
let markersLayer;

// 🔥 coords por alimentador vindas do KML
let alimentadorCoords = null;
let kmlLoading = null;

// Normalização forte (igual ao service)
function normKey(v) {
  return String(v ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pega prefixo tipo QXD01 de nomes QXD01P6 etc.
function extractAlimPrefix(nameNorm) {
  const m = nameNorm.match(/^([A-Z]{3}\s?\d{2})/);
  if (!m) return null;
  return m[1].replace(/\s+/g, ''); // remove espaço se vier "QXD 01"
}

// Faz parse do KML e gera centroide por ALIMENTADOR (prefixo)
async function loadAlimentadoresFromKML(url = 'assets/doc.kml') {
  if (alimentadorCoords) return alimentadorCoords;
  if (kmlLoading) return kmlLoading;

  kmlLoading = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao carregar KML: ${res.status} ${res.statusText}`);
    const text = await res.text();

    const xml = new DOMParser().parseFromString(text, 'text/xml');
    const placemarks = Array.from(xml.getElementsByTagName('Placemark'));

    // prefix -> acumuladores
    const acc = new Map(); // prefix -> {sumLat,sumLng,n, display}

    for (const pm of placemarks) {
      const nameEl = pm.getElementsByTagName('name')[0];
      const nameRaw = nameEl ? nameEl.textContent : '';
      const nameNorm = normKey(nameRaw);
      const prefix = extractAlimPrefix(nameNorm);
      if (!prefix) continue;

      // pega todas as <coordinates> dentro do placemark
      const coordsEls = Array.from(pm.getElementsByTagName('coordinates'));
      if (!coordsEls.length) continue;

      let sumLat = 0, sumLng = 0, n = 0;

      for (const cEl of coordsEls) {
        const raw = (cEl.textContent || '').trim();
        if (!raw) continue;

        // coordenadas são "lon,lat,alt" separadas por espaços
        const parts = raw.split(/\s+/);
        for (const p of parts) {
          const [lonStr, latStr] = p.split(',');
          const lon = parseFloat(lonStr);
          const lat = parseFloat(latStr);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          sumLat += lat;
          sumLng += lon;
          n += 1;
        }
      }

      if (n === 0) continue;

      if (!acc.has(prefix)) acc.set(prefix, { sumLat: 0, sumLng: 0, n: 0, display: prefix });
      const a = acc.get(prefix);
      a.sumLat += sumLat;
      a.sumLng += sumLng;
      a.n += n;
      a.display = prefix; // ex.: QXD01
    }

    // monta mapa final: ALIM_NORMALIZADO -> {lat,lng,display}
    const out = {};
    for (const [prefix, a] of acc.entries()) {
      out[normKey(prefix)] = {
        lat: a.sumLat / a.n,
        lng: a.sumLng / a.n,
        display: prefix
      };
    }

    console.log('[KML] alimentadores carregados:', Object.keys(out).length);
    alimentadorCoords = out;
    return out;
  })();

  return kmlLoading;
}

export function initMap() {
  const el = document.getElementById('mapaCeara');
  if (!el) return;

  // ✅ evita “Map container is already initialized”
  if (map) return;

  map = L.map('mapaCeara').setView([-4.8, -39.5], 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // ✅ grupo de marcadores
  markersLayer = L.layerGroup().addTo(map);

  // ✅ dispara carregamento do KML já na inicialização
  loadAlimentadoresFromKML('assets/doc.kml').catch(err => {
    console.error('[KML] Erro ao carregar:', err);
  });
}

export function updateHeatmap(data) {
  if (!map) initMap();
  if (!map) return;

  // Se KML ainda não carregou, não desenha (evita points vazios)
  if (!alimentadorCoords) {
    loadAlimentadoresFromKML('assets/doc.kml').catch(err => console.error(err));
    return;
  }

  const points = generateHeatmapData(data, alimentadorCoords);

  if (!points.length) {
    // limpa camadas se não tem pontos
    if (heatLayer) {
      map.removeLayer(heatLayer);
      heatLayer = null;
    }
    if (markersLayer) markersLayer.clearLayers();
    return;
  }

  // ✅ remove heat anterior
  if (heatLayer) map.removeLayer(heatLayer);

  // ✅ limpa markers anteriores
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

  // ✅ bolinhas por alimentador
  points.forEach(p => {
    L.circleMarker([p.lat, p.lng], {
      radius: 7,
      color: '#ffffff',
      fillColor: '#003876',
      fillOpacity: 0.85,
      weight: 2
    })
      .bindPopup(
        `<strong>Alimentador: ${p.conjunto}</strong><br>
         Reiteradas (total): <b>${p.intensity}</b>`
      )
      .addTo(markersLayer);
  });

  map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [40, 40] });
}
