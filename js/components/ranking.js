/**
 * Componente Ranking - Exibição e gerenciamento de rankings
 */

import { generateRankingElemento, getOcorrenciasByElemento } from '../services/data-service.js';
import { openModal, fillDetailsModal } from './modal.js';

let currentRankingData = [];
let allData = [];

/**
 * Renderizar ranking por ELEMENTO
 */
export function renderRankingElemento(data) {
    allData = data;
    const ranking = generateRankingElemento(data);
    currentRankingData = ranking;
    
    const container = document.getElementById('rankingElemento');
    if (!container) return;

    if (ranking.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--medium-gray);">Nenhum elemento com mais de uma ocorrência encontrado.</p>';
        return;
    }

    container.innerHTML = '';

    ranking.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'ranking-item';
        itemDiv.onclick = () => openElementDetails(item.elemento, item.ocorrencias);

        const position = document.createElement('span');
        position.className = 'ranking-item-position';
        position.textContent = `${index + 1}º`;

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

