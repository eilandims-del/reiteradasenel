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
    const elemento = item.ELEMENTO || '';
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
  const normalize = (v) =>
    String(v ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // conjunto -> elemento -> contagem
  const byConjunto = new Map();

  data.forEach(item => {
    const conjunto = normalize(item.CONJUNTO);
    const elemento = normalize(item.ELEMENTO);
    if (!conjunto || !elemento) return;

    if (!byConjunto.has(conjunto)) {
      byConjunto.set(conjunto, new Map());
    }

    const mapElem = byConjunto.get(conjunto);
    mapElem.set(elemento, (mapElem.get(elemento) || 0) + 1);
  });

  // Coordenadas (chaves NORMALIZADAS)
  const coords = {
    'FORTALEZA': [-3.7172, -38.5433],
    'MARACANAU': [-3.8770, -38.6256],
    'CAUCAIA': [-3.7361, -38.6533],
    'JUAZEIRO DO NORTE': [-7.2133, -39.3153],
    'SOBRAL': [-3.6856, -40.3442],
    'CRATO': [-7.2337, -39.4097],
    'ITAPIPOCA': [-3.4944, -39.5786],
    'MARANGUAPE': [-3.8906, -38.6853],
    'QUIXADA': [-4.9681, -39.0153],
    'IGUATU': [-6.3614, -39.2978],
    'PACATUBA': [-3.9808, -38.6181],
    'AQUIRAZ': [-3.9017, -38.3914],
    'HORIZONTE': [-4.0917, -38.4956],
    'EUSEBIO': [-3.8936, -38.4508],
    'CANINDE': [-4.3597, -39.3117],
    'CRATEUS': [-5.1756, -40.6764],
    'IPU': [-4.3256, -40.7109],
    'NOVA RUSSAS': [-4.7044, -40.5669],
    'QUIXERAMOBIM': [-5.0939, -39.3619],
    'BOA VIAGEM': [-5.1310, -39.7336]
  };

  const heatmap = [];

  for (const [conjunto, elementos] of byConjunto.entries()) {
    let intensidade = 0;

    for (const count of elementos.values()) {
      if (count >= 2) intensidade += count;
    }

    if (intensidade > 0 && coords[conjunto]) {
      heatmap.push({
        lat: coords[conjunto][0],
        lng: coords[conjunto][1],
        intensity: intensidade,
        conjunto
      });
    }
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
