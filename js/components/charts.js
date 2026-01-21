// =========================
// FILE: js/components/charts.js
// =========================
/**
 * Charts - Chart.js
 * CAUSA: Pizza (Top 20) + lista clicável com scroll (todas)
 * ALIMENTADOR: Radar (Top 5) + lista clicável com scroll (todas)
 */

import { openModal, fillDetailsModal } from './modal.js';

let chartCausa = null;
let chartAlimentador = null;

function normalizeKey(k) {
  return String(k || '').trim().toLowerCase().replace(/\./g, '');
}

function getFieldValue(row, fieldName) {
  if (!row) return '';
  if (row[fieldName] != null) return row[fieldName];

  const target = normalizeKey(fieldName);
  const foundKey = Object.keys(row).find(k => normalizeKey(k) === target);
  if (foundKey) return row[foundKey];
  return '';
}

function buildRankingWithOccur(data, field) {
  const counts = new Map();
  const ocorrMap = new Map();

  data.forEach(row => {
    const value = String(getFieldValue(row, field) || '').trim();
    if (!value) return;

    counts.set(value, (counts.get(value) || 0) + 1);

    if (!ocorrMap.has(value)) ocorrMap.set(value, []);
    ocorrMap.get(value).push(row);
  });

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count, ocorrencias: ocorrMap.get(name) }))
    .sort((a, b) => b.count - a.count);
}

function openDetails(tipo, nome, ocorrencias) {
  const modalContent = document.getElementById('detalhesConteudo');
  let selectedColumns = [];

  if (modalContent && modalContent.dataset.selectedColumns) {
    try { selectedColumns = JSON.parse(modalContent.dataset.selectedColumns); }
    catch { selectedColumns = []; }
  }

  const modalTitle = document.getElementById('detalhesTitulo');
  if (modalTitle) modalTitle.textContent = `${tipo}: ${nome}`;

  fillDetailsModal(nome, ocorrencias, selectedColumns);
  openModal('modalDetalhes');
}

function renderScrollList(containerId, ranking, tipo) {
  const list = document.getElementById(containerId);
  if (!list) return;

  if (!ranking.length) {
    list.innerHTML = '<p style="text-align:center; padding: 1rem; color: var(--medium-gray);">Nenhum dado.</p>';
    return;
  }

  list.innerHTML = '';
  ranking.forEach(item => {
    const div = document.createElement('div');
    div.className = 'chart-list-item';
    div.onclick = () => openDetails(tipo, item.name, item.ocorrencias);

    div.innerHTML = `
      <span class="chart-list-name">${item.name}</span>
      <span class="chart-list-count">(${item.count})</span>
    `;

    list.appendChild(div);
  });
}

/**
 * CAUSA - Pizza (Top 20)
 */
export function renderChartCausa(data) {
  const rankingAll = buildRankingWithOccur(data, 'CAUSA');
  const top = rankingAll.slice(0, 20);

  const canvas = document.getElementById('chartCausa');
  if (!canvas) return;

  if (chartCausa) chartCausa.destroy();

  const labels = top.map(x => x.name);
  const values = top.map(x => x.count);

  const colors = [
    '#0A4A8C', '#1E7CE8', '#00B4FF', '#4DC8FF',
    '#80D9FF', '#B3E8FF', '#E6F4FD', '#FFD700',
    '#FFB84D', '#FF8C69', '#10B981', '#F59E0B',
    '#6366F1', '#EC4899', '#14B8A6', '#A3E635',
    '#F97316', '#22C55E', '#3B82F6', '#EAB308'
  ];

  chartCausa = new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: '#FFFFFF',
        borderWidth: 3,
        hoverBorderWidth: 4,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Top 20 Causas',
          font: { size: 18, weight: '700', family: "'Inter', 'Segoe UI', sans-serif" },
          color: '#0A4A8C',
          padding: { top: 10, bottom: 10 }
        },
        tooltip: {
          backgroundColor: 'rgba(26, 31, 46, 0.95)',
          padding: 12,
          borderColor: '#1E7CE8',
          borderWidth: 2,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total ? ((value / total) * 100).toFixed(1) : '0.0';
              return `${label}: ${value} (${pct}%)`;
            }
          }
        }
      },
      onClick: (evt, elements) => {
        if (!elements || !elements.length) return;
        const idx = elements[0].index;
        const name = labels[idx];
        const found = top.find(x => x.name === name);
        if (found) openDetails('CAUSA', found.name, found.ocorrencias);
      },
      animation: { duration: 900, easing: 'easeOutQuart' }
    }
  });

  // Lista clicável com scrollbar (todas as causas)
  renderScrollList('chartCausaList', rankingAll, 'CAUSA');
}

/**
 * ALIMENTADOR - Radar (Top 5)
 * Obs: busca campo "ALIMENT." (normaliza chaves com/sem ponto)
 */
export function renderChartAlimentador(data) {
  const rankingAll = buildRankingWithOccur(data, 'ALIMENT.');
  const top = rankingAll.slice(0, 5);

  const canvas = document.getElementById('chartAlimentador');
  if (!canvas) return;

  if (chartAlimentador) chartAlimentador.destroy();

  const labels = top.map(x => x.name);
  const values = top.map(x => x.count);

  chartAlimentador = new Chart(canvas, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Ocorrências',
        data: values,
        backgroundColor: 'rgba(30, 124, 232, 0.25)',
        borderColor: '#1E7CE8',
        borderWidth: 3,
        pointBackgroundColor: '#0A4A8C',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 3,
        pointRadius: 5,
        pointHoverBackgroundColor: '#00B4FF',
        pointHoverBorderColor: '#FFFFFF',
        pointHoverRadius: 7,
        pointHoverBorderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            font: { size: 11, weight: '600', family: "'Inter', 'Segoe UI', sans-serif" },
            color: '#5A6C7D',
            backdropColor: 'transparent'
          },
          grid: { color: 'rgba(30, 124, 232, 0.15)', lineWidth: 1.5 },
          angleLines: { color: 'rgba(30, 124, 232, 0.1)', lineWidth: 1.5 },
          pointLabels: {
            font: { size: 12, weight: '600', family: "'Inter', 'Segoe UI', sans-serif" },
            color: '#1A1F2E',
            padding: 10
          }
        }
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Top 5 Alimentadores',
          font: { size: 18, weight: '700', family: "'Inter', 'Segoe UI', sans-serif" },
          color: '#0A4A8C',
          padding: { top: 10, bottom: 10 }
        },
        tooltip: {
          backgroundColor: 'rgba(26, 31, 46, 0.95)',
          padding: 12,
          borderColor: '#1E7CE8',
          borderWidth: 2,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed?.r ?? context.parsed ?? 0;
              return `${label}: ${value}`;
            }
          }
        }
      },
      onClick: (evt, elements) => {
        // Radar não retorna “slice”, mas retorna ponto
        if (!elements || !elements.length) return;
        const idx = elements[0].index;
        const name = labels[idx];
        const found = top.find(x => x.name === name);
        if (found) openDetails('ALIMENTADOR', found.name, found.ocorrencias);
      },
      animation: { duration: 1000, easing: 'easeOutQuart' }
    }
  });

  // Lista clicável com scrollbar (todos os alimentadores)
  renderScrollList('chartAlimentadorList', rankingAll, 'ALIMENTADOR');
}

/**
 * Atualizar todos os gráficos
 */
export function updateCharts(data) {
  renderChartCausa(data);
  renderChartAlimentador(data);
}