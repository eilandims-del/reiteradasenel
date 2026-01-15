/**
 * Componente Modal - Gerenciamento de Modais
 */

/**
 * Abrir modal
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Fechar modal
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Inicializar eventos de fechamento de modal
 */
export function initModalEvents() {
    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                closeModal(activeModal.id);
            }
        }
    });
}

/**
 * Preencher modal de detalhes
 */
export function fillDetailsModal(elemento, ocorrencias, selectedColumns = []) {
    const modalContent = document.getElementById('detalhesConteudo');
    if (!modalContent) return;

    // Limpar conteúdo anterior
    modalContent.innerHTML = '';

    // Ordem fixa dos campos principais
    const fixedFields = [
        { key: 'INCIDENCIA', label: 'INCIDÊNCIA' },
        { key: 'ELEMENTO', label: 'ELEMENTO' },
        { key: 'DATA', label: 'DATA' },
        { key: 'CAUSA', label: 'CAUSA' },
        { key: 'ALIMENT.', label: 'ALIMENTADOR' },
        { key: 'CONJUNTO', label: 'CONJUNTO' }
    ];

    // Processar cada ocorrência
    ocorrencias.forEach((ocorrencia, index) => {
        const ocorrenciaDiv = document.createElement('div');
        ocorrenciaDiv.className = 'ocorrencia-group';
        ocorrenciaDiv.style.marginBottom = '2rem';
        ocorrenciaDiv.style.paddingBottom = '2rem';
        ocorrenciaDiv.style.borderBottom = index < ocorrencias.length - 1 ? '2px solid var(--light-gray)' : 'none';

        // Adicionar título da ocorrência
        const titulo = document.createElement('h3');
        titulo.textContent = `Ocorrência ${index + 1} de ${ocorrencias.length}`;
        titulo.style.color = 'var(--primary-blue)';
        titulo.style.marginBottom = '1rem';
        ocorrenciaDiv.appendChild(titulo);

        // Campos fixos
        fixedFields.forEach(field => {
            // Buscar pela chave original, normalizada, e variações
            // Para DATA, tentar várias variações incluindo busca em todas as chaves
            let value = ocorrencia[field.key] || 
                       ocorrencia[normalizeKey(field.key)] || 
                       ocorrencia[field.key.replace(/\./g, '')] ||
                       ocorrencia[field.key.toUpperCase()] ||
                       ocorrencia[field.key.toLowerCase()] ||
                       null;
            
            // Se ainda não encontrou, buscar em todas as chaves (caso esteja normalizada)
            if (!value || value === null || value === undefined) {
                const normalizedField = normalizeKey(field.key);
                for (const key in ocorrencia) {
                    if (normalizeKey(key) === normalizedField) {
                        value = ocorrencia[key];
                        break;
                    }
                }
            }
            
            // Se ainda não encontrou, usar 'N/A'
            if (!value || value === null || value === undefined || value === '') {
                value = 'N/A';
            }
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'detalhe-item';

            const label = document.createElement('span');
            label.className = 'detalhe-label';
            label.textContent = field.label + ':';

            const valueSpan = document.createElement('span');
            valueSpan.className = 'detalhe-value';

            // Tratamento especial para INCIDENCIA
            if (field.key === 'INCIDENCIA' && value !== 'N/A') {
                const url = formatIncidenciaUrl(value);
                if (url) {
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    link.textContent = value;
                    valueSpan.appendChild(link);
                } else {
                    valueSpan.textContent = value;
                }
            } else if (field.key === 'DATA' && value !== 'N/A') {
                valueSpan.textContent = formatDate(value);
            } else {
                valueSpan.textContent = value;
            }

            itemDiv.appendChild(label);
            itemDiv.appendChild(valueSpan);
            ocorrenciaDiv.appendChild(itemDiv);
        });

        // Campos adicionais selecionados
        if (selectedColumns.length > 0) {
            selectedColumns.forEach(colKey => {
                const value = ocorrencia[colKey] || ocorrencia[normalizeKey(colKey)] || 'N/A';
                
                if (value !== 'N/A') {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'detalhe-item';

                    const label = document.createElement('span');
                    label.className = 'detalhe-label';
                    label.textContent = colKey + ':';

                    const valueSpan = document.createElement('span');
                    valueSpan.className = 'detalhe-value';
                    valueSpan.textContent = value;

                    itemDiv.appendChild(label);
                    itemDiv.appendChild(valueSpan);
                    ocorrenciaDiv.appendChild(itemDiv);
                }
            });
        }

        modalContent.appendChild(ocorrenciaDiv);
    });

    // Salvar dados para uso posterior
    modalContent.dataset.elemento = elemento;
    modalContent.dataset.selectedColumns = JSON.stringify(selectedColumns);
}

/**
 * Normalizar chave (remove espaços, acentos)
 */
function normalizeKey(key) {
    return key.toUpperCase().trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\./g, '');
}

/**
 * Formatar URL de incidência
 */
function formatIncidenciaUrl(incidencia) {
    if (!incidencia) return null;
    const cleaned = String(incidencia).trim();
    return `http://sdeice.enelint.global/SAC_Detalhe_Inci.asp?inci_ref=${cleaned}`;
}

/**
 * Formatar data para exibição (DD/MM/YYYY)
 * IMPORTANTE: Parse manual de strings ISO para evitar problemas de timezone
 * Aceita string ISO, Date object, Timestamp do Firestore
 */
function formatDate(dateValue) {
    if (!dateValue) return 'N/A';
    
    try {
        let day, month, year;

        // Se for Timestamp do Firestore
        if (dateValue && typeof dateValue.toDate === 'function') {
            const date = dateValue.toDate(); // Já é Date local
            day = date.getDate();
            month = date.getMonth() + 1;
            year = date.getFullYear();
        }
        // Se for objeto Date
        else if (dateValue instanceof Date) {
            day = dateValue.getDate();
            month = dateValue.getMonth() + 1;
            year = dateValue.getFullYear();
        }
        // Se for string ISO (YYYY-MM-DD) - PARSEAR MANUALMENTE
        else if (typeof dateValue === 'string') {
            const trimmed = dateValue.trim();
            
            // Formato ISO: YYYY-MM-DD - PARSEAR MANUALMENTE (NUNCA new Date())
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                const parts = trimmed.split('-');
                if (parts.length === 3) {
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10);
                    day = parseInt(parts[2], 10);
                } else {
                    return dateValue || 'N/A';
                }
            }
            // Formato brasileiro: DD/MM/YYYY
            else if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/.test(trimmed)) {
                const parts = trimmed.split(/[\/\-\.]/);
                if (parts.length === 3) {
                    day = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10);
                    year = parseInt(parts[2], 10);
                } else {
                    return dateValue || 'N/A';
                }
            }
            // Outro formato - tentar como último recurso
            else {
                const date = new Date(trimmed);
                if (!isNaN(date.getTime())) {
                    day = date.getDate();
                    month = date.getMonth() + 1;
                    year = date.getFullYear();
                } else {
                    return dateValue || 'N/A';
                }
            }
        }
        // Outro tipo
        else {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
                day = date.getDate();
                month = date.getMonth() + 1;
                year = date.getFullYear();
            } else {
                return String(dateValue || 'N/A');
            }
        }

        // Validar valores
        if (!day || !month || !year) {
            return String(dateValue || 'N/A');
        }

        // Formatar para DD/MM/YYYY sem aplicar timezone
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(month).padStart(2, '0');
        const yearStr = String(year);

        return `${dayStr}/${monthStr}/${yearStr}`;
    } catch (e) {
        console.warn('Erro ao formatar data:', dateValue, e);
        return String(dateValue || 'N/A');
    }
}
