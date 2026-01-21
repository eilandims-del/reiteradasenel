/**
 * Componente Ranking - Exibição e gerenciamento de rankings
 */

import { generateRankingElemento, getOcorrenciasByElemento } from '../services/data-service.js';
import { openModal, fillDetailsModal } from './modal.js';

let currentRankingData = [];
let allData = [];
let currentElementoFilter = 'TRAFO'; // 'TRAFO' | 'FUSIVEL' | 'OUTROS'
let elementoSearchTerm = ''; // texto de busca (normalizado)
let currentRankingCausaData = [];
let currentRankingAlimentadorData = [];

export function renderRankingCausa(data){
    const ranking = generateRankingByField(data, 'CAUSA');
    currentRankingCausaData = ranking;
    renderRankingGeneric('rankingCausa', ranking, (name, ocorrencias) => openGenericDetails('CAUSA', name, ocorrencias));
  }
  
  export function renderRankingAlimentador(data){
    const ranking = generateRankingByField(data, 'ALIMENT.');
    currentRankingAlimentadorData = ranking;
    renderRankingGeneric('rankingAlimentador', ranking, (name, ocorrencias) => openGenericDetails('ALIMENTADOR', name, ocorrencias));
  }
  
  
export function setElementoFilter(filter) {
    currentElementoFilter = filter;
    renderRankingList(getFilteredRanking(currentRankingData));
  }
  
  export function setElementoSearch(term) {
    elementoSearchTerm = String(term || '').trim().toUpperCase();
    renderRankingList(getFilteredRanking(currentRankingData));
  }
  
  function getFilteredRanking(ranking) {
    const normalize = (v) => String(v || '').trim().toUpperCase();
  
    let result = ranking.filter(item => {
      const el = normalize(item.elemento);
      const first = el.charAt(0);
  
      if (currentElementoFilter === 'TRAFO') return first === 'T';
      if (currentElementoFilter === 'FUSIVEL') return first === 'F';
      if (currentElementoFilter === 'OUTROS') return first !== 'T' && first !== 'F';
      return true;
    });
  
    if (elementoSearchTerm) {
      result = result.filter(item => normalize(item.elemento).includes(elementoSearchTerm));
    }
  
    return result;
  }
  

function renderRankingList(ranking) {
    const container = document.getElementById('rankingElemento');
    if (!container) return;

    if (ranking.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--medium-gray);">Nenhum elemento encontrado para este filtro.</p>';
        return;
    }

    const INITIAL_DISPLAY = 100;
    const hasMore = ranking.length > INITIAL_DISPLAY;

    container.innerHTML = '';

    const renderBatch = (startIndex, endIndex) => {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                for (let i = startIndex; i < endIndex && i < ranking.length; i++) {
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
                    container.appendChild(itemDiv);
                }
                resolve();
            });
        });
    };

    renderBatch(0, INITIAL_DISPLAY).then(() => {
        if (hasMore) {
            const showMoreBtn = document.createElement('button');
            showMoreBtn.className = 'btn btn-secondary btn-sm';
            showMoreBtn.style.marginTop = '1rem';
            showMoreBtn.style.width = '100%';
            showMoreBtn.innerHTML = `<i class="fas fa-chevron-down"></i> Ver mais (${ranking.length - INITIAL_DISPLAY} restantes)`;

            let currentEnd = INITIAL_DISPLAY;
            const BATCH_SIZE = 50;

            showMoreBtn.onclick = async () => {
                showMoreBtn.disabled = true;
                showMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';

                const nextEnd = Math.min(currentEnd + BATCH_SIZE, ranking.length);
                await renderBatch(currentEnd, nextEnd);
                currentEnd = nextEnd;

                if (currentEnd >= ranking.length) {
                    showMoreBtn.remove();
                } else {
                    showMoreBtn.disabled = false;
                    showMoreBtn.innerHTML = `<i class="fas fa-chevron-down"></i> Ver mais (${ranking.length - currentEnd} restantes)`;
                }
            };

            container.appendChild(showMoreBtn);
        }
    });
}

/**
 * Renderizar ranking por ELEMENTO
 * OTIMIZADO: Renderização assíncrona e paginação para suportar 10k+ registros
 */
export function renderRankingElemento(data) {
    allData = data;

    const ranking = generateRankingElemento(data);
    currentRankingData = ranking;

    const filtered = getFilteredRanking(ranking);
    renderRankingList(filtered);
}

function openGenericDetails(tipo, nome, ocorrencias) {
    // Reaproveita o mesmo modal de detalhes
    // Aqui você pode mudar o título do modal se existir um header
    const modalTitle = document.getElementById('detalhesTitulo');
    if (modalTitle) modalTitle.textContent = `${tipo}: ${nome}`;
  
    const modalContent = document.getElementById('detalhesConteudo');
    let selectedColumns = [];
  
    if (modalContent && modalContent.dataset.selectedColumns) {
      try { selectedColumns = JSON.parse(modalContent.dataset.selectedColumns); }
      catch (e) { selectedColumns = []; }
    }
  
    fillDetailsModal(nome, ocorrencias, selectedColumns);
    openModal('modalDetalhes');
  }
  
/**
 * Abrir detalhes de um elemento
 */
function openElementDetails(elemento, ocorrencias) {
    // Recuperar colunas selecionadas anteriormente (se houver)
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
 * Gerar texto do ranking para copiar (WhatsApp)
 */
export function generateRankingText() {
    if (currentRankingData.length === 0) return 'Nenhum ranking disponível.';

    const view = getFilteredRanking(currentRankingData);

    let text = '📊 *RANKING DE REINTERADAS - ELEMENTO*\n\n';
    view.forEach((item, index) => {
        text += `${index + 1} - ${item.elemento} (${item.count} vezes)\n`;
    });

    return text;
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
    return String(k || '')
      .trim()
      .toLowerCase()
      .replace(/\./g, ''); // remove pontos (ALIMENT. -> aliment)
  }
  
  function getFieldValue(row, fieldName) {
    if (!row) return '';
  
    // tenta direto
    if (row[fieldName] != null) return row[fieldName];
  
    const target = normalizeKey(fieldName);
  
    // tenta achar chave equivalente ignorando case/espacos/pontos
    const foundKey = Object.keys(row).find(k => normalizeKey(k) === target);
    if (foundKey) return row[foundKey];
  
    return '';
  }
  
  
  function generateRankingByField(data, field) {
    const counts = new Map();
    const ocorrenciasMap = new Map();
  
    data.forEach(row => {
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
      container.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--medium-gray);">Nenhum dado.</p>';
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
  