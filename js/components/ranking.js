/**
 * Componente Ranking - Exibição e gerenciamento de rankings
 */

import { generateRankingElemento, getOcorrenciasByElemento } from '../services/data-service.js';
import { openModal, fillDetailsModal, buildAlimentadorReportModal } from './modal.js';

let currentRankingData = [];
let allData = [];
let currentElementoFilter = 'TODOS'; // 'TODOS' | 'TRAFO' | 'FUSIVEL' | 'RELIGADOR'
let elementoSearchTerm = ''; // texto de busca (normalizado)
let currentRankingCausaData = [];
let currentRankingAlimentadorData = [];

/**
 * Listener global para export do modal de relatório por alimentadores
 * (o modal dispara CustomEvent 'export-alimentador-report')
 */
window.addEventListener('export-alimentador-report', (e) => {
  const selected = e?.detail?.selected || [];
  exportAlimentadorReport(selected);
});

export function renderRankingCausa(data) {
  const ranking = generateRankingByField(data, 'CAUSA');
  currentRankingCausaData = ranking;
  renderRankingGeneric('rankingCausa', ranking, (name, ocorrencias) =>
    openGenericDetails('CAUSA', name, ocorrencias)
  );
}

export function renderRankingAlimentador(data) {
  const ranking = generateRankingByField(data, 'ALIMENT.');
  currentRankingAlimentadorData = ranking;

  renderRankingGeneric('rankingAlimentador', ranking, (name, ocorrencias) =>
    openGenericDetails('ALIMENTADOR', name, ocorrencias)
  );

  // cria/injeta botão "Relatório" no card do Ranking por Alimentador
  ensureAlimentadorReportButton();
}

export function setElementoFilter(filter) {
  currentElementoFilter = String(filter || '').toUpperCase();
  renderRankingList(getFilteredRanking(currentRankingData));
}

export function setElementoSearch(term) {
  elementoSearchTerm = String(term || '').trim().toUpperCase();
  renderRankingList(getFilteredRanking(currentRankingData));
}

/**
 * Classificação de tipo:
 * - T* => TRAFO
 * - F* => FUSIVEL
 * - demais => RELIGADOR
 */
function getElementoTipo(elemento) {
  const el = String(elemento || '').trim().toUpperCase();
  const first = el.charAt(0);
  if (first === 'T') return 'TRAFO';
  if (first === 'F') return 'FUSIVEL';
  return 'RELIGADOR';
}

function getFilteredRanking(ranking) {
  const normalize = (v) => String(v || '').trim().toUpperCase();

  let result = ranking.filter((item) => {
    const el = normalize(item.elemento);
    const tipo = getElementoTipo(el);

    if (currentElementoFilter === 'TODOS') return true;
    if (currentElementoFilter === 'TRAFO') return tipo === 'TRAFO';
    if (currentElementoFilter === 'FUSIVEL') return tipo === 'FUSIVEL';
    if (currentElementoFilter === 'RELIGADOR') return tipo === 'RELIGADOR';
    return true;
  });

  if (elementoSearchTerm) {
    result = result.filter((item) => normalize(item.elemento).includes(elementoSearchTerm));
  }

  return result;
}

function updateRankingTotal(ranking) {
  const el = document.getElementById('rankingElementoTotal');
  if (!el) return;
  const total = Array.isArray(ranking) ? ranking.length : 0;
  el.textContent = `Reinteradas: ${total}`;
}

/**
 * Ranking por Elemento
 * - Remove botão "Ver mais"
 * - Renderiza em lotes até o final (scroll normal)
 */
function renderRankingList(ranking) {
  const container = document.getElementById('rankingElemento');
  if (!container) return;

  updateRankingTotal(ranking);

  if (!ranking || ranking.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; padding: 2rem; color: var(--medium-gray);">Nenhum elemento encontrado para este filtro.</p>';
    return;
  }

  container.innerHTML = '';

  const BATCH_SIZE = 200;
  let i = 0;

  const renderNextBatch = () =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        const frag = document.createDocumentFragment();

        const end = Math.min(i + BATCH_SIZE, ranking.length);
        for (; i < end; i++) {
          const item = ranking[i];

          const itemDiv = document.createElement('div');
          itemDiv.className = 'ranking-item';
          itemDiv.onclick = () => openElementDetails(item.elemento, item.ocorrencias);

          const position = document.createElement('span');
          position.className = 'ranking-item-position';
          position.textContent = `${i + 1}º`;

          const name = document.createElement('span');
          name.className = 'ranking-item-name';
          name.textContent = item.elemento;

          const count = document.createElement('span');
          count.className = 'ranking-item-count';
          count.textContent = `(${item.count} vezes)`;

          itemDiv.appendChild(position);
          itemDiv.appendChild(name);
          itemDiv.appendChild(count);

          frag.appendChild(itemDiv);
        }

        container.appendChild(frag);
        resolve();
      });
    });

  (async () => {
    while (i < ranking.length) {
      await renderNextBatch();
    }
  })();
}

/**
 * Renderizar ranking por ELEMENTO
 */
export function renderRankingElemento(data) {
  allData = data;

  const ranking = generateRankingElemento(data);
  currentRankingData = ranking;

  const filtered = getFilteredRanking(ranking);
  renderRankingList(filtered);
}

/**
 * Abrir detalhes genéricos (CAUSA / ALIMENTADOR)
 */
function openGenericDetails(tipo, nome, ocorrencias) {
  const modalTitle = document.getElementById('detalhesTitulo');
  if (modalTitle) modalTitle.textContent = `${tipo}: ${nome}`;

  const modalContent = document.getElementById('detalhesConteudo');
  let selectedColumns = [];

  if (modalContent && modalContent.dataset.selectedColumns) {
    try {
      selectedColumns = JSON.parse(modalContent.dataset.selectedColumns);
    } catch (e) {
      selectedColumns = [];
    }
  }

  fillDetailsModal(nome, ocorrencias, selectedColumns);
  openModal('modalDetalhes');
}

/**
 * Abrir detalhes de um elemento
 */
function openElementDetails(elemento, ocorrencias) {
  const modalContent = document.getElementById('detalhesConteudo');
  let selectedColumns = [];

  if (modalContent && modalContent.dataset.selectedColumns) {
    try {
      selectedColumns = JSON.parse(modalContent.dataset.selectedColumns);
    } catch (e) {
      selectedColumns = [];
    }
  }

  fillDetailsModal(elemento, ocorrencias, selectedColumns);
  openModal('modalDetalhes');
}

/**
 * Atualizar ranking com novos dados
 */
export function updateRanking(data) {
  renderRankingElemento(data);
  renderRankingCausa(data);
  renderRankingAlimentador(data);
}

function normalizeKey(k) {
  return String(k || '').trim().toLowerCase().replace(/\./g, '');
}

function getFieldValue(row, fieldName) {
  if (!row) return '';

  if (row[fieldName] != null) return row[fieldName];

  const noDot = String(fieldName).replace(/\./g, '');
  if (row[noDot] != null) return row[noDot];

  const target = normalizeKey(fieldName);
  const foundKey = Object.keys(row).find((k) => normalizeKey(k) === target);
  if (foundKey) return row[foundKey];

  return '';
}

function generateRankingByField(data, field) {
  const counts = new Map();
  const ocorrenciasMap = new Map();

  data.forEach((row) => {
    const value = String(getFieldValue(row, field) || '').trim();
    if (!value) return;

    counts.set(value, (counts.get(value) || 0) + 1);

    if (!ocorrenciasMap.has(value)) ocorrenciasMap.set(value, []);
    ocorrenciasMap.get(value).push(row);
  });

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count, ocorrencias: ocorrenciasMap.get(name) }))
    .sort((a, b) => b.count - a.count);
}

function renderRankingGeneric(containerId, ranking, onClick) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!ranking.length) {
    container.innerHTML =
      '<p style="text-align:center; padding: 2rem; color: var(--medium-gray);">Nenhum dado.</p>';
    return;
  }

  container.innerHTML = '';

  ranking.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'ranking-item';
    div.onclick = () => onClick(item.name, item.ocorrencias);

    div.innerHTML = `
      <span class="ranking-item-position">${idx + 1}º</span>
      <span class="ranking-item-name">${item.name}</span>
      <span class="ranking-item-count">(${item.count} vezes)</span>
    `;

    container.appendChild(div);
  });
}

/**
 * Cria/injeta botão "Relatório" no card do Ranking por Alimentador
 */
function ensureAlimentadorReportButton() {
  const listEl = document.getElementById('rankingAlimentador');
  if (!listEl) return;

  const card = listEl.closest('.card') || listEl.parentElement;
  if (!card) return;

  if (card.querySelector('#btnRelatorioAlimentador')) return;

  const cs = window.getComputedStyle(card);
  if (cs.position === 'static') card.style.position = 'relative';

  const btn = document.createElement('button');
  btn.id = 'btnRelatorioAlimentador';
  btn.className = 'btn btn-primary btn-sm';
  btn.textContent = 'Relatório';
  btn.style.position = 'absolute';
  btn.style.right = '12px';
  btn.style.bottom = '12px';
  btn.style.zIndex = '5';

  btn.onclick = () => {
    const nomes = (currentRankingAlimentadorData || []).map((x) => x.name).filter(Boolean);
    buildAlimentadorReportModal(nomes);
    openModal('modalRelatorioAlimentador');
  };

  card.appendChild(btn);
}

/**
 * Exporta XLSX com a junção das ocorrências dos alimentadores selecionados
 */
function exportAlimentadorReport(selectedAlimentadores) {
  if (!window.XLSX) {
    alert('Biblioteca XLSX não carregada. Inclua o SheetJS no index.html.');
    return;
  }

  const selectedSet = new Set(
    (selectedAlimentadores || []).map((x) => String(x || '').trim()).filter(Boolean)
  );

  if (!selectedSet.size) {
    alert('Seleção vazia.');
    return;
  }

  const rows = [];
  (currentRankingAlimentadorData || []).forEach((item) => {
    if (selectedSet.has(item.name)) {
      (item.ocorrencias || []).forEach((r) => rows.push(r));
    }
  });

  if (!rows.length) {
    alert('Não há ocorrências para os alimentadores selecionados.');
    return;
  }

  const headersSet = new Set();
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => headersSet.add(k)));
  const headers = Array.from(headersSet);

  const aoa = [];
  aoa.push(headers);

  rows.forEach((r) => {
    const line = headers.map((h) => {
      const v = r?.[h];
      return v == null ? '' : String(v);
    });
    aoa.push(line);
  });

  const ws = window.XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = headers.map((h, i) => {
    let maxLen = String(h || '').length;
    for (let r = 1; r < Math.min(aoa.length, 300); r++) {
      maxLen = Math.max(maxLen, String(aoa[r][i] || '').length);
    }
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
  });

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Relatorio');

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
    now.getHours()
  )}${pad(now.getMinutes())}`;

  const fileName = `Relatorio_Alimentadores_${stamp}.xlsx`;
  window.XLSX.writeFile(wb, fileName);
}
