/**
 * Componente Ranking - Exibição e gerenciamento de rankings
 */

import { generateRankingElemento, getOcorrenciasByElemento } from '../services/data-service.js';
import { openModal, fillDetailsModal } from './modal.js';

let currentRankingData = [];
let allData = [];
let currentElementoFilter = 'TRAFO'; // padrão (pode ser 'TRAFO' | 'FUSIVEL' | 'OUTROS')

export function setElementoFilter(filter) {
    currentElementoFilter = filter;
    // re-render usando o ranking já calculado mais recente
    renderRankingList(getFilteredRanking(currentRankingData));
}

function getFilteredRanking(ranking) {
    const normalize = (v) => String(v || '').trim().toUpperCase();

    return ranking.filter(item => {
        const el = normalize(item.elemento);
        const first = el.charAt(0);

        if (currentElementoFilter === 'TRAFO') return first === 'T';
        if (currentElementoFilter === 'FUSIVEL') return first === 'F';
        if (currentElementoFilter === 'OUTROS') return first !== 'T' && first !== 'F';
        return true;
    });
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
    
    const container = document.getElementById('rankingElemento');
    if (!container) return;

    if (ranking.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--medium-gray);">Nenhum elemento com mais de uma ocorrência encontrado.</p>';
        return;
    }

    // Limitar renderização inicial para melhor performance (top 100)
    const INITIAL_DISPLAY = 100;
    const hasMore = ranking.length > INITIAL_DISPLAY;
    
    container.innerHTML = '';

    // Renderizar assincronamente usando requestAnimationFrame para não travar a UI
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

    // Renderizar inicialmente os primeiros itens
    renderBatch(0, INITIAL_DISPLAY).then(() => {
        if (hasMore) {
            // Adicionar botão "Ver mais" se houver mais itens
            const showMoreBtn = document.createElement('button');
            showMoreBtn.className = 'btn btn-secondary btn-sm';
            showMoreBtn.style.marginTop = '1rem';
            showMoreBtn.style.width = '100%';
            showMoreBtn.innerHTML = `<i class="fas fa-chevron-down"></i> Ver mais (${ranking.length - INITIAL_DISPLAY} restantes)`;
            
            let currentEnd = INITIAL_DISPLAY;
            const BATCH_SIZE = 50; // Renderizar 50 por vez ao clicar
            
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
    if (currentRankingData.length === 0) {
        return 'Nenhum ranking disponível.';
    }

    let text = '📊 *RANKING DE REINTERADAS - ELEMENTO*\n\n';
    
    currentRankingData.forEach((item, index) => {
        text += `${index + 1} - ${item.elemento} (${item.count} vezes)\n`;
    });

    return text;
}

/**
 * Atualizar ranking com novos dados
 */
export function updateRanking(data) {
    renderRankingElemento(data);
}

