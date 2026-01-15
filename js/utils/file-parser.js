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
 * Converter data para formato padrão
 */
function parseDate(value) {
    if (!value) return null;

    // Se já for uma string no formato correto
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    // Tentar parsear como Date
    try {
        let date;
        
        if (value instanceof Date) {
            date = value;
        } else if (typeof value === 'number') {
            // Excel serial date
            date = new Date((value - 25569) * 86400 * 1000);
        } else {
            date = new Date(value);
        }

        if (isNaN(date.getTime())) {
            return null;
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    } catch (e) {
        console.warn('Erro ao parsear data:', value);
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
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

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
