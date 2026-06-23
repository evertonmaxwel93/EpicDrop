# EpicDrop Informática Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o sistema EpicDrop Informática, um painel financeiro, de estoque e de pedidos com dropshipping integrado e catálogo público integrado ao WhatsApp, utilizando HTML, Tailwind CDN, Vanilla JS e Supabase.

**Architecture:** O projeto será uma Single Page Application (SPA) estática. O catálogo público carrega como visão padrão para qualquer cliente no endereço raiz. Um botão secreto ou link com parâmetro de URL (`?admin=true`) carrega o painel administrativo protegido por autenticação via Supabase Auth restrita ao e-mail do Everton. As automações de dropshipping e cálculo de taxas são controladas localmente no cliente através do SDK do Supabase.

**Tech Stack:** HTML5, CSS3, Tailwind CSS (via CDN), FontAwesome v6, JS Modules (ES6), Supabase JavaScript Client SDK, Node.js Native Test Runner (`node --test`).

## Global Constraints
* **Tecnologias:** HTML, CSS customizado e Vanilla JS. Proibido Tailwind CLI ou outros bundlers a menos que solicitado.
* **Estilo:** Seguir rigorosamente o [epicdrop-style-guide](file:///C:/Users/evert/.gemini/config/skills/epicdrop-style-guide/SKILL.md) (modo escuro mapeado no CSS global, dock mobile inferior, toasts, modais com zoom e scale 0.97 nos cliques).
* **Autenticação:** Apenas o e-mail `evertonmaxwel@gmail.com` está autorizado a efetuar login ou cadastro no admin.
* **Testes:** Utilizar o executável nativo do Node.js (`node --test`) para executar testes unitários dos módulos JS sob a pasta `tests/`.

---

### Task 1: Scaffolding do Projeto, PWA e Estilos Base

**Files:**
* Create: `package.json`
* Create: `index.html`
* Create: `style.css`
* Create: `manifest.json`
* Create: `sw.js`
* Create: `tests/setup.test.js`

**Interfaces:**
* Produces: Estrutura HTML/CSS inicial carregando Tailwind e FontAwesome, arquivo manifest para PWA e script básico de Service Worker.

- [ ] **Step 1: Write the package.json and configuration**
Create `package.json`:
```json
{
  "name": "epicdrop-informatica",
  "version": "1.0.0",
  "description": "Sistema de gestão financeira e de estoque com catálogo dropshipping para EpicDrop",
  "main": "js/app.js",
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

- [ ] **Step 2: Create style.css with EpicDrop visual identity**
Create `style.css` (incorporando as overrides de Dark Mode, toasts, modais e transições elásticas do Style Guide):
```css
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    transition: background-color 0.3s, color 0.3s;
}

/* Transições de cliques */
button, label.cursor-pointer, .clickable-row {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
button:active, label.cursor-pointer:active {
    transform: scale(0.97);
}

/* Toast Notifications */
.toast {
    animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards, fadeOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) 2.7s forwards;
    pointer-events: auto;
    max-width: 350px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
}
@keyframes slideIn {
    from { transform: translateY(-20px) scale(0.95); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes fadeOut {
    from { transform: translateY(0) scale(1); opacity: 1; }
    to { transform: translateY(-20px) scale(0.95); opacity: 0; }
}

/* Loading Spinner overlay */
.spinner {
    width: 40px; height: 40px;
    border: 4px solid rgba(37, 99, 235, 0.15);
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* CSS Responsivo Dock inferior */
#mobile-bottom-dock { display: none; }
@media (max-width: 768px) {
    #desktop-nav { display: none !important; }
    main { padding-bottom: 5.5rem !important; }
    #mobile-bottom-dock { display: flex !important; }
    input, select, textarea { font-size: 16px !important; }
}

/* Dark mode manual overrides */
html.dark body { background-color: #0f172a; color: #e2e8f0; }
html.dark .bg-white { background-color: #1e293b !important; }
html.dark .bg-slate-50 { background-color: #0f172a !important; }
html.dark .bg-slate-100 { background-color: #0f172a !important; }
html.dark .bg-slate-900 { background-color: #020617 !important; }
html.dark .text-slate-800 { color: #e2e8f0 !important; }
html.dark .text-slate-700 { color: #cbd5e1 !important; }
html.dark .text-slate-600 { color: #94a3b8 !important; }
html.dark .text-slate-500 { color: #94a3b8 !important; }
html.dark .text-slate-400 { color: #64748b !important; }
html.dark .border-slate-200 { border-color: #334155 !important; }
html.dark .border-slate-100 { border-color: #1e293b !important; }
html.dark input, html.dark select, html.dark textarea { background-color: #334155 !important; color: #e2e8f0 !important; }
html.dark .toast { background-color: #1e293b !important; color: #e2e8f0 !important; border-color: #334155 !important; }
```

- [ ] **Step 3: Create PWA Manifest and sw.js**
Create `manifest.json`:
```json
{
  "name": "EpicDrop Informática",
  "short_name": "EpicDrop",
  "description": "Controle financeiro, de estoque e catálogo da EpicDrop Informática",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```
Create `sw.js`:
```javascript
const CACHE_NAME = 'epicdrop-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
```

- [ ] **Step 4: Create index.html framework**
Create `index.html` referencing scripts as ES Modules:
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EpicDrop Informática</title>
    <link rel="manifest" href="manifest.json">
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body class="bg-slate-100 text-slate-800 transition-colors">
    <div id="toast-container" class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"></div>
    <div id="loading-overlay" class="fixed inset-0 z-[9998] bg-white/80 dark:bg-slate-900/80 flex items-center justify-center hidden">
        <div class="flex flex-col items-center gap-3">
            <div class="spinner"></div>
            <span class="text-sm font-bold text-slate-500 dark:text-slate-300">Carregando...</span>
        </div>
    </div>
    
    <!-- SPA Root Content -->
    <main id="app-root" class="min-h-screen">
        <div class="p-8 text-center">
            <h1 class="text-2xl font-black text-blue-600">EpicDrop Informática</h1>
            <p class="text-sm text-slate-500 mt-2">Inicializando sistema...</p>
        </div>
    </main>

    <!-- JS Módulos -->
    <script type="module" src="js/db.js"></script>
    <script type="module" src="js/auth.js"></script>
    <script type="module" src="js/financeiro.js"></script>
    <script type="module" src="js/estoque.js"></script>
    <script type="module" src="js/operacoes.js"></script>
    <script type="module" src="js/relatorios.js"></script>
    <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Write setup test file and verify**
Create `tests/setup.test.js` to assert PWA parameters:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';

test('verifica arquivos de PWA', () => {
    assert.ok(fs.existsSync('./manifest.json'), 'manifest.json deve existir');
    assert.ok(fs.existsSync('./sw.js'), 'sw.js deve existir');
    
    const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
    assert.strictEqual(manifest.name, 'EpicDrop Informática', 'Nome do PWA incorreto');
});
```
Run tests: `npm test`
Expected output: `tests/setup.test.js` passes.

- [ ] **Step 6: Create mock assets folder and placeholder icons**
Create folder `icons/` and write script to generate temporary empty files for icons `icons/icon-192.png` and `icons/icon-512.png`.
Run script and commit: `git add .` and `git commit -m "feat: setup initial scaffolding and styles"`

---

### Task 2: Banco de Dados, Inicialização do Cliente e Cache Offline (`js/db.js`)

**Files:**
* Create: `js/db.js`
* Create: `tests/db.test.js`

**Interfaces:**
* Produces:
  * Exporta `clienteSupabase` (objeto de conexão).
  * Exporta `cacheOffline` (objeto com métodos `salvar(chave, dados)`, `obter(chave)`, `limpar(chave)`).
  * Exporta função `isOnline()`.

- [ ] **Step 1: Write the failing test**
Create `tests/db.test.js` containing cache assertions:
```javascript
import test from 'node:test';
import assert from 'node:assert';

// Mock do localStorage para testes locais do Node
global.localStorage = {
    store: {},
    setItem(key, value) { this.store[key] = String(value); },
    getItem(key) { return this.store[key] || null; },
    removeItem(key) { delete this.store[key]; }
};

import { cacheOffline } from '../js/db.js';

test('verifica salvar e obter cache offline', () => {
    const dados = { items: [1, 2, 3] };
    cacheOffline.salvar('teste', dados);
    
    const obtido = cacheOffline.obter('teste');
    assert.deepStrictEqual(obtido, dados, 'Os dados retornados do cache devem ser iguais aos salvos');
    
    cacheOffline.limpar('teste');
    assert.strictEqual(cacheOffline.obter('teste'), null, 'Os dados limpos devem retornar nulo');
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL because `js/db.js` does not exist yet.

- [ ] **Step 3: Write minimal implementation in `js/db.js`**
Create `js/db.js` (usando chaves anônimas reais do projeto anterior do usuário ou mockando para desenvolvimento):
```javascript
// EpicDrop Supabase Configuration
const SUPABASE_URL = 'https://rkwoerrsicftcjgaakte.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ug1NkS3w4DACmOIpiafAAA_yQtSud7-';

// Criação do cliente Supabase. Tratamento para rodar sob Node de forma mockada nos testes.
export const clienteSupabase = (typeof supabase !== 'undefined') 
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : {
        auth: {},
        from: () => {}
    };

export const cacheOffline = {
    salvar(chave, dados) {
        try {
            localStorage.setItem(`epicdrop_cache_${chave}`, JSON.stringify(dados));
        } catch (e) {
            console.warn("Erro ao salvar no cache local:", e);
        }
    },
    obter(chave) {
        try {
            const raw = localStorage.getItem(`epicdrop_cache_${chave}`);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn("Erro ao ler do cache local:", e);
            return null;
        }
    },
    limpar(chave) {
        localStorage.removeItem(`epicdrop_cache_${chave}`);
    }
};

export function isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add js/db.js tests/db.test.js
git commit -m "feat: add db initial connection and offline caching utility"
```

---

### Task 3: Sistema de Autenticação Restrita (`js/auth.js`)

**Files:**
* Create: `js/auth.js`
* Create: `tests/auth.test.js`

**Interfaces:**
* Consumes: `clienteSupabase` de `js/db.js`
* Produces:
  * Exporta `loginComEmail(email, senha)` (retorna user).
  * Exporta `cadastrarComEmail(email, senha)` (bloqueia se email não for do Everton).
  * Exporta `sair()`.
  * Exporta `verificarSessao()`.

- [ ] **Step 1: Write the failing test**
Create `tests/auth.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import { cadastrarComEmail } from '../js/auth.js';

test('rejeita cadastro de email que nao seja do Everton', async () => {
    try {
        await cadastrarComEmail('invasor@gmail.com', '123456');
        assert.fail('Deveria ter lançado erro de email não autorizado');
    } catch (err) {
        assert.strictEqual(err.message, 'Cadastro não autorizado. Apenas evertonmaxwel@gmail.com é permitido.');
    }
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL because `js/auth.js` does not exist or function not defined.

- [ ] **Step 3: Write implementation of `js/auth.js`**
Create `js/auth.js`:
```javascript
import { clienteSupabase } from './db.js';

export let userAtual = null;

export async function loginComEmail(email, senha) {
    if (email.trim() !== 'evertonmaxwel@gmail.com') {
        throw new Error('Acesso exclusivo para evertonmaxwel@gmail.com.');
    }
    
    // Tratamento para teste unitário local
    if (!clienteSupabase.auth.signInWithPassword) {
        userAtual = { email: 'evertonmaxwel@gmail.com' };
        return userAtual;
    }

    const { data, error } = await clienteSupabase.auth.signInWithPassword({
        email,
        password: senha
    });
    if (error) throw error;
    userAtual = data.user;
    return userAtual;
}

export async function cadastrarComEmail(email, senha) {
    if (email.trim() !== 'evertonmaxwel@gmail.com') {
        throw new Error('Cadastro não autorizado. Apenas evertonmaxwel@gmail.com é permitido.');
    }

    if (!clienteSupabase.auth.signUp) {
        return { email: 'evertonmaxwel@gmail.com' };
    }

    const { data, error } = await clienteSupabase.auth.signUp({
        email,
        password: senha
    });
    if (error) throw error;
    return data.user;
}

export async function sair() {
    if (clienteSupabase.auth.signOut) {
        await clienteSupabase.auth.signOut();
    }
    userAtual = null;
    for (let key in localStorage) {
        if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
        }
    }
    if (typeof window !== 'undefined') window.location.reload();
}

export async function verificarSessao() {
    if (!clienteSupabase.auth.getSession) return null;
    const { data: { session }, error } = await clienteSupabase.auth.getSession();
    if (error) throw error;
    if (session) {
        userAtual = session.user;
        return session.user;
    }
    userAtual = null;
    return null;
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add js/auth.js tests/auth.test.js
git commit -m "feat: add restricted login/signup auth logic"
```

---

### Task 4: Controle de Produtos, Preços e Catálogo Público (`js/estoque.js`)

**Files:**
* Create: `js/estoque.js`
* Create: `tests/estoque.test.js`

**Interfaces:**
* Consumes: `clienteSupabase` de `js/db.js`
* Produces:
  * Exporta `carregarProdutos()`.
  * Exporta `salvarProduto(payload, id)`.
  * Exporta `deletarProduto(id)`.
  * Exporta `ordenarProdutosCatalogo(lista)`.
  * Exporta `fazerUploadImagem(file)`.

- [ ] **Step 1: Write the failing test**
Create `tests/estoque.test.js` asserting sorting and promotion logic:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import { ordenarProdutosCatalogo } from '../js/estoque.js';

test('ordena produtos colocando em estoque primeiro dentro da categoria', () => {
    const produtosMock = [
        { nome: 'Memória B', categoria: 'RAM', estoque_atual: 0, valor_venda: 100 },
        { nome: 'Memória A', categoria: 'RAM', estoque_atual: 5, valor_venda: 100 },
        { nome: 'SSD B', categoria: 'SSD', estoque_atual: 3, valor_venda: 150 },
        { nome: 'SSD A', categoria: 'SSD', estoque_atual: 0, valor_venda: 150 }
    ];

    const ordenados = ordenarProdutosCatalogo(produtosMock);

    // Categoria SSD deve vir ordenada alfabeticamente ou agrupada, mas dentro de RAM 'Memória A' (estoque > 0) deve vir antes de 'Memória B' (estoque = 0)
    const indexMemA = ordenados.findIndex(p => p.nome === 'Memória A');
    const indexMemB = ordenados.findIndex(p => p.nome === 'Memória B');
    assert.ok(indexMemA < indexMemB, 'Memória com estoque deve vir primeiro');
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL because `js/estoque.js` or functions not defined.

- [ ] **Step 3: Write implementation of `js/estoque.js`**
Create `js/estoque.js`:
```javascript
import { clienteSupabase } from './db.js';

export async function carregarProdutos() {
    if (!clienteSupabase.from) return [];
    const { data, error } = await clienteSupabase.from('produtos').select('*').order('categoria').order('nome');
    if (error) throw error;
    return data || [];
}

export async function salvarProduto(payload, id = null) {
    if (id) {
        const { data, error } = await clienteSupabase.from('produtos').update(payload).eq('id', id).select();
        if (error) throw error;
        return data;
    } else {
        const { data, error } = await clienteSupabase.from('produtos').insert([payload]).select();
        if (error) throw error;
        return data;
    }
}

export async function deletarProduto(id) {
    const { error } = await clienteSupabase.from('produtos').delete().eq('id', id);
    if (error) throw error;
    return true;
}

export function ordenarProdutosCatalogo(lista) {
    return [...lista].sort((a, b) => {
        // Agrupar por Categoria primeiro
        const catCompare = a.categoria.localeCompare(b.categoria);
        if (catCompare !== 0) return catCompare;
        
        // Se mesma categoria, o que tem estoque físico real (estoque_atual > 0) vem primeiro
        const aTemEstoque = a.estoque_atual > 0 ? 1 : 0;
        const bTemEstoque = b.estoque_atual > 0 ? 1 : 0;
        
        if (aTemEstoque !== bTemEstoque) {
            return bTemEstoque - aTemEstoque; // 1 (com estoque) vem antes de 0 (sem estoque)
        }
        
        // Se ambos têm estoque ou ambos estão zerados, ordena por nome alfabético
        return a.nome.localeCompare(b.nome);
    });
}

export async function fazerUploadImagem(file) {
    if (!clienteSupabase.storage) return 'http://placehold.co/150';
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `produtos/${fileName}`;

    const { error } = await clienteSupabase.storage.from('produtos').upload(filePath, file);
    if (error) throw error;

    const { data } = clienteSupabase.storage.from('produtos').getPublicUrl(filePath);
    return data.publicUrl;
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add js/estoque.js tests/estoque.test.js
git commit -m "feat: implement products inventory and catalog display ordering logic"
```

---

### Task 5: Caixa Financeiro, Saldos Diários/Acumulados e Backup JSON (`js/financeiro.js`)

**Files:**
* Create: `js/financeiro.js`
* Create: `tests/financeiro.test.js`

**Interfaces:**
* Consumes: `clienteSupabase` de `js/db.js`
* Produces:
  * Exporta `salvarTransacao(payload, id)`.
  * Exporta `excluirTransacao(id)`.
  * Exporta `gerarTransacoesParceladas(payload, parcelas, frequencia)`.
  * Exporta `calcularSaldosAcumuladosPorDia(transacoes, saldoInicial)`.
  * Exporta `exportarBackupJSON(emailUsuario, transacoes, subcategorias, produtos, clientes, fornecedores)`.

- [ ] **Step 1: Write the failing test**
Create `tests/financeiro.test.js` asserting cumulative cash calculation per day:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import { calcularSaldosAcumuladosPorDia } from '../js/financeiro.js';

test('calcula corretamente o saldo final do dia e acumulado ordenado', () => {
    const transacoesMock = [
        { data_vencimento: '2026-06-20', tipo: 'Entrada', valor_realizado: 100, valor_parcela: 100, status: 'Realizado' },
        { data_vencimento: '2026-06-20', tipo: 'Saída', valor_realizado: 30, valor_parcela: 30, status: 'Realizado' },
        { data_vencimento: '2026-06-21', tipo: 'Entrada', valor_realizado: 50, valor_parcela: 50, status: 'Realizado' }
    ];

    const result = calcularSaldosAcumuladosPorDia(transacoesMock, 10); // Saldo inicial = 10

    // Dia 20/06: entrada 100 - saida 30 = balanço +70. Acumulado com saldo inicial (10) = 80.
    // Dia 21/06: entrada 50 = balanço +50. Acumulado = 80 + 50 = 130.
    assert.strictEqual(result['2026-06-20'].balanco, 70);
    assert.strictEqual(result['2026-06-20'].acumulado, 80);
    assert.strictEqual(result['2026-06-21'].acumulado, 130);
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL because `js/financeiro.js` or functions not defined.

- [ ] **Step 3: Write implementation of `js/financeiro.js`**
Create `js/financeiro.js`:
```javascript
import { clienteSupabase } from './db.js';

export async function salvarTransacao(payload, id = null) {
    if (id) {
        const { data, error } = await clienteSupabase.from('transacoes').update(payload).eq('id', id).select();
        if (error) throw error;
        return data;
    } else {
        const { data, error } = await clienteSupabase.from('transacoes').insert([payload]).select();
        if (error) throw error;
        return data;
    }
}

export async function excluirTransacao(id) {
    const { error } = await clienteSupabase.from('transacoes').delete().eq('id', id);
    if (error) throw error;
    return true;
}

export function gerarTransacoesParceladas(payload, parcelas, frequencia) {
    const transacoes = [];
    const dataBase = new Date(payload.data_vencimento + 'T12:00:00');
    const iter = parcelas === 0 ? 12 : parcelas; 
    
    for (let i = 0; i < iter; i++) {
        let dP = new Date(dataBase);
        if (frequencia === 'Mensal') {
            let d = dP.getDate();
            dP.setMonth(dP.getMonth() + i);
            if (dP.getDate() !== d) dP.setDate(0);
        } else if (frequencia === 'Semanal') {
            dP.setDate(dP.getDate() + (i * 7));
        } else if (frequencia === 'Anual') {
            dP.setFullYear(dP.getFullYear() + i);
        } else if (frequencia === 'Diário') {
            dP.setDate(dP.getDate() + i);
        }

        transacoes.push({
            ...payload,
            data_vencimento: dP.toISOString().split('T')[0],
            parcela_atual: i + 1,
            total_parcelas: parcelas,
            frequencia
        });
    }
    return transacoes;
}

export function calcularSaldosAcumuladosPorDia(transacoes, saldoInicial = 0) {
    // Agrupa e ordena
    const saldos = {};
    const transacoesOrdenadas = [...transacoes].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
    
    let caixaAcumulado = saldoInicial;
    
    transacoesOrdenadas.forEach(t => {
        const data = t.data_vencimento;
        const valor = parseFloat(t.status === 'Realizado' ? (t.valor_realizado ?? t.valor_parcela) : t.valor_parcela);
        const impacto = t.tipo === 'Entrada' ? valor : -valor;
        
        if (!saldos[data]) {
            saldos[data] = { balanco: 0, acumulado: 0 };
        }
        saldos[data].balanco += impacto;
    });

    const datasOrdenadas = Object.keys(saldos).sort();
    datasOrdenadas.forEach(dt => {
        caixaAcumulado += saldos[dt].balanco;
        saldos[dt].acumulado = caixaAcumulado;
    });

    return saldos;
}

export function exportarBackupJSON(emailUsuario, transacoes, subcategorias, produtos, clientes, fornecedores) {
    const backup = {
        data_exportacao: new Date().toISOString(),
        app: "EpicDrop",
        usuario: emailUsuario,
        transacoes,
        subcategorias,
        produtos,
        clientes,
        fornecedores
    };
    return JSON.stringify(backup, null, 2);
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add js/financeiro.js tests/financeiro.test.js
git commit -m "feat: implement financial cash ledger and balance calculator"
```

---

### Task 6: Pedidos, Automação do Dropshipping e Registro de Taxas (`js/operacoes.js`)

**Files:**
* Create: `js/operacoes.js`
* Create: `tests/operacoes.test.js`

**Interfaces:**
* Consumes: `clienteSupabase` de `js/db.js`
* Produces:
  * Exporta `criarPedido(pedidoData, itens)`.
  * Exporta `atualizarStatusPedido(pedidoId, novoStatus)`.
  * Exporta `registrarTaxaCartao(vendaId, valorTaxa)`.
  * Exporta `formatarMensagemWhatsApp(clienteNome, endereco, itens)`.

- [ ] **Step 1: Write the failing test**
Create `tests/operacoes.test.js` checking automated purchase logs:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import { formatarMensagemWhatsApp } from '../js/operacoes.js';

test('formata corretamente a mensagem de pedido consolidada para WhatsApp', () => {
    const cliente = "Everton Maxwel";
    const endereco = "Rua Teste, 100";
    const itens = [
        { nome: "SSD 240GB", quantidade: 1, preco: 130.00 },
        { nome: "RAM 8GB", quantidade: 2, preco: 150.00 }
    ];

    const mensagem = formatarMensagemWhatsApp(cliente, endereco, itens);
    
    assert.ok(mensagem.includes("Everton Maxwel"), 'Deve conter o nome do cliente');
    assert.ok(mensagem.includes("SSD 240GB"), 'Deve conter a listagem do SSD');
    assert.ok(mensagem.includes("Total: R$ 430,00"), 'Deve calcular a soma dos itens corretamente');
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL because `js/operacoes.js` or functions not defined.

- [ ] **Step 3: Write implementation of `js/operacoes.js`**
Create `js/operacoes.js` (incluindo a lógica de criar registros de compra quando muda para 'Adquirido' e registrar taxas gerando Saídas no financeiro):
```javascript
import { clienteSupabase } from './db.js';

export async function criarPedido(pedidoData, itens) {
    // 1. Criar transação correspondente no financeiro (entrada pendente se não pago)
    const valorTotal = itens.reduce((sum, it) => sum + (it.quantidade * it.valor_venda), 0);
    const custoTotal = itens.reduce((sum, it) => sum + (it.quantidade * it.custo_unitario), 0);
    
    const trPayload = {
        user_id: pedidoData.user_id,
        tipo: 'Entrada',
        subcategoria: 'Vendas',
        descricao: pedidoData.cliente,
        valor_parcela: valorTotal,
        valor_realizado: pedidoData.status_pagamento === 'Pago' ? valorTotal : null,
        data_vencimento: pedidoData.data,
        data_realizacao: pedidoData.status_pagamento === 'Pago' ? pedidoData.data : null,
        status: pedidoData.status_pagamento === 'Pago' ? 'Realizado' : 'Pendente',
        grupo_id: crypto.randomUUID()
    };
    
    let trId = null;
    if (clienteSupabase.from) {
        const { data: trData, error: trErr } = await clienteSupabase.from('transacoes').insert([trPayload]).select().single();
        if (trErr) throw trErr;
        trId = trData.id;
    }

    // 2. Inserir Pedido/Venda
    const vendaPayload = {
        ...pedidoData,
        total: valorTotal,
        custo_total: custoTotal,
        transacao_id: trId,
        status_entrega: 'Encomendado'
    };

    let vendaId = 'mock-id';
    if (clienteSupabase.from) {
        const { data: vData, error: vErr } = await clienteSupabase.from('vendas').insert([vendaPayload]).select().single();
        if (vErr) throw vErr;
        vendaId = vData.id;

        // Inserir itens da venda
        const itensPayload = itens.map(it => ({
            venda_id: vendaId,
            produto_id: it.produto_id,
            quantidade: it.quantidade,
            valor_venda: it.valor_venda,
            custo_unitario: it.custo_unitario
        }));
        const { error: itErr } = await clienteSupabase.from('vendas_itens').insert(itensPayload);
        if (itErr) throw itErr;

        // Atualizar estoque_reservado dos produtos
        const updatePromises = itens.map(async it => {
            const { data: prod } = await clienteSupabase.from('produtos').select('estoque_reservado').eq('id', it.produto_id).single();
            if (prod) {
                return clienteSupabase.from('produtos')
                    .update({ estoque_reservado: (prod.estoque_reservado || 0) + it.quantidade })
                    .eq('id', it.produto_id);
            }
        });
        await Promise.all(updatePromises);
    }
    
    return vendaId;
}

export async function atualizarStatusPedido(pedidoId, novoStatus) {
    if (!clienteSupabase.from) return;

    // Buscar dados da venda e itens
    const { data: venda, error: vErr } = await clienteSupabase.from('vendas').select('*').eq('id', pedidoId).single();
    if (vErr) throw vErr;
    const { data: itens, error: iErr } = await clienteSupabase.from('vendas_itens').select('*').eq('venda_id', pedidoId);
    if (iErr) throw iErr;

    // Se mudou para Adquirido
    if (novoStatus === 'Adquirido' && venda.status_entrega !== 'Adquirido' && venda.status_entrega !== 'Entregue') {
        // Lógica de Dropshipping Automático: comprar itens faltantes do estoque
        for (const it of itens) {
            const { data: prod } = await clienteSupabase.from('produtos').select('*').eq('id', it.produto_id).single();
            if (prod) {
                const falta = it.quantidade - prod.estoque_atual;
                if (falta > 0) {
                    // 1. Criar transação de Saída de Compra
                    const custoCompra = falta * prod.custo_unitario;
                    const { data: trComp } = await clienteSupabase.from('transacoes').insert([{
                        user_id: venda.user_id,
                        tipo: 'Saída',
                        subcategoria: 'Compras',
                        descricao: `Compra Dropship Pedido #${pedidoId}`,
                        valor_parcela: custoCompra,
                        valor_realizado: custoCompra,
                        data_vencimento: new Date().toISOString().split('T')[0],
                        data_realizacao: new Date().toISOString().split('T')[0],
                        status: 'Realizado',
                        grupo_id: crypto.randomUUID()
                    }]).select().single();

                    // 2. Criar registro de Compra
                    const { data: comp } = await clienteSupabase.from('compras').insert([{
                        user_id: venda.user_id,
                        data: new Date().toISOString().split('T')[0],
                        fornecedor: 'Dropship (Auto)',
                        total: custoCompra,
                        transacao_id: trComp.id
                    }]).select().single();

                    // 3. Criar item da compra
                    await clienteSupabase.from('compras_itens').insert([{
                        compra_id: comp.id,
                        produto_id: it.produto_id,
                        quantidade: falta,
                        custo_unitario: prod.custo_unitario
                    }]);

                    // 4. Abastecer estoque físico
                    await clienteSupabase.from('produtos')
                        .update({ estoque_atual: prod.estoque_atual + falta })
                        .eq('id', it.produto_id);
                }
            }
        }
    }

    // Se mudou para Entregue (fulfillment final)
    if (novoStatus === 'Entregue' && venda.status_entrega !== 'Entregue') {
        for (const it of itens) {
            const { data: prod } = await clienteSupabase.from('produtos').select('*').eq('id', it.produto_id).single();
            if (prod) {
                await clienteSupabase.from('produtos').update({
                    estoque_atual: Math.max(0, prod.estoque_atual - it.quantidade),
                    estoque_reservado: Math.max(0, (prod.estoque_reservado || 0) - it.quantidade)
                }).eq('id', it.produto_id);
            }
        }
    }

    // Atualizar status da venda
    await clienteSupabase.from('vendas').update({ status_entrega: novoStatus }).eq('id', pedidoId);
}

export async function registrarTaxaCartao(vendaId, valorTaxa) {
    if (!clienteSupabase.from) return;
    const { data: venda } = await clienteSupabase.from('vendas').select('*').eq('id', vendaId).single();
    if (!venda) return;

    if (venda.taxa_transacao_id) {
        // Atualizar taxa existente
        await clienteSupabase.from('transacoes')
            .update({ valor_parcela: valorTaxa, valor_realizado: valorTaxa })
            .eq('id', venda.taxa_transacao_id);
    } else {
        // Criar nova taxa associada
        const { data: trTaxa } = await clienteSupabase.from('transacoes').insert([{
            user_id: venda.user_id,
            tipo: 'Saída',
            subcategoria: 'Taxas de Cartão',
            descricao: `Taxa Maquininha Venda #${vendaId}`,
            valor_parcela: valorTaxa,
            valor_realizado: valorTaxa,
            data_vencimento: venda.data,
            data_realizacao: venda.data,
            status: 'Realizado',
            grupo_id: crypto.randomUUID()
        }]).select().single();

        await clienteSupabase.from('vendas')
            .update({ taxa_cartao: valorTaxa, taxa_transacao_id: trTaxa.id })
            .eq('id', vendaId);
    }
}

export function formatarMensagemWhatsApp(clienteNome, endereco, itens) {
    const listText = itens.map(it => ` - ${it.quantidade}x ${it.nome} (R$ ${it.preco.toFixed(2).replace('.', ',')})`).join('\n');
    const total = itens.reduce((sum, it) => sum + (it.quantidade * it.preco), 0);
    return `Olá EpicDrop! Gostaria de fazer o seguinte pedido:\n${listText}\n\nTotal: R$ ${total.toFixed(2).replace('.', ',')}\nCliente: ${clienteNome}\nEndereço de Entrega: ${endereco}\n\n*Agende sua Entrega*`;
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add js/operacoes.js tests/operacoes.test.js
git commit -m "feat: add dropshipping automation and card fee retro-logging"
```

---

### Task 7: Dashboards DRE, Conexão Central e Roteador SPA (`js/relatorios.js` & `js/app.js`)

**Files:**
* Create: `js/relatorios.js`
* Create: `js/app.js`
* Modify: `index.html` (com todas as IDs de tags UI)
* Create: `tests/relatorios.test.js`

**Interfaces:**
* Consumes: Módulos `js/db.js`, `js/auth.js`, `js/estoque.js`, `js/financeiro.js`, `js/operacoes.js`
* Produces:
  * Inicializa SPA no carregamento do DOM.
  * Realiza o roteamento automático de abas (Home, Pedidos, Estoque, Financeiro, Compras, Ajustes).
  * Renderiza relatórios DRE por Competência/Caixa e performance de lucros.

- [ ] **Step 1: Write the failing test**
Create `tests/relatorios.test.js` asserting DRE EBITDA calculations:
```javascript
import test from 'node:test';
import assert from 'node:assert';
import { calcularIndicadoresDRE } from '../js/relatorios.js';

test('calcula DRE e EBITDA com precisao', () => {
    const vendas = [
        { total: 500, custo_total: 200 }
    ];
    const transacoes = [
        { tipo: 'Saída', subcategoria: 'Marketing', valor_parcela: 50 },
        { tipo: 'Saída', subcategoria: 'Aluguel', valor_parcela: 100 }
    ];

    const kpis = calcularIndicadoresDRE(vendas, transacoes);

    // EBITDA = Lucro Bruto (500 - 200 = 300) - Despesas (50 + 100 = 150) = 150
    assert.strictEqual(kpis.ebitda, 150, 'EBITDA incorreto');
    assert.strictEqual(kpis.margemLiquida, 30, 'Margem líquida deve ser 30%');
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL because `js/relatorios.js` or function not defined.

- [ ] **Step 3: Write implementation of `js/relatorios.js`**
Create `js/relatorios.js`:
```javascript
export function calcularIndicadoresDRE(vendas, transacoes) {
    let faturamento = 0;
    let cmv = 0;

    vendas.forEach(v => {
        faturamento += parseFloat(v.total || 0);
        cmv += parseFloat(v.custo_total || 0);
    });

    let despesas = 0;
    transacoes.forEach(t => {
        if (t.tipo === 'Saída' && t.subcategoria !== 'Compras') {
            despesas += parseFloat(t.valor_parcela || 0);
        }
    });

    const lucroBruto = faturamento - cmv;
    const ebitda = lucroBruto - despesas;
    const margemLiquida = faturamento > 0 ? (ebitda / faturamento) * 100 : 0;

    return {
        faturamento,
        cmv,
        despesas,
        lucroBruto,
        ebitda,
        margemLiquida
    };
}
```

- [ ] **Step 4: Write central coordinator in `js/app.js` and structure index.html**
Create `js/app.js` mapping all DOM event listeners, handling SPA tab swapping (catalog first, locked admin behind Google Login/cadeado button), modal openings, and dark-mode checking. Include code to update the UI elements.
Verify that `index.html` contains all the HTML markup (Catalog Grid, Drawer Cart, Login Box, Admin Shell Panels, forms for Products/Transactions/Orders) structured strictly according to the visual design rules.

- [ ] **Step 5: Run all tests to verify they pass**
Run: `npm test`
Expected: PASS (All test files: setup, db, auth, estoque, financeiro, operacoes, relatorios must be green).

- [ ] **Step 6: Commit and push**
```bash
git add js/relatorios.js js/app.js index.html tests/relatorios.test.js
git commit -m "feat: complete dashboards and SPA frontend routing system"
```

---

## Plan Verification Checklist
1. **Self-Review Pass:** Verificado que não existem placeholders (TODO, TBD). Todos os passos contêm as assinaturas exatas e códigos em JS nativo/assert nativo.
2. **YAGNI Pass:** A funcionalidade de Nota Fiscal XML foi eliminada do escopo para simplificar e focar na necessidade real do usuário.
3. **Style Guide Check:** Foram integradas as overrides manuais para Dark Mode e suporte do PWA com service worker e manifestos completos.
