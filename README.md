# Sistema de Visualização das Reinteradas - ENEL

Sistema web corporativo para visualização, análise e compartilhamento de reincidências operacionais, desenvolvido para a ENEL.

## 🚀 Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase (Authentication + Firestore)
- **Gráficos**: Chart.js
- **Mapas**: Leaflet + Leaflet.heat
- **Hospedagem**: GitHub Pages

## 📋 Pré-requisitos

1. Conta Firebase (https://firebase.google.com/)
2. Navegador moderno (Chrome, Firefox, Edge, Safari)
3. Conta GitHub (para hospedagem no GitHub Pages)

## 🔧 Configuração

Consulte o arquivo `CONFIGURACAO.md` para instruções detalhadas de configuração.

## 📁 Estrutura do Projeto

```
reinteradasENEL/
├── index.html              # Dashboard principal
├── admin.html              # Painel administrativo
├── css/
│   ├── styles.css          # Estilos principais
│   └── admin.css           # Estilos do admin
├── js/
│   ├── firebase-config.js  # Configuração Firebase
│   ├── main.js             # Script principal (dashboard)
│   ├── admin.js            # Script do painel admin
│   ├── services/
│   │   ├── firebase-service.js  # Serviços Firebase
│   │   └── data-service.js      # Lógica de negócio
│   ├── components/
│   │   ├── modal.js        # Gerenciamento de modais
│   │   ├── ranking.js      # Componente de ranking
│   │   ├── charts.js       # Gráficos
│   │   └── mapa.js         # Mapa de calor
│   └── utils/
│       ├── file-parser.js  # Parser de arquivos
│       └── helpers.js      # Funções auxiliares
└── README.md
```

## 📊 Formato da Planilha

A planilha deve conter as seguintes colunas **obrigatórias**:

- **INCIDENCIA**
- **CAUSA**
- **ALIMENT.** (ou ALIMENTADOR)
- **DATA**
- **ELEMENTO**
- **CONJUNTO**

### Formatos Suportados

- CSV (Comma Separated Values)
- XLS (Excel 97-2003)
- XLSX (Excel 2007+)
- XLSB (Excel Binary)

## 📱 Funcionalidades

### Dashboard Principal

- **Ranking por ELEMENTO**: Lista ordenada de elementos com mais ocorrências
- **Filtro de Data**: Filtrar registros por período
- **Gráfico de Pizza**: Top 10 causas mais recorrentes
- **Gráfico Radar**: Top 10 alimentadores mais recorrentes
- **Mapa de Calor**: Visualização geográfica dos conjuntos
- **Copiar Ranking**: Copiar ranking formatado para WhatsApp

### Painel Administrativo

- **Autenticação**: Login com email e senha
- **Upload de Planilhas**: Suporte a CSV, XLS, XLSX, XLSB
- **Validação**: Verificação automática da estrutura
- **Histórico**: Visualização de uploads anteriores

### Modal de Detalhes

- Exibição de todas as ocorrências de um elemento
- Link clicável para detalhes da incidência
- Adicionar colunas extras dinamicamente

## 🎨 Paleta de Cores ENEL

- **Azul Primário**: `#003876`
- **Azul Secundário**: `#0066CC`
- **Cinza Escuro**: `#2C3E50`
- **Cinza Médio**: `#7F8C8D`
- **Cinza Claro**: `#ECF0F1`
- **Branco**: `#FFFFFF`

## 📄 Licença

Sistema desenvolvido para uso interno da ENEL.

