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

