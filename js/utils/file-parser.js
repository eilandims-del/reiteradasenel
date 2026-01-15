/**
 * Parser de Arquivos - CSV, XLS, XLSX, XLSB
 */

/**
 * Colunas obrigatórias que devem estar presentes
 */
const REQUIRED_COLUMNS = ['INCIDENCIA', 'CAUSA', 'ALIMENT.', 'DATA', 'ELEMENTO', 'CONJUNTO'];

/**
 * Normalizar nome da coluna (remove espaços, acentos, etc.)
 */
function normalizeColumnName(name) {
    return name.trim().toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\./g, '');
}

/**
 * Validar estrutura do arquivo
 * Note: headers já devem estar normalizados
 */
function validateStructure(headers) {
    // Normalizar as colunas obrigatórias para comparar com headers normalizados
    const normalizedRequiredColumns = REQUIRED_COLUMNS.map(col => normalizeColumnName(col));
    
    // Verificar quais colunas estão faltando
    const missingNormalizedColumns = normalizedRequiredColumns.filter(normalizedCol => 
        !headers.includes(normalizedCol)
    );
    
    if (missingNormalizedColumns.length > 0) {
        // Mapear de volta para nomes originais para mensagem de erro
        const missingOriginalColumns = missingNormalizedColumns.map(normalizedCol => {
            // Tentar encontrar o nome original na lista REQUIRED_COLUMNS
            const original = REQUIRED_COLUMNS.find(col => normalizeColumnName(col) === normalizedCol);
            return original || normalizedCol;
        });
        
        return {
            valid: false,
            error: `Colunas obrigatórias faltando: ${missingOriginalColumns.join(', ')}`
        };
    }

    return { valid: true };
}

/**
 * Normalizar dados da linha
 */
function normalizeRow(row, headers) {
    const normalized = {};
    
    headers.forEach((header, index) => {
        const normalizedHeader = normalizeColumnName(header);
        let value = row[index];
        
        // Tratamento especial para DATA
        if (normalizedHeader === 'DATA') {
            value = parseDate(value);
        } else if (value !== null && value !== undefined) {
            value = String(value).trim();
        } else {
            value = '';
        }
        
        normalized[normalizedHeader] = value;
    });

    return normalized;
}

/**
 * Converter data para formato padrão ISO (YYYY-MM-DD)
 * IMPORTANTE: Esta função NUNCA usa new Date() com strings YYYY-MM-DD
 * para evitar conversões automáticas de timezone que causam deslocamento de dia.
 * 
 * Suporta múltiplos formatos: Excel serial, Date object, strings diversas
 * Retorna sempre string ISO (YYYY-MM-DD) sem aplicar timezone
 */
function parseDate(value) {
    if (!value) return null;

    // Se já for uma string no formato correto (ISO), retornar direto
    // NUNCA passar para new Date() pois interpreta como UTC
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return value.trim();
    }

    try {
        let year, month, day;

        // Se for número (Excel serial date)
        if (typeof value === 'number') {
            // Excel serial date: dias desde 1900-01-01
            // Converter manualmente sem usar Date para evitar timezone
            const excelEpoch = new Date(1900, 0, 1); // 1 de janeiro de 1900 (local)
            const days = value - 2; // Excel considera 1900 como ano bissexto (bug do Excel)
            const milliseconds = days * 86400 * 1000;
            const date = new Date(excelEpoch.getTime() + milliseconds);
            
            // Usar métodos locais para evitar timezone
            year = date.getFullYear();
            month = date.getMonth() + 1; // getMonth() retorna 0-11
            day = date.getDate();
        }
        // Se for string, parsear manualmente
        else if (typeof value === 'string') {
            const trimmed = value.trim();
            
            // Formato ISO: YYYY-MM-DD - PARSEAR MANUALMENTE (NUNCA usar new Date())
            if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
                const parts = trimmed.split('-');
                if (parts.length >= 3) {
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10);
                    day = parseInt(parts[2], 10);
                }
            }
            // Formato brasileiro: DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
            else if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/.test(trimmed)) {
                const parts = trimmed.split(/[\/\-\.]/);
                if (parts.length === 3) {
                    day = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10);
                    year = parseInt(parts[2], 10);
                }
            }
            // Formato reverso: YYYY/MM/DD ou YYYY-MM-DD
            else if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/.test(trimmed)) {
                const parts = trimmed.split(/[\/\-\.]/);
                if (parts.length === 3) {
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10);
                    day = parseInt(parts[2], 10);
                }
            }
            // Tentar parse padrão do JavaScript como último recurso
            else {
                const date = new Date(trimmed);
                if (!isNaN(date.getTime())) {
                    year = date.getFullYear();
                    month = date.getMonth() + 1;
                    day = date.getDate();
                } else {
                    console.warn('Data inválida (formato não reconhecido):', value);
                    return null;
                }
            }
        }
        // Se for objeto Date
        else if (value instanceof Date) {
            // Usar métodos locais (getFullYear, getMonth, getDate) que retornam valores locais
            year = value.getFullYear();
            month = value.getMonth() + 1;
            day = value.getDate();
        }
        // Se for Timestamp do Firestore
        else if (value && typeof value.toDate === 'function') {
            const date = value.toDate(); // Converte para Date local
            year = date.getFullYear();
            month = date.getMonth() + 1;
            day = date.getDate();
        }
        // Última tentativa
        else {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                year = date.getFullYear();
                month = date.getMonth() + 1;
                day = date.getDate();
            } else {
                console.warn('Data inválida:', value);
                return null;
            }
        }

        // Validar valores parseados
        if (!year || !month || !day) {
            console.warn('Data inválida (valores não encontrados):', value);
            return null;
        }

        if (month < 1 || month > 12 || day < 1 || day > 31) {
            console.warn('Data inválida (valores fora do range):', value, {year, month, day});
            return null;
        }

        // Montar string ISO sem aplicar timezone
        const yearStr = String(year).padStart(4, '0');
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');

        return `${yearStr}-${monthStr}-${dayStr}`;
    } catch (e) {
        console.warn('Erro ao parsear data:', value, e);
        return null;
    }
}

/**
 * Processar arquivo CSV
 */
export async function parseCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split('\n').map(line => line.trim()).filter(line => line);
                
                if (lines.length < 2) {
                    reject(new Error('Arquivo CSV muito pequeno ou vazio'));
                    return;
                }

                // Parsear header
                const headers = lines[0].split(',').map(h => normalizeColumnName(h));
                const validation = validateStructure(headers);

                if (!validation.valid) {
                    reject(new Error(validation.error));
                    return;
                }

                // Processar linhas
                const data = [];
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    const row = normalizeRow(values, lines[0].split(','));
                    if (row.ELEMENTO && row.INCIDENCIA) {
                        data.push(row);
                    }
                }

                resolve({
                    data,
                    headers: lines[0].split(',').map(h => h.trim()),
                    totalRows: data.length
                });
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Erro ao ler arquivo CSV'));
        reader.readAsText(file, 'UTF-8');
    });
}

/**
 * Processar arquivo Excel (XLS, XLSX, XLSB)
 */
export async function parseExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const arrayBuffer = new Uint8Array(e.target.result);
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });

                // Pegar primeira planilha
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Converter para JSON
                // raw: true para capturar números (datas serial do Excel)
                // Depois converteremos usando parseDate
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null });

                if (jsonData.length < 2) {
                    reject(new Error('Planilha muito pequena ou vazia'));
                    return;
                }

                // Headers (primeira linha)
                const originalHeaders = jsonData[0].map(h => String(h || '').trim());
                const headers = originalHeaders.map(h => normalizeColumnName(h));

                // Validar estrutura
                const validation = validateStructure(headers);
                if (!validation.valid) {
                    reject(new Error(validation.error));
                    return;
                }

                // Processar linhas
                const data = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    const normalizedRow = normalizeRow(row, originalHeaders);
                    if (normalizedRow.ELEMENTO && normalizedRow.INCIDENCIA) {
                        data.push(normalizedRow);
                    }
                }

                resolve({
                    data,
                    headers: originalHeaders,
                    totalRows: data.length
                });
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('Erro ao ler arquivo Excel'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Processar arquivo (detecta tipo automaticamente)
 */
export async function parseFile(file) {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.csv')) {
        return await parseCSV(file);
    } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx') || fileName.endsWith('.xlsb')) {
        return await parseExcel(file);
    } else {
        throw new Error('Formato de arquivo não suportado');
    }
}
