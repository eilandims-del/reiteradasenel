import { generateHeatmapData } from '../services/data-service.js';

let map;
let heatLayer;
let markersLayer; // ✅ camada para markers (limpar fácil)

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
}

export function updateHeatmap(data) {
  if (!map) initMap();
  if (!map) return;

  const points = generateHeatmapData(data);
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

  // ✅ limpa markers anteriores (antes você não limpava!)
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

  // ✅ bolinhas por conjunto
  points.forEach(p => {
    L.circleMarker([p.lat, p.lng], {
      radius: 7,
      color: '#ffffff',
      fillColor: '#003876',
      fillOpacity: 0.85,
      weight: 2
    })
      .bindPopup(
        `<strong>${p.conjunto}</strong><br>
         Reiteradas (total): <b>${p.intensity}</b>`
      )
      .addTo(markersLayer);
  });

  map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [40, 40] });
}
