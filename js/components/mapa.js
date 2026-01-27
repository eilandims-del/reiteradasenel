import { generateHeatmapData } from '../services/data-service.js';

let map;
let heatLayer;

export function initMap() {
  const el = document.getElementById('mapaCeara');
  if (!el) return;

  map = L.map('mapaCeara').setView([-4.8, -39.5], 7);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

export function updateHeatmap(data) {
  if (!map) initMap();

  const points = generateHeatmapData(data);
  if (!points.length) return;

  if (heatLayer) map.removeLayer(heatLayer);

  heatLayer = L.heatLayer(
    points.map(p => [p.lat, p.lng, p.intensity]),
    {
      radius: 28,
      blur: 18,
      maxZoom: 10,
      gradient: {
        0.3: 'blue',
        0.6: 'orange',
        1.0: 'red'
      }
    }
  ).addTo(map);

  points.forEach(p => {
    L.circleMarker([p.lat, p.lng], {
      radius: 7,
      color: '#ffffff',
      fillColor: '#003876',
      fillOpacity: 0.85
    })
      .bindPopup(
        `<strong>${p.conjunto}</strong><br>
         Intensidade de reiterações: <b>${p.intensity}</b>`
      )
      .addTo(map);
  });

  map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [40, 40] });
}
