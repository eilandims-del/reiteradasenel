/**
 * Funções Auxiliares
 */

/**
 * Exibir toast notification
 */
export function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Formatar data para exibição
 */
export function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    } catch (e) {
        return dateString;
    }
}

/**
 * Copiar texto para clipboard
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return { success: true };
    } catch (err) {
        // Fallback para navegadores antigos
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return { success: true };
        } catch (e) {
            document.body.removeChild(textArea);
            return { success: false, error: e.message };
        }
    }
}

/**
 * Formatador de número (adiciona separadores)
 */
export function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num);
}

/**
 * Validar email
 */
export function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Formatar URL de incidência
 */
export function formatIncidenciaUrl(incidencia) {
    if (!incidencia) return null;
    
    // Remove espaços e caracteres especiais
    const cleaned = String(incidencia).trim();
    return `http://sdeice.enelint.global/SAC_Detalhe_Inci.asp?inci_ref=${cleaned}`;
}

/**
 * Obter colunas não fixas (todas exceto as obrigatórias)
 */
export function getNonFixedColumns(headers) {
    const fixedColumns = ['INCIDENCIA', 'CAUSA', 'ALIMENT.', 'DATA', 'ELEMENTO', 'CONJUNTO'];
    const normalizedFixed = fixedColumns.map(c => c.toUpperCase().replace(/\s+/g, ' '));
    
    return headers.filter(header => {
        const normalized = header.toUpperCase().replace(/\s+/g, ' ');
        return !normalizedFixed.includes(normalized);
    });
}

