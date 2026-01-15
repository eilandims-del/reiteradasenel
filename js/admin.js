/**
 * Script do Painel Administrativo
 */

import { AuthService, DataService } from './services/firebase-service.js';
import { parseFile } from './utils/file-parser.js';
import { showToast } from './utils/helpers.js';

let currentUser = null;

/**
 * Inicializar painel administrativo
 */
function init() {
    initEventListeners();
    checkAuthState();
}

/**
 * Verificar estado de autenticação
 */
function checkAuthState() {
    AuthService.onAuthStateChanged((user) => {
        currentUser = user;
        
        if (user) {
            showAdminSection();
            loadUploadHistory();
        } else {
            showLoginSection();
        }
    });
}

/**
 * Mostrar seção de login
 */
function showLoginSection() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('adminSection').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
}

/**
 * Mostrar seção administrativa
 */
function showAdminSection() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('adminSection').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'block';
}

/**
 * Inicializar event listeners
 */
function initEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleLogin();
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await handleLogout();
        });
    }

    // File input
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');

    if (dropZone) {
        dropZone.addEventListener('click', () => {
            fileInput?.click();
        });

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                await handleFileUpload(files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await handleFileUpload(file);
            }
        });
    }
}

/**
 * Manipular login
 */
async function handleLogin() {
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const errorDiv = document.getElementById('loginError');

    const result = await AuthService.login(email, senha);

    if (result.success) {
        errorDiv.classList.remove('show');
        errorDiv.textContent = '';
        showToast('Login realizado com sucesso!', 'success');
    } else {
        errorDiv.textContent = result.error || 'Erro ao fazer login';
        errorDiv.classList.add('show');
        showToast('Erro ao fazer login. Verifique suas credenciais.', 'error');
    }
}

/**
 * Manipular logout
 */
async function handleLogout() {
    const result = await AuthService.logout();
    
    if (result.success) {
        showToast('Logout realizado com sucesso!', 'success');
        showLoginSection();
    }
}

/**
 * Manipular upload de arquivo
 */
async function handleFileUpload(file) {
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const uploadResult = document.getElementById('uploadResult');
    const dropZone = document.getElementById('dropZone');

    // Verificar se usuário está autenticado
    if (!currentUser) {
        showToast('Você precisa estar logado para fazer upload.', 'error');
        return;
    }

    // Mostrar progresso
    uploadProgress.style.display = 'block';
    uploadResult.style.display = 'none';
    progressFill.style.width = '10%';
    progressText.textContent = 'Lendo arquivo...';

    try {
        // Parsear arquivo
        progressFill.style.width = '30%';
        progressText.textContent = 'Processando arquivo...';

        const parsed = await parseFile(file);
        
        progressFill.style.width = '50%';
        progressText.textContent = 'Validando dados...';

        // Gerar ID do upload
        const uploadId = DataService.generateUploadId();

        progressFill.style.width = '70%';
        progressText.textContent = 'Salvando no banco de dados...';

        // Salvar no Firestore
        const saveResult = await DataService.saveData(parsed.data, {
            uploadId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || 'unknown',
            totalColumns: parsed.headers.length,
            columns: parsed.headers
        });

        if (saveResult.success) {
            progressFill.style.width = '100%';
            progressText.textContent = 'Concluído!';
            
            uploadResult.className = 'upload-result success';
            uploadResult.innerHTML = `
                <strong>✓ Upload realizado com sucesso!</strong><br>
                Arquivo: ${file.name}<br>
                Registros processados: ${saveResult.count}<br>
                Colunas: ${parsed.headers.length}
            `;
            uploadResult.style.display = 'block';

            showToast(`Upload concluído: ${saveResult.count} registro(s) processado(s).`, 'success');

            // Limpar input
            document.getElementById('fileInput').value = '';

            // Recarregar histórico
            setTimeout(() => {
                loadUploadHistory();
                uploadProgress.style.display = 'none';
            }, 2000);
        } else {
            throw new Error(saveResult.error || 'Erro ao salvar dados');
        }

    } catch (error) {
        console.error('Erro no upload:', error);
        
        uploadResult.className = 'upload-result error';
        uploadResult.innerHTML = `
            <strong>✗ Erro no upload:</strong><br>
            ${error.message}
        `;
        uploadResult.style.display = 'block';
        uploadProgress.style.display = 'none';

        showToast(`Erro: ${error.message}`, 'error');
    }
}

/**
 * Carregar histórico de uploads
 */
async function loadUploadHistory() {
    const historyContainer = document.getElementById('uploadHistory');
    if (!historyContainer) return;

    historyContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Carregando histórico...</div>';

    const result = await DataService.getUploadHistory();

    if (result.success && result.history.length > 0) {
        historyContainer.innerHTML = '';

        result.history.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';

            const date = item.uploadedAt?.toDate ? 
                item.uploadedAt.toDate().toLocaleString('pt-BR') : 
                'Data não disponível';

            historyItem.innerHTML = `
                <div class="history-info">
                    <h3>${item.fileName || 'Arquivo sem nome'}</h3>
                    <p>Upload em: ${date}</p>
                    <p>Por: ${item.uploadedBy || 'Desconhecido'}</p>
                </div>
                <div>
                    <span class="history-badge success">${item.totalRecords || 0} registros</span>
                </div>
            `;

            historyContainer.appendChild(historyItem);
        });
    } else {
        historyContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--medium-gray);">Nenhum upload realizado ainda.</p>';
    }
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

