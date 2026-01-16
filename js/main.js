/**
 * Script Principal - Dashboard
 */

import { DataService } from './services/firebase-service.js';
import { filterByDateRange, getAllColumns, getOcorrenciasByElemento } from './services/data-service.js';
import { renderRankingElemento, generateRankingText } from './components/ranking.js';
import { updateCharts } from './components/charts.js';
import { updateHeatmap, initMap } from './components/mapa.js';
import { openModal, closeModal, initModalEvents, fillDetailsModal } from './components/modal.js';
import { copyToClipboard, showToast, debounce } from './utils/helpers.js';

let currentData = [];
let selectedAdditionalColumns = [];

/**
 * Inicializar aplicação
 */
async function init() {
    // Inicializar eventos
    initModalEvents();
    initEventListeners();
    initMap();

    // Carregar dados
    await loadData();
}

/**
 * Inicializar event listeners
 */
function initEventListeners() {
    // Filtro de data
    const aplicarFiltro = document.getElementById('aplicarFiltro');
    const limparFiltro = document.getElementById('limparFiltro');
    
    if (aplicarFiltro) {
        aplicarFiltro.addEventListener('click', applyFilters);
    }
    
    if (limparFiltro) {
        limparFiltro.addEventListener('click', clearFilters);
    }

    // Copiar ranking
    const copiarRanking = document.getElementById('copiarRanking');
    if (copiarRanking) {
        copiarRanking.addEventListener('click', async () => {
            const text = generateRankingText();
            const result = await copyToClipboard(text);
            
            if (result.success) {
                showToast('Ranking copiado para a área de transferência!', 'success');
            } else {
                showToast('Erro ao copiar. Tente novamente.', 'error');
            }
        });
    }

    // Modal de detalhes
    const fecharModal = document.getElementById('fecharModal');
    if (fecharModal) {
        fecharModal.addEventListener('click', () => {
            closeModal('modalDetalhes');
        });
    }

    // Modal adicionar info
    const btnAdicionarInfo = document.getElementById('btnAdicionarInfo');
    const fecharModalInfo = document.getElementById('fecharModalInfo');
    const confirmarInfo = document.getElementById('confirmarInfo');
    const cancelarInfo = document.getElementById('cancelarInfo');

    if (btnAdicionarInfo) {
        btnAdicionarInfo.addEventListener('click', () => {
            openModalAddInfo();
        });
    }

    if (fecharModalInfo) {
        fecharModalInfo.addEventListener('click', () => {
            closeModal('modalAdicionarInfo');
        });
    }

    if (cancelarInfo) {
        cancelarInfo.addEventListener('click', () => {
            closeModal('modalAdicionarInfo');
        });
    }

    if (confirmarInfo) {
        confirmarInfo.addEventListener('click', () => {
            confirmAddInfo();
        });
    }
}

/**
 * Carregar dados do Firestore
 */
async function loadData() {
    const rankingContainer = document.getElementById('rankingElemento');
    if (rankingContainer) {
        rankingContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Carregando dados...</div>';
    }

    const result = await DataService.getData();
    
    if (result.success && result.data.length > 0) {
        currentData = result.data;
        renderAll();
    } else {
        if (rankingContainer) {
            rankingContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--medium-gray);">Nenhum dado disponível. Faça upload de uma planilha no painel administrativo.</p>';
        }
        showToast('Nenhum dado encontrado. Faça upload de uma planilha.', 'error');
    }
}

/**
 * Renderizar todos os componentes
 * OTIMIZADO: Renderização assíncrona para não travar a UI com grandes volumes
 */
function renderAll() {
    if (currentData.length === 0) return;

    console.log(`[RENDER] Renderizando ${currentData.length} registros...`);
    
    // Renderizar assincronamente usando requestAnimationFrame
    requestAnimationFrame(() => {
        renderRankingElemento(currentData);
    });
    
    requestAnimationFrame(() => {
        updateCharts(currentData);
    });
    
    requestAnimationFrame(() => {
        updateHeatmap(currentData);
    });
    
    console.log('[RENDER] Renderização iniciada (assíncrona)');
}

/**
 * Aplicar filtros
 * OTIMIZADO: Com debounce para melhor performance com grandes volumes
 */
const applyFiltersDebounced = debounce(() => {
    const dataInicial = document.getElementById('dataInicial')?.value;
    const dataFinal = document.getElementById('dataFinal')?.value;

    const filteredData = filterByDateRange(currentData, dataInicial, dataFinal);
    
    // Renderizar assincronamente para não travar a UI
    requestAnimationFrame(() => {
        renderRankingElemento(filteredData);
        updateCharts(filteredData);
        updateHeatmap(filteredData);
        
        showToast(`Filtro aplicado: ${filteredData.length} registro(s) encontrado(s).`, 'success');
    });
}, 300); // 300ms de debounce

function applyFilters() {
    applyFiltersDebounced();
}

/**
 * Limpar filtros
 */
function clearFilters() {
    document.getElementById('dataInicial').value = '';
    document.getElementById('dataFinal').value = '';
    
    renderAll();
    showToast('Filtros removidos.', 'success');
}

/**
 * Abrir modal para adicionar informações
 */
function openModalAddInfo() {
    const allColumns = getAllColumns(currentData);
    const fixedColumns = ['INCIDENCIA', 'CAUSA', 'ALIMENT.', 'DATA', 'ELEMENTO', 'CONJUNTO'];
    const nonFixedColumns = allColumns.filter(col => {
        const normalized = col.toUpperCase().trim().replace(/\./g, '');
        return !fixedColumns.includes(normalized);
    });

    const listaColunas = document.getElementById('listaColunas');
    if (!listaColunas) return;

    listaColunas.innerHTML = '';

    nonFixedColumns.forEach(col => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'coluna-checkbox';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `col_${col}`;
        checkbox.value = col;
        checkbox.checked = selectedAdditionalColumns.includes(col);

        const label = document.createElement('label');
        label.htmlFor = `col_${col}`;
        label.textContent = col;

        checkboxDiv.appendChild(checkbox);
        checkboxDiv.appendChild(label);
        listaColunas.appendChild(checkboxDiv);
    });

    openModal('modalAdicionarInfo');
}

/**
 * Confirmar adição de informações
 */
function confirmAddInfo() {
    const checkboxes = document.querySelectorAll('#listaColunas input[type="checkbox"]:checked');
    selectedAdditionalColumns = Array.from(checkboxes).map(cb => cb.value);

    // Recuperar elemento atual do modal de detalhes
    const modalContent = document.getElementById('detalhesConteudo');
    if (modalContent && modalContent.dataset.elemento) {
        const elemento = modalContent.dataset.elemento;
        const ocorrencias = getOcorrenciasByElemento(currentData, elemento);
        
        fillDetailsModal(elemento, ocorrencias, selectedAdditionalColumns);
    }

    closeModal('modalAdicionarInfo');
    showToast('Informações adicionais atualizadas.', 'success');
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

