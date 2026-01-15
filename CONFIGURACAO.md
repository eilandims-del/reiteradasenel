# Guia de Configuração - Sistema de Reinteradas

## ⚙️ Configuração Inicial

### 1. Firebase Setup

#### 1.1 Criar Projeto no Firebase

1. Acesse https://console.firebase.google.com/
2. Clique em "Adicionar projeto"
3. Escolha um nome (ex: "enel-reinteradas")
4. Siga as etapas de criação

#### 1.2 Habilitar Authentication

1. No menu lateral, clique em **Authentication**
2. Clique em **Começar**
3. Vá na aba **Sign-in method**
4. Habilite **Email/Password**
5. Salve as alterações

#### 1.3 Criar Firestore Database

1. No menu lateral, clique em **Firestore Database**
2. Clique em **Criar banco de dados**
3. Selecione **Iniciar no modo produção**
4. Escolha uma localização (ex: southamerica-east1 para Brasil)
5. Aguarde a criação

#### 1.4 Configurar Regras de Segurança

1. No Firestore, vá na aba **Regras**
2. Cole o seguinte código:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir leitura pública dos dados de reinteradas
    match /reinteradas/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Permitir leitura/escrita de uploads apenas para autenticados
    match /uploads/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Clique em **Publicar**

#### 1.5 Obter Credenciais

1. Clique no ícone de engrenagem ⚙️ ao lado de "Visão geral do projeto"
2. Vá em **Configurações do projeto**
3. Role até **Seus aplicativos**
4. Clique no ícone `</>` (Web)
5. Registre um app com nome (ex: "Reinteradas Web")
6. Copie as credenciais exibidas

#### 1.6 Configurar Credenciais no Código

1. Abra o arquivo `js/firebase-config.js`
2. Substitua as credenciais (já estão configuradas se você já tinha um projeto):

```javascript
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto-id",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "123456789",
    appId: "seu-app-id"
};
```

#### 1.7 Criar Usuário Administrador

1. No Firebase Console, vá em **Authentication > Users**
2. Clique em **Adicionar usuário**
3. Informe:
   - Email: admin@enel.com.br
   - Senha: (escolha uma senha forte)
4. Clique em **Adicionar usuário**

### 2. Configurar Índices do Firestore (Opcional)

Para melhor performance ao ordenar por DATA:

1. No Firestore, vá em **Índices**
2. Clique em **Criar índice**
3. Coleção: `reinteradas`
4. Campos:
   - DATA (Ascendente)
5. Clique em **Criar**

**Nota:** Se não criar o índice, o sistema funcionará normalmente, mas tentará buscar sem ordenação se o índice não existir.

### 3. Configurar Coordenadas do Mapa

Para que o mapa de calor funcione corretamente:

1. Abra `js/services/data-service.js`
2. Localize a função `generateHeatmapData()`
3. No objeto `coordenadasConjuntos`, adicione as coordenadas dos seus conjuntos:

```javascript
const coordenadasConjuntos = {
    'NOME_DO_CONJUNTO': [latitude, longitude],
    // Exemplo:
    'FORTALEZA': [-3.7172, -38.5433],
    // ...
};
```

**Como obter coordenadas:**
- Use Google Maps: clique com botão direito no local > "O que há aqui?"
- Ou use: https://www.latlong.net/

**Nota:** O arquivo já possui várias coordenadas de municípios do Ceará configuradas.

### 4. Deploy no GitHub Pages

#### 4.1 Criar Repositório

1. Crie um repositório no GitHub
2. Nome sugerido: `Site_reinteradas` ou `enel-reinteradas`

#### 4.2 Fazer Upload

```bash
# Inicializar git (se ainda não foi feito)
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git push -u origin main
```

#### 4.3 Configurar GitHub Pages

1. No GitHub, vá em **Settings**
2. Role até **Pages**
3. Em **Source**, selecione:
   - Branch: `main`
   - Folder: `/ (root)` ou `/reinteradasENEL` (dependendo de onde estão os arquivos)
4. Clique em **Save**
5. Aguarde alguns minutos
6. Acesse: `https://SEU-USUARIO.github.io/Site_reinteradas/` ou `https://SEU-USUARIO.github.io/Site_reinteradas/reinteradasENEL/`

### 5. Configuração de Domínio Personalizado (Opcional)

1. No GitHub Pages, na seção **Custom domain**, adicione seu domínio
2. Configure o DNS conforme instruções do GitHub
3. Habilite **Enforce HTTPS**

## 📋 Checklist de Verificação

- [ ] Projeto Firebase criado
- [ ] Authentication habilitado (Email/Password)
- [ ] Firestore Database criado
- [ ] Regras de segurança configuradas
- [ ] Credenciais do Firebase atualizadas no código
- [ ] Usuário administrador criado
- [ ] Coordenadas do mapa configuradas (se necessário)
- [ ] Código enviado para GitHub
- [ ] GitHub Pages habilitado
- [ ] Site acessível via URL

## 🔍 Testes

### Testar Login

1. Acesse `/admin.html`
2. Faça login com as credenciais do admin
3. Verifique se acessa o painel

### Testar Upload

1. No painel admin, faça upload de uma planilha de teste
2. Verifique se aparece mensagem de sucesso
3. Verifique no Firestore se os dados foram salvos

### Testar Dashboard

1. Acesse a página principal
2. Verifique se os dados aparecem
3. Teste o filtro de data
4. Teste clicar em um elemento do ranking
5. Teste copiar ranking para WhatsApp

## 🐛 Troubleshooting

### Erro: "Firebase: Error (auth/user-not-found)"
- Verifique se o usuário foi criado no Firebase Authentication
- Confirme o email digitado

### Erro: "Firebase: Error (permission-denied)"
- Verifique as regras de segurança do Firestore
- Confirme que está logado ao fazer upload

### Erro: "Colunas obrigatórias faltando: ALIMENT."
- O sistema agora normaliza os nomes das colunas antes de validar
- Certifique-se de que a coluna existe na planilha (pode ter ponto ou não)
- Verifique se o arquivo está no formato correto

### Mapa não aparece
- Verifique se há dados com CONJUNTO nas coordenadas configuradas
- Abra o console do navegador (F12) e verifique erros
- Verifique se o Leaflet está carregando corretamente

### Dados não aparecem
- Verifique se o upload foi concluído com sucesso
- Confirme no Firestore se os dados estão salvos
- Verifique o console do navegador para erros

## 📞 Suporte Adicional

Em caso de dúvidas:
1. Verifique o console do navegador (F12)
2. Verifique os logs do Firebase Console
3. Consulte a documentação do Firebase

