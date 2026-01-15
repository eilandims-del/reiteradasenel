/**
 * Componente Mapa - Mapa de calor do Ceará com Leaflet
 */

import { generateHeatmapData } from '../services/data-service.js';

let map = null;
let heatLayer = null;

/**
 * Inicializar mapa
 */
export function initMap() {
    const mapContainer = document.getElementById('mapaCeara');
    if (!mapContainer) return;

    // Coordenadas do centro do Ceará
    map = L.map('mapaCeara').setView([-4.2250, -39.1353], 7);

    // Adicionar tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    // ZoomControl e scrollWheelZoom já estão habilitados por padrão no Leaflet
    // Se precisar configurar, use: map.scrollWheelZoom.enable() ou map.scrollWheelZoom.disable()
}

/**
 * Atualizar mapa de calor
 */
export function updateHeatmap(data) {
    if (!map) {
        initMap();
    }

    const heatmapPoints = generateHeatmapData(data);
    
    if (heatmapPoints.length === 0) {
        return;
    }

    // Remover layer anterior se existir
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }

    // Preparar pontos para heatmap (formato [lat, lng, intensity])
    const points = heatmapPoints.map(point => [
        point.lat,
        point.lng,
        point.intensity
    ]);

    // Adicionar heatmap layer (se disponível)
    if (typeof L.heatLayer === 'function') {
        heatLayer = L.heatLayer(points, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            gradient: {
                0.0: 'blue',
                0.5: 'cyan',
                1.0: 'red'
            }
        }).addTo(map);
    }

    // Ajustar zoom para mostrar todos os pontos
    if (heatmapPoints.length > 0) {
        const bounds = heatmapPoints.map(p => [p.lat, p.lng]);
        map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Adicionar marcadores com popups informativos
    heatmapPoints.forEach(point => {
        L.circleMarker([point.lat, point.lng], {
            radius: 8,
            fillColor: '#003876',
            color: '#FFFFFF',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).bindPopup(`<strong>Intensidade:</strong> ${point.intensity} ocorrências`)
          .addTo(map);
    });
}

