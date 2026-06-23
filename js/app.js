import { clienteSupabase, isOnline, cacheOffline } from './db.js';
import { loginComEmail, sair, verificarSessao } from './auth.js';
import { carregarProdutos, salvarProduto, deletarProduto, ordenarProdutosCatalogo, fazerUploadImagem } from './estoque.js';
import { salvarTransacao, excluirTransacao, gerarTransacoesParceladas, calcularSaldosAcumuladosPorDia, exportarBackupJSON } from './financeiro.js';
import { criarPedido, atualizarStatusPedido, registrarTaxaCartao, formatarMensagemWhatsApp } from './operacoes.js';
import { calcularIndicadoresDRE, obterRankingProdutos } from './relatorios.js';

// =========================================================================
// STATE
// =========================================================================
let userAtual = null;
let lojaUserId = null; // Owner's user_id captured from loaded products
let produtosGlobais = [];
let carrinho = [];
let transacoesGlobais = [];
let comprasGlobais = [];
let vendasGlobais = [];
let abaAtivaAdmin = 'financeiro';
let loadingCount = 0;

// =========================================================================
// PREMIUM UTILITIES (Toasts & Loadings from Style Guide)
// =========================================================================
export function mostrarToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast flex items-center gap-3 bg-white border p-4 rounded-xl text-slate-800 font-semibold text-sm transition pointer-events-auto`;
    
    let icone = '<i class="fas fa-info-circle text-blue-500 text-lg"></i>';
    if (tipo === 'success') {
        icone = '<i class="fas fa-check-circle text-green-500 text-lg"></i>';
        toast.classList.add('border-green-100');
    } else if (tipo === 'error') {
        icone = '<i class="fas fa-exclamation-circle text-red-500 text-lg"></i>';
        toast.classList.add('border-red-100');
    } else if (tipo === 'warning') {
        icone = '<i class="fas fa-exclamation-triangle text-amber-500 text-lg"></i>';
        toast.classList.add('border-amber-100');
    } else {
        toast.classList.add('border-blue-100');
    }

    toast.innerHTML = `
        <div class="flex-shrink-0">${icone}</div>
        <div class="flex-1 text-xs md:text-sm">${mensagem}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

export function mostrarLoading() {
    loadingCount++;
    const el = document.getElementById('loading-overlay');
    if (el) el.classList.remove('hidden', 'fade-out');
}

export function ocultarLoading() {
    loadingCount = Math.max(0, loadingCount - 1);
    if (loadingCount === 0) {
        const el = document.getElementById('loading-overlay');
        if (el) {
            el.classList.add('fade-out');
            setTimeout(() => el.classList.add('hidden'), 300);
        }
    }
}

// Modal Animation Helpers
export function abrirModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        el.classList.add('flex');
        setTimeout(() => {
            el.classList.remove('opacity-0');
            el.classList.add('opacity-100');
            const child = el.querySelector('.transform');
            if (child) {
                child.classList.remove('scale-95');
                child.classList.add('scale-100');
            }
        }, 10);
    }
}

export function fecharModal(id) { 
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('opacity-100');
        el.classList.add('opacity-0');
        const child = el.querySelector('.transform');
        if (child) {
            child.classList.remove('scale-100');
            child.classList.add('scale-95');
        }
        setTimeout(() => {
            el.classList.add('hidden');
            el.classList.remove('flex');
        }, 150);
    }
}

// =========================================================================
// PUBLIC CATALOG LOGIC
// =========================================================================
async function inicializarCatalogoPublico() {
    mostrarLoading();
    try {
        const prods = await carregarProdutos();
        produtosGlobais = prods;
        
        // Capture owner user_id from products
        if (prods.length > 0) {
            lojaUserId = prods[0].user_id;
        }

        cacheOffline.salvar('produtos_publicos', prods);
        renderizarCatalogo();
        popularFiltroCategoriasCatalogo();
    } catch (e) {
        console.error(e);
        // Fallback to cache offline
        const cached = cacheOffline.obter('produtos_publicos');
        if (cached) {
            produtosGlobais = cached;
            renderizarCatalogo();
            popularFiltroCategoriasCatalogo();
        }
        mostrarToast("Erro ao carregar catálogo. Exibindo dados locais.", "warning");
    } finally {
        ocultarLoading();
    }
}

function popularFiltroCategoriasCatalogo() {
    const filter = document.getElementById('catalog-category-filter');
    if (!filter) return;
    const cats = [...new Set(produtosGlobais.map(p => p.categoria))].sort();
    
    // Reset options but keep "Todas"
    filter.innerHTML = '<option value="Todas">Todas as Categorias</option>';
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        filter.appendChild(opt);
    });
}

function renderizarCatalogo() {
    const grid = document.getElementById('catalog-grid');
    if (!grid) return;

    const query = document.getElementById('catalog-search').value.toLowerCase().trim();
    const catFilter = document.getElementById('catalog-category-filter').value;

    let filtrados = produtosGlobais.filter(p => {
        const matchesQuery = p.nome.toLowerCase().includes(query) || p.categoria.toLowerCase().includes(query);
        const matchesCat = catFilter === 'Todas' || p.categoria === catFilter;
        return matchesQuery && matchesCat;
    });

    // Ordenar catálogo: em estoque primeiro dentro de cada categoria
    filtrados = ordenarProdutosCatalogo(filtrados);

    document.getElementById('catalog-count').textContent = filtrados.length;

    grid.innerHTML = '';
    if (filtrados.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-400 font-medium">
                <i class="fas fa-boxes text-3xl mb-2"></i>
                <p>Nenhum produto encontrado.</p>
            </div>
        `;
        return;
    }

    filtrados.forEach(p => {
        const card = document.createElement('div');
        card.className = `bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition duration-200 flex flex-col`;
        
        const imgUrl = p.imagem_url || 'https://placehold.co/300x200?text=EpicDrop';
        
        // Badges
        let promoBadge = p.em_promocao ? `<span class="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm">Promo</span>` : '';
        // The user specified "agende sua entrega" badge for all items is more professional
        let deliveryBadge = `<span class="absolute top-2 right-2 bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm">Agende sua Entrega</span>`;

        card.innerHTML = `
            <div class="relative pt-[66%] bg-slate-100 overflow-hidden">
                <img src="${imgUrl}" alt="${p.nome}" class="absolute inset-0 w-full h-full object-cover">
                ${promoBadge}
                ${deliveryBadge}
            </div>
            <div class="p-4 flex-1 flex flex-col justify-between">
                <div>
                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">${p.categoria}</span>
                    <h3 class="font-bold text-slate-800 text-sm mt-1 leading-tight line-clamp-2">${p.nome}</h3>
                </div>
                <div class="mt-4 flex items-center justify-between">
                    <div>
                        <span class="text-[10px] text-slate-400 font-medium block">Preço</span>
                        <span class="text-base font-black text-slate-800">R$ ${parseFloat(p.valor_venda).toFixed(2).replace('.', ',')}</span>
                    </div>
                    <button data-prod-id="${p.id}" class="btn-add-to-cart bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1">
                        <i class="fas fa-cart-plus"></i> Comprar
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    // Add click listeners to Comprar buttons
    grid.querySelectorAll('.btn-add-to-cart').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pId = btn.getAttribute('data-prod-id');
            adicionarAoCarrinho(pId);
        });
    });
}

// =========================================================================
// CART LOGIC
// =========================================================================
function adicionarAoCarrinho(productId) {
    const prod = produtosGlobais.find(p => p.id === productId);
    if (!prod) return;

    const existente = carrinho.find(item => item.id === productId);
    if (existente) {
        existente.quantidade++;
    } else {
        carrinho.push({
            id: prod.id,
            nome: prod.nome,
            preco: prod.valor_venda,
            custo: prod.custo_unitario,
            imagem_url: prod.imagem_url,
            quantidade: 1
        });
    }

    atualizarInterfaceCarrinho();
    mostrarToast(`${prod.nome} adicionado ao carrinho!`, 'success');
}

function atualizarInterfaceCarrinho() {
    const totalCount = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
    const badge = document.getElementById('cart-badge');
    
    if (totalCount > 0) {
        badge.textContent = totalCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    const cartList = document.getElementById('cart-items-list');
    if (!cartList) return;

    cartList.innerHTML = '';
    if (carrinho.length === 0) {
        cartList.innerHTML = `
            <div class="py-12 text-center text-slate-400 font-medium">
                <i class="fas fa-shopping-cart text-3xl mb-2"></i>
                <p>Seu carrinho está vazio.</p>
            </div>
        `;
        document.getElementById('cart-total').textContent = 'R$ 0,00';
        return;
    }

    let totalVal = 0;
    carrinho.forEach(item => {
        const itemVal = item.preco * item.quantidade;
        totalVal += itemVal;
        
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl';
        
        const imgUrl = item.imagem_url || 'https://placehold.co/100?text=EpicDrop';
        
        row.innerHTML = `
            <img src="${imgUrl}" alt="${item.nome}" class="w-12 h-12 object-cover rounded-lg border">
            <div class="flex-1 min-w-0">
                <h4 class="text-xs font-bold text-slate-800 truncate leading-tight">${item.nome}</h4>
                <span class="text-xs font-black text-blue-600 block mt-1">R$ ${parseFloat(item.preco).toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="flex items-center gap-1.5 border border-slate-300 rounded-lg p-0.5 bg-white">
                <button class="btn-cart-minus px-1 text-slate-500 hover:text-slate-700 text-xs" data-id="${item.id}"><i class="fas fa-minus"></i></button>
                <span class="text-xs font-extrabold px-1 min-w-[16px] text-center">${item.quantidade}</span>
                <button class="btn-cart-plus px-1 text-slate-500 hover:text-slate-700 text-xs" data-id="${item.id}"><i class="fas fa-plus"></i></button>
            </div>
            <button class="btn-cart-remove text-red-500 hover:bg-red-50 p-2 rounded-lg text-xs" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
        `;
        cartList.appendChild(row);
    });

    document.getElementById('cart-total').textContent = `R$ ${totalVal.toFixed(2).replace('.', ',')}`;

    // Cart action listeners
    cartList.querySelectorAll('.btn-cart-minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const item = carrinho.find(x => x.id === id);
            if (item) {
                item.quantidade--;
                if (item.quantidade <= 0) {
                    carrinho = carrinho.filter(x => x.id !== id);
                }
                atualizarInterfaceCarrinho();
            }
        });
    });

    cartList.querySelectorAll('.btn-cart-plus').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const item = carrinho.find(x => x.id === id);
            if (item) {
                item.quantidade++;
                atualizarInterfaceCarrinho();
            }
        });
    });

    cartList.querySelectorAll('.btn-cart-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            carrinho = carrinho.filter(x => x.id !== id);
            atualizarInterfaceCarrinho();
        });
    });
}

function abrirCarrinho() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer && overlay) {
        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.add('opacity-100');
            drawer.classList.remove('translate-x-full');
        }, 10);
    }
}

function fecharCarrinho() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer && overlay) {
        drawer.classList.add('translate-x-full');
        overlay.classList.remove('opacity-100');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    }
}

// =========================================================================
// ROUTING / ROUTER SPA
// =========================================================================
function verificarRotasSPA() {
    const params = new URLSearchParams(window.location.search);
    const isAdmin = params.get('admin') === 'true';

    const sectionCatalog = document.getElementById('public-catalog');
    const sectionLogin = document.getElementById('admin-login-overlay');
    const sectionShell = document.getElementById('admin-shell');

    if (isAdmin) {
        sectionCatalog.classList.add('hidden');
        fecharCarrinho();
        
        if (userAtual) {
            // Logged in as Everton
            sectionLogin.classList.add('hidden');
            sectionShell.classList.remove('hidden');
            mudarAbaAdmin(abaAtivaAdmin);
        } else {
            // Not logged in or unauthorized
            sectionShell.classList.add('hidden');
            sectionLogin.classList.remove('hidden');
            sectionLogin.classList.add('flex');
        }
    } else {
        // Public Catalog View
        sectionShell.classList.add('hidden');
        sectionLogin.classList.add('hidden');
        sectionCatalog.classList.remove('hidden');
        inicializarCatalogoPublico();
    }
}

function mudarAbaAdmin(abaId) {
    abaAtivaAdmin = abaId;
    const abas = ['financeiro', 'compras', 'estoque', 'vendas', 'relatorios', 'ajustes'];
    
    abas.forEach(id => {
        const pane = document.getElementById(`tab-${id}`);
        if (pane) pane.classList.add('hidden');
        
        const btnDesk = document.getElementById(`btn-tab-${id}`);
        if (btnDesk) btnDesk.className = "px-3 py-2 text-xs font-extrabold rounded-lg text-slate-500 hover:bg-slate-100 transition flex items-center gap-1.5";
        
        const btnMob = document.getElementById(`mobile-btn-tab-${id}`);
        if (btnMob) {
            btnMob.classList.remove('active', 'text-blue-600');
            btnMob.classList.add('text-slate-400');
        }
    });

    const activePane = document.getElementById(`tab-${abaId}`);
    if (activePane) activePane.classList.remove('hidden');

    const activeBtnDesk = document.getElementById(`btn-tab-${abaId}`);
    if (activeBtnDesk) activeBtnDesk.className = "px-3 py-2 text-xs font-extrabold rounded-lg bg-blue-50 text-blue-700 transition flex items-center gap-1.5";

    const activeBtnMob = document.getElementById(`mobile-btn-tab-${abaId}`);
    if (activeBtnMob) {
        activeBtnMob.classList.add('active', 'text-blue-600');
        activeBtnMob.classList.remove('text-slate-400');
    }

    // Load tab-specific data
    if (abaId === 'financeiro') carregarDadosFinanceiro();
    if (abaId === 'compras') carregarDadosCompras();
    if (abaId === 'estoque') carregarDadosEstoque();
    if (abaId === 'vendas') carregarDadosVendas();
    if (abaId === 'relatorios') carregarDadosRelatorios();
}

// =========================================================================
// DATA CARRIER & RENDERS FOR ADMIN
// =========================================================================

// FINANCEIRO TAB
async function carregarDadosFinanceiro() {
    mostrarLoading();
    try {
        if (!clienteSupabase.from) return;
        const { data, error } = await clienteSupabase.from('transacoes').select('*').order('data_vencimento', { ascending: false });
        if (error) throw error;
        transacoesGlobais = data || [];
        
        // Populate years filter
        const selectYear = document.getElementById('financeiro-filter-year');
        const anos = [...new Set(transacoesGlobais.map(t => t.data_vencimento.split('-')[0]))].sort((a,b)=>b-a);
        selectYear.innerHTML = '<option value="Todos">Todos</option>';
        anos.forEach(ano => {
            selectYear.innerHTML += `<option value="${ano}">${ano}</option>`;
        });

        renderizarFinanceiro();
    } catch (e) {
        mostrarToast("Erro ao carregar dados financeiro.", "error");
    } finally {
        ocultarLoading();
    }
}

function renderizarFinanceiro() {
    const search = document.getElementById('financeiro-search').value.toLowerCase().trim();
    const month = document.getElementById('financeiro-filter-month').value;
    const year = document.getElementById('financeiro-filter-year').value;
    const grouping = document.getElementById('financeiro-grouping').value;

    let filtradas = transacoesGlobais.filter(t => {
        const matchesSearch = t.descricao.toLowerCase().includes(search) || t.subcategoria.toLowerCase().includes(search);
        const [tAno, tMes] = t.data_vencimento.split('-');
        const matchesMonth = month === 'Todos' || tMes === month;
        const matchesYear = year === 'Todos' || tAno === year;
        return matchesSearch && matchesMonth && matchesYear;
    });

    // Render Stats
    let entradasVal = 0;
    let saidasVal = 0;
    let realBalance = 0;

    filtradas.forEach(t => {
        const val = parseFloat(t.status === 'Realizado' ? (t.valor_realizado ?? t.valor_parcela) : t.valor_parcela);
        if (t.tipo === 'Entrada') {
            entradasVal += val;
            if (t.status === 'Realizado') realBalance += val;
        } else {
            saidasVal += val;
            if (t.status === 'Realizado') realBalance -= val;
        }
    });

    document.getElementById('stat-real-balance').textContent = `R$ ${realBalance.toFixed(2).replace('.', ',')}`;
    document.getElementById('stat-entradas').textContent = `R$ ${entradasVal.toFixed(2).replace('.', ',')}`;
    document.getElementById('stat-saidas').textContent = `R$ ${saidasVal.toFixed(2).replace('.', ',')}`;
    document.getElementById('stat-balanco').textContent = `R$ ${(entradasVal - saidasVal).toFixed(2).replace('.', ',')}`;

    // Render table
    const tbody = document.getElementById('table-transactions-body');
    tbody.innerHTML = '';
    
    if (filtradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400">Nenhum lançamento no período.</td></tr>';
    } else {
        filtradas.forEach(t => {
            const statusClass = t.status === 'Realizado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
            const tipoIcon = t.tipo === 'Entrada' ? '<i class="fas fa-arrow-up text-green-600"></i>' : '<i class="fas fa-arrow-down text-red-500"></i>';
            const realText = t.valor_realizado !== null ? `R$ ${parseFloat(t.valor_realizado).toFixed(2).replace('.', ',')}` : '-';

            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 border-b border-slate-100 transition';
            row.innerHTML = `
                <td class="py-3 px-4 font-medium text-slate-600">${t.data_vencimento.split('-').reverse().join('/')}</td>
                <td class="py-3 px-4 font-bold text-slate-800 flex items-center gap-1.5">${tipoIcon} ${t.descricao}</td>
                <td class="py-3 px-4 text-slate-600 font-medium">${t.subcategoria}</td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${statusClass}">${t.status}</span></td>
                <td class="py-3 px-4 text-right font-bold text-slate-800">R$ ${parseFloat(t.valor_parcela).toFixed(2).replace('.', ',')}</td>
                <td class="py-3 px-4 text-right font-bold text-slate-600">${realText}</td>
                <td class="py-3 px-4 text-center">
                    <button class="btn-edit-transaction p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" data-id="${t.id}"><i class="fas fa-edit"></i></button>
                </td>
            `;
            tbody.appendChild(row);
        });

        tbody.querySelectorAll('.btn-edit-transaction').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                abrirModalTransacao(id);
            });
        });
    }

    // Render Daily & Cumulative Balances
    const tbodyBalances = document.getElementById('table-balances-body');
    tbodyBalances.innerHTML = '';

    const saldos = calcularSaldosAcumuladosPorDia(filtradas);
    const datas = Object.keys(saldos).sort();

    if (datas.length === 0) {
        tbodyBalances.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">Sem dados de saldos.</td></tr>';
    } else {
        datas.forEach(dt => {
            const dataFmt = dt.split('-').reverse().join('/');
            const item = saldos[dt];
            const balancoClass = item.balanco < 0 ? 'text-red-500' : 'text-green-600';
            const acumuladoClass = item.acumulado < 0 ? 'text-red-500' : 'text-slate-800';

            const row = document.createElement('tr');
            row.className = 'border-b border-slate-100 hover:bg-slate-50';
            row.innerHTML = `
                <td class="py-2.5 px-4 font-bold text-slate-600">${dataFmt}</td>
                <td class="py-2.5 px-4 text-right font-black ${balancoClass}">R$ ${item.balanco.toFixed(2).replace('.', ',')}</td>
                <td class="py-2.5 px-4 text-right font-black ${acumuladoClass}">R$ ${item.acumulado.toFixed(2).replace('.', ',')}</td>
            `;
            tbodyBalances.appendChild(row);
        });
    }
}

// ESTOQUE TAB
async function carregarDadosEstoque() {
    mostrarLoading();
    try {
        const data = await carregarProdutos();
        produtosGlobais = data;
        renderizarEstoque();
    } catch (e) {
        mostrarToast("Erro ao carregar produtos do estoque.", "error");
    } finally {
        ocultarLoading();
    }
}

function renderizarEstoque() {
    const search = document.getElementById('estoque-search').value.toLowerCase().trim();
    const filtrados = produtosGlobais.filter(p => p.nome.toLowerCase().includes(search) || p.categoria.toLowerCase().includes(search));

    const tbody = document.getElementById('table-products-body');
    tbody.innerHTML = '';

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="p-4 text-center text-slate-400">Nenhum produto em estoque.</td></tr>';
    } else {
        filtrados.forEach(p => {
            const imgUrl = p.imagem_url || 'https://placehold.co/50?text=RAM';
            const promo = p.em_promocao ? '<i class="fas fa-check-circle text-green-600 text-base"></i>' : '<i class="fas fa-times-circle text-slate-300 text-base"></i>';

            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 border-b border-slate-100 transition';
            row.innerHTML = `
                <td class="py-3 px-4"><img src="${imgUrl}" alt="${p.nome}" class="w-10 h-10 object-cover rounded-lg border"></td>
                <td class="py-3 px-4 font-bold text-slate-800">${p.nome}</td>
                <td class="py-3 px-4 text-slate-600 font-medium">${p.categoria}</td>
                <td class="py-3 px-4 text-center font-bold text-slate-700">${p.estoque_atual}</td>
                <td class="py-3 px-4 text-center font-bold text-slate-400">${p.estoque_reservado || 0}</td>
                <td class="py-3 px-4 text-right font-bold text-slate-600">R$ ${parseFloat(p.custo_unitario).toFixed(2).replace('.', ',')}</td>
                <td class="py-3 px-4 text-right font-bold text-slate-800">R$ ${parseFloat(p.valor_venda).toFixed(2).replace('.', ',')}</td>
                <td class="py-3 px-4 text-center">${promo}</td>
                <td class="py-3 px-4 text-center">
                    <button class="btn-edit-product p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" data-id="${p.id}"><i class="fas fa-edit"></i></button>
                </td>
            `;
            tbody.appendChild(row);
        });

        tbody.querySelectorAll('.btn-edit-product').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                abrirModalProduto(id);
            });
        });
    }
}

// COMPRAS TAB
async function carregarDadosCompras() {
    mostrarLoading();
    try {
        if (!clienteSupabase.from) return;
        const { data: compras, error: cErr } = await clienteSupabase.from('compras').select('*').order('data', { ascending: false });
        if (cErr) throw cErr;
        
        comprasGlobais = compras || [];
        
        const tbody = document.getElementById('table-compras-body');
        tbody.innerHTML = '';

        if (comprasGlobais.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Nenhuma compra registrada.</td></tr>';
        } else {
            // For each purchase, fetch the items count
            for (const c of comprasGlobais) {
                const { data: items, error: iErr } = await clienteSupabase.from('compras_itens').select('quantidade').eq('compra_id', c.id);
                const qtdTotal = iErr ? 0 : items.reduce((sum, item) => sum + item.quantidade, 0);

                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-50 border-b border-slate-100 transition';
                row.innerHTML = `
                    <td class="py-3 px-4 font-medium text-slate-600">${c.data.split('-').reverse().join('/')}</td>
                    <td class="py-3 px-4 font-bold text-slate-850">${c.fornecedor}</td>
                    <td class="py-3 px-4 text-slate-600 font-medium">${qtdTotal} unidades</td>
                    <td class="py-3 px-4 text-right font-black text-slate-800">R$ ${parseFloat(c.total).toFixed(2).replace('.', ',')}</td>
                `;
                tbody.appendChild(row);
            }
        }
    } catch (e) {
        mostrarToast("Erro ao carregar compras.", "error");
    } finally {
        ocultarLoading();
    }
}

// PEDIDOS TAB
async function carregarDadosVendas() {
    mostrarLoading();
    try {
        if (!clienteSupabase.from) return;
        const { data: vendas, error: vErr } = await clienteSupabase.from('vendas').select('*').order('data', { ascending: false });
        if (vErr) throw vErr;
        
        vendasGlobais = vendas || [];

        const tbody = document.getElementById('table-orders-body');
        tbody.innerHTML = '';

        if (vendasGlobais.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-400">Nenhum pedido registrado.</td></tr>';
        } else {
            for (const v of vendasGlobais) {
                // Fetch sales items descriptions
                const { data: items, error: iErr } = await clienteSupabase.from('vendas_itens').select('*, produtos(nome)').eq('venda_id', v.id);
                let itemsStr = '';
                if (!iErr && items) {
                    itemsStr = items.map(it => `${it.quantidade}x ${it.produtos?.nome || 'Produto'}`).join('<br>');
                }

                const statusPag = v.status_pagamento === 'Pago' 
                    ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-green-100 text-green-700 uppercase">Pago</span>'
                    : '<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-700 uppercase">Pendente</span>';

                let statusEntClass = 'bg-slate-100 text-slate-600';
                if (v.status_entrega === 'Adquirido') statusEntClass = 'bg-blue-100 text-blue-700';
                if (v.status_entrega === 'Entregue') statusEntClass = 'bg-green-100 text-green-700';

                const statusEnt = `<span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusEntClass}">${v.status_entrega || 'Encomendado'}</span>`;

                const taxaText = v.taxa_cartao !== null ? `R$ ${parseFloat(v.taxa_cartao).toFixed(2).replace('.', ',')}` : '-';

                // Render actions
                let actions = '<div class="flex flex-col sm:flex-row gap-1 justify-center">';
                if (v.status_pagamento === 'Pendente') {
                    actions += `<button class="btn-order-pay bg-green-600 hover:bg-green-700 text-white text-[10px] font-black px-2 py-1 rounded transition" data-id="${v.id}">Pagar</button>`;
                }
                if (v.status_entrega === 'Encomendado') {
                    actions += `<button class="btn-order-adquirir bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-2 py-1 rounded transition" data-id="${v.id}">Adquirir</button>`;
                } else if (v.status_entrega === 'Adquirido') {
                    actions += `<button class="btn-order-entregar bg-green-600 hover:bg-green-700 text-white text-[10px] font-black px-2 py-1 rounded transition" data-id="${v.id}">Entregar</button>`;
                }
                actions += `<button class="btn-order-fee bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded transition" data-id="${v.id}" data-current="${v.taxa_cartao || ''}"><i class="fas fa-credit-card"></i> Taxa</button>`;
                actions += '</div>';

                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-50 border-b border-slate-100 transition text-xs';
                row.innerHTML = `
                    <td class="py-3 px-4 font-medium text-slate-600">${v.data.split('-').reverse().join('/')}</td>
                    <td class="py-3 px-4 font-bold text-slate-800">${v.cliente}<br><span class="text-[10px] font-medium text-slate-400">${v.endereco || ''}</span></td>
                    <td class="py-3 px-4 font-medium text-slate-600">${itemsStr}</td>
                    <td class="py-3 px-4 text-right font-black text-slate-800">R$ ${parseFloat(v.total).toFixed(2).replace('.', ',')}</td>
                    <td class="py-3 px-4 text-center">${statusPag}</td>
                    <td class="py-3 px-4 text-center">${statusEnt}</td>
                    <td class="py-3 px-4 text-right font-bold text-slate-600">${taxaText}</td>
                    <td class="py-3 px-4 text-center">${actions}</td>
                `;
                tbody.appendChild(row);
            }

            // Pay event listeners
            tbody.querySelectorAll('.btn-order-pay').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    mostrarLoading();
                    try {
                        // Mark order as paid
                        const { error } = await clienteSupabase.from('vendas').update({ status_pagamento: 'Pago' }).eq('id', id);
                        if (error) throw error;
                        
                        // Update financial transaction
                        const { data: v } = await clienteSupabase.from('vendas').select('transacao_id, total, data').eq('id', id).single();
                        if (v && v.transacao_id) {
                            await clienteSupabase.from('transacoes').update({ 
                                status: 'Realizado', 
                                valor_realizado: v.total,
                                data_realizacao: v.data
                            }).eq('id', v.transacao_id);
                        }

                        mostrarToast("Pedido marcado como pago!", "success");
                        carregarDadosVendas();
                    } catch (err) {
                        mostrarToast("Erro ao processar pagamento.", "error");
                    } finally {
                        ocultarLoading();
                    }
                });
            });

            // Adquirir event listeners
            tbody.querySelectorAll('.btn-order-adquirir').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    mostrarLoading();
                    try {
                        await atualizarStatusPedido(id, 'Adquirido');
                        mostrarToast("Pedido adquirido! Compra e caixa atualizados.", "success");
                        carregarDadosVendas();
                    } catch (err) {
                        mostrarToast("Erro ao atualizar status do pedido.", "error");
                    } finally {
                        ocultarLoading();
                    }
                });
            });

            // Entregar event listeners
            tbody.querySelectorAll('.btn-order-entregar').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    mostrarLoading();
                    try {
                        await atualizarStatusPedido(id, 'Entregue');
                        mostrarToast("Pedido entregue! Estoques físico e reservado deduzidos.", "success");
                        carregarDadosVendas();
                    } catch (err) {
                        mostrarToast("Erro ao atualizar status do pedido.", "error");
                    } finally {
                        ocultarLoading();
                    }
                });
            });

            // Card Fee event listeners
            tbody.querySelectorAll('.btn-order-fee').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const curr = btn.getAttribute('data-current');
                    document.getElementById('fee-order-id').value = id;
                    document.getElementById('fee-amount').value = curr;
                    abrirModal('modal-fee');
                });
            });
        }
    } catch (e) {
        mostrarToast("Erro ao carregar pedidos.", "error");
    } finally {
        ocultarLoading();
    }
}

// RELATÓRIOS TAB
async function carregarDadosRelatorios() {
    mostrarLoading();
    try {
        if (!clienteSupabase.from) return;
        const { data: transacoes, error: tErr } = await clienteSupabase.from('transacoes').select('*');
        if (tErr) throw tErr;
        const { data: vendas, error: vErr } = await clienteSupabase.from('vendas').select('*');
        if (vErr) throw vErr;
        const { data: produtos, error: pErr } = await clienteSupabase.from('produtos').select('*');
        if (pErr) throw pErr;

        // Populate years filter in relatorios
        const selectYear = document.getElementById('relatorio-filter-year');
        const anos = [...new Set(transacoes.map(t => t.data_vencimento.split('-')[0]))].sort((a,b)=>b-a);
        
        let selectVal = selectYear.value;
        selectYear.innerHTML = '';
        if (anos.length === 0) {
            const anoAtual = new Date().getFullYear().toString();
            selectYear.innerHTML = `<option value="${anoAtual}">${anoAtual}</option>`;
        } else {
            anos.forEach(ano => {
                selectYear.innerHTML += `<option value="${ano}">${ano}</option>`;
            });
        }
        if (selectVal && anos.includes(selectVal)) {
            selectYear.value = selectVal;
        } else {
            selectYear.value = new Date().getFullYear().toString();
        }

        renderizarRelatorios(transacoes, vendas, produtos);
    } catch (e) {
        mostrarToast("Erro ao processar relatórios.", "error");
    } finally {
        ocultarLoading();
    }
}

function renderizarRelatorios(transacoes = [], vendas = [], produtos = []) {
    const mes = document.getElementById('relatorio-filter-month').value;
    const ano = document.getElementById('relatorio-filter-year').value;
    const periodo = `${ano}-${mes}`;

    const vendasPeriodo = vendas.filter(v => v.data.startsWith(periodo));
    const transacoesPeriodo = transacoes.filter(t => t.data_vencimento.startsWith(periodo));
    const transacoesCaixaPeriodo = transacoes.filter(t => t.status === 'Realizado' && t.data_realizacao?.startsWith(periodo));

    // Calculate Competence DRE
    const kpis = calcularIndicadoresDRE(vendasPeriodo, transacoesPeriodo);

    // Update KPIs Cards
    document.getElementById('dre-ebitda').textContent = `R$ ${kpis.ebitda.toFixed(2).replace('.', ',')}`;
    document.getElementById('dre-margin').textContent = `${kpis.margemLiquida.toFixed(1)}%`;
    
    const markupVal = kpis.cmv > 0 ? ((kpis.faturamento - kpis.cmv) / kpis.cmv) * 100 : 0;
    document.getElementById('dre-markup').textContent = `${markupVal.toFixed(1)}%`;

    const mcPorc = kpis.faturamento > 0 ? (kpis.faturamento - kpis.cmv) / kpis.faturamento : 0.4;
    const breakevenVal = mcPorc > 0 ? kpis.despesas / mcPorc : 0;
    document.getElementById('dre-breakeven').textContent = `R$ ${breakevenVal.toFixed(2).replace('.', ',')}`;

    // EBITDA styling
    const ebitdaEl = document.getElementById('dre-ebitda');
    if (kpis.ebitda < 0) {
        ebitdaEl.className = 'text-base font-black text-red-500 mt-1';
    } else {
        ebitdaEl.className = 'text-base font-black text-green-600 mt-1';
    }

    // Margin styling
    const marginEl = document.getElementById('dre-margin');
    if (kpis.margemLiquida < 0) {
        marginEl.className = 'text-base font-black text-red-500 mt-1';
    } else {
        marginEl.className = 'text-base font-black text-green-600 mt-1';
    }

    // Render Competence DRE Table
    const competenceBody = document.getElementById('dre-competencia-body');
    
    // Group competence expenses by subcategory
    const expComp = {};
    transacoesPeriodo.forEach(t => {
        if (t.tipo === 'Saída' && t.subcategoria !== 'Compras') {
            expComp[t.subcategoria] = (expComp[t.subcategoria] || 0) + parseFloat(t.valor_parcela || 0);
        }
    });

    let competenceRows = `
        <tr class="bg-blue-50/40 font-black text-xs">
            <td class="py-2 px-3">(=) RECEITA BRUTA DE VENDAS</td>
            <td class="py-2 px-3 text-right">R$ ${kpis.faturamento.toFixed(2).replace('.', ',')}</td>
            <td class="py-2 px-3 text-right">100%</td>
        </tr>
        <tr class="text-red-500 font-bold">
            <td class="py-2 px-4 pl-6">(-) Custo de Mercadorias Vendidas (CMV)</td>
            <td class="py-2 px-3 text-right">R$ ${kpis.cmv.toFixed(2).replace('.', ',')}</td>
            <td class="py-2 px-3 text-right">${kpis.faturamento > 0 ? ((kpis.cmv / kpis.faturamento) * 100).toFixed(1) : 0}%</td>
        </tr>
        <tr class="bg-slate-50 font-black">
            <td class="py-2 px-3">(=) LUCRO BRUTO</td>
            <td class="py-2 px-3 text-right">R$ ${kpis.lucroBruto.toFixed(2).replace('.', ',')}</td>
            <td class="py-2 px-3 text-right">${kpis.faturamento > 0 ? ((kpis.lucroBruto / kpis.faturamento) * 100).toFixed(1) : 0}%</td>
        </tr>
        <tr class="bg-slate-100/50 text-[10px] text-slate-400 font-black tracking-wider uppercase">
            <td class="py-1.5 px-3" colspan="3">(-) DESPESAS OPERACIONAIS</td>
        </tr>
    `;

    if (Object.keys(expComp).length === 0) {
        competenceRows += `
            <tr class="text-slate-450 font-medium">
                <td class="py-2 px-6" colspan="3">Nenhuma despesa operacional.</td>
            </tr>
        `;
    } else {
        for (let sub in expComp) {
            const val = expComp[sub];
            competenceRows += `
                <tr class="text-slate-600 font-semibold">
                    <td class="py-2 px-6 pl-8">${sub}</td>
                    <td class="py-2 px-3 text-right">R$ ${val.toFixed(2).replace('.', ',')}</td>
                    <td class="py-2 px-3 text-right">${kpis.faturamento > 0 ? ((val / kpis.faturamento) * 100).toFixed(1) : 0}%</td>
                </tr>
            `;
        }
    }

    competenceRows += `
        <tr class="bg-slate-100 font-black border-t">
            <td class="py-2 px-3">(=) EBITDA</td>
            <td class="py-2 px-3 text-right">R$ ${kpis.ebitda.toFixed(2).replace('.', ',')}</td>
            <td class="py-2 px-3 text-right">${kpis.faturamento > 0 ? ((kpis.ebitda / kpis.faturamento) * 100).toFixed(1) : 0}%</td>
        </tr>
        <tr class="bg-green-50 font-black border-y border-green-200">
            <td class="py-2 px-3">(=) RESULTADO LÍQUIDO (LUCRO/PREJUÍZO)</td>
            <td class="py-2 px-3 text-right ${kpis.ebitda < 0 ? 'text-red-600' : 'text-green-700'}">R$ ${kpis.ebitda.toFixed(2).replace('.', ',')}</td>
            <td class="py-2 px-3 text-right ${kpis.ebitda < 0 ? 'text-red-600' : 'text-green-700'}">${kpis.faturamento > 0 ? ((kpis.ebitda / kpis.faturamento) * 100).toFixed(1) : 0}%</td>
        </tr>
    `;

    competenceBody.innerHTML = competenceRows;

    // Calculate Cash DRE
    const cashBody = document.getElementById('dre-caixa-body');
    let cashEntradas = 0;
    let cashSaidas = 0;
    const subEnt = {};
    const subSai = {};

    transacoesCaixaPeriodo.forEach(t => {
        const val = parseFloat(t.valor_realizado || 0);
        if (t.tipo === 'Entrada') {
            subEnt[t.subcategoria] = (subEnt[t.subcategoria] || 0) + val;
            cashEntradas += val;
        } else {
            subSai[t.subcategoria] = (subSai[t.subcategoria] || 0) + val;
            cashSaidas += val;
        }
    });

    let cashRows = `
        <tr class="bg-green-55/20 text-green-900 font-black tracking-wider uppercase">
            <td class="py-2 px-3" colspan="3">(+) RECEITAS DE CAIXA REALIZADAS</td>
        </tr>
    `;

    if (Object.keys(subEnt).length === 0) {
        cashRows += '<tr><td colspan="3" class="py-2 px-6 text-slate-400 font-medium">Nenhuma entrada no período.</td></tr>';
    } else {
        for (let sub in subEnt) {
            const val = subEnt[sub];
            cashRows += `
                <tr class="text-slate-600 font-semibold">
                    <td class="py-2 px-6 pl-8">${sub}</td>
                    <td class="py-2 px-3 text-right text-emerald-600">R$ ${val.toFixed(2).replace('.', ',')}</td>
                    <td class="py-2 px-3 text-right">${cashEntradas > 0 ? ((val / cashEntradas) * 100).toFixed(1) : 0}%</td>
                </tr>
            `;
        }
    }

    cashRows += `
        <tr class="bg-green-50 font-black border-t">
            <td class="py-2 px-3">(=) TOTAL ENTRADAS CAIXA</td>
            <td class="py-2 px-3 text-right text-green-700">R$ ${cashEntradas.toFixed(2).replace('.', ',')}</td>
            <td class="py-2 px-3 text-right">100%</td>
        </tr>
        <tr class="bg-red-55/20 text-red-900 font-black tracking-wider uppercase">
            <td class="py-2 px-3" colspan="3">(-) SAÍDAS DE CAIXA REALIZADAS</td>
        </tr>
    `;

    if (Object.keys(subSai).length === 0) {
        cashRows += '<tr><td colspan="3" class="py-2 px-6 text-slate-400 font-medium">Nenhuma saída no período.</td></tr>';
    } else {
        for (let sub in subSai) {
            const val = subSai[sub];
            cashRows += `
                <tr class="text-slate-600 font-semibold">
                    <td class="py-2 px-6 pl-8">${sub}</td>
                    <td class="py-2 px-3 text-right text-red-500">R$ ${val.toFixed(2).replace('.', ',')}</td>
                    <td class="py-2 px-3 text-right">${cashSaidas > 0 ? ((val / cashSaidas) * 100).toFixed(1) : 0}%</td>
                </tr>
            `;
        }
    }

    const netCash = cashEntradas - cashSaidas;
    cashRows += `
        <tr class="bg-red-50 font-black border-t">
            <td class="py-2 px-3">(=) TOTAL SAÍDAS CAIXA</td>
            <td class="py-2 px-3 text-right text-red-600">R$ ${cashSaidas.toFixed(2).replace('.', ',')}</td>
            <td class="py-2 px-3 text-right">${cashEntradas > 0 ? ((cashSaidas / cashEntradas) * 100).toFixed(1) : 0}%</td>
        </tr>
        <tr class="bg-blue-50 font-black border-y border-blue-200">
            <td class="py-2 px-3">(=) SALDO LÍQUIDO DE CAIXA NO PERÍODO</td>
            <td class="py-2 px-3 text-right ${netCash < 0 ? 'text-red-600' : 'text-blue-700'}">R$ ${netCash.toFixed(2).replace('.', ',')}</td>
            <td class="py-2 px-3 text-right ${netCash < 0 ? 'text-red-600' : 'text-blue-700'}">${cashEntradas > 0 ? ((netCash / cashEntradas) * 100).toFixed(1) : 0}%</td>
        </tr>
    `;

    cashBody.innerHTML = cashRows;

    // Render Product Performance Ranking
    // We need sales orders items as structured array
    const ordersWithItems = [];
    
    // Asynchronously fetched or already local. Let's build from Supabase mock-friendly items query if needed,
    // but we can query all vendas_itens for these orders.
    // To make it simple, we already fetched `vendas_itens` in the tests, let's query them here.
    const tbodyRanking = document.getElementById('table-ranking-body');
    tbodyRanking.innerHTML = '';

    const queryItems = async () => {
        if (!clienteSupabase.from) return;
        const vIds = vendasPeriodo.map(v => v.id);
        if (vIds.length === 0) {
            tbodyRanking.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Nenhuma venda de produto no período.</td></tr>';
            return;
        }

        const { data: vItens, error } = await clienteSupabase.from('vendas_itens').select('*').in('venda_id', vIds);
        if (error) return;

        // Group into order objects to pass to obterRankingProdutos
        const mockOrders = vIds.map(vid => ({
            id: vid,
            itens: vItens.filter(it => it.venda_id === vid)
        }));

        const rank = obterRankingProdutos(mockOrders, produtos);
        // Sort by revenue descending
        rank.sort((a,b) => b.faturamento - a.faturamento);

        if (rank.length === 0) {
            tbodyRanking.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Nenhuma venda de produto no período.</td></tr>';
        } else {
            rank.forEach(r => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-50 border-b border-slate-100 transition';
                row.innerHTML = `
                    <td class="py-3 px-4 font-bold text-slate-800">${r.nome}</td>
                    <td class="py-3 px-4 text-center font-bold text-slate-600">${r.quantidade} un</td>
                    <td class="py-3 px-4 text-right font-black text-slate-800">R$ ${r.faturamento.toFixed(2).replace('.', ',')}</td>
                    <td class="py-3 px-4 text-right font-black text-blue-600">R$ ${r.lucro.toFixed(2).replace('.', ',')}</td>
                `;
                tbodyRanking.appendChild(row);
            });
        }
    };
    queryItems();
}

function imprimirDRE() {
    const elAno = document.getElementById('relatorio-filter-year').value;
    const elMes = document.getElementById('relatorio-filter-month').value;
    
    const tableComp = document.getElementById('dre-competencia-imprimir').outerHTML;
    const tableCash = document.getElementById('dre-caixa-imprimir').outerHTML;
    const tableRank = document.getElementById('table-ranking-body').closest('table').outerHTML;

    const win = window.open('', '_blank');
    win.document.write(`
        <html>
        <head>
            <title>DRE EpicDrop - ${elMes}/${elAno}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
            <style>
                @media print {
                    body { font-size: 12px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body class="bg-white p-8 text-slate-800 font-sans">
            <div class="max-w-4xl mx-auto border p-6 rounded-2xl shadow-sm">
                <div class="flex justify-between items-center border-b pb-4 mb-6">
                    <div>
                        <h1 class="text-xl font-black text-slate-900">EpicDrop Informática</h1>
                        <p class="text-xs text-slate-400 font-medium">Controle Contábil Profissional</p>
                    </div>
                    <div class="text-right">
                        <span class="text-xs font-black bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg uppercase tracking-wider">Demonstrativos de Resultados</span>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>${tableComp}</div>
                    <div>${tableCash}</div>
                </div>

                <div class="mt-8">
                    <h3 class="font-extrabold text-slate-800 text-sm mb-3 uppercase tracking-wider">Ranking e Desempenho de Vendas</h3>
                    ${tableRank}
                </div>

                <div class="border-t pt-4 mt-8 text-center text-[10px] text-slate-400 font-semibold">
                    Documento contábil emitido automaticamente em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}.
                </div>
            </div>
            
            <div class="fixed bottom-6 right-6 no-print">
                <button onclick="window.print()" class="bg-slate-850 hover:bg-slate-950 text-white font-extrabold px-6 py-3 rounded-xl shadow-lg transition flex items-center gap-2">
                    <i class="fas fa-print"></i> Imprimir demonstrativo
                </button>
            </div>
        </body>
        </html>
    `);
    win.document.close();
}

// =========================================================================
// ACTION MODAL OPENS & SUBMISSIONS FOR ADMIN
// =========================================================================

// TRANSACTION FORM
function abrirModalTransacao(id = null) {
    const title = document.getElementById('modal-transaction-title');
    const form = document.getElementById('form-transaction');
    const deleteBtn = document.getElementById('btn-delete-transaction');
    
    form.reset();
    document.getElementById('transaction-id').value = '';
    deleteBtn.classList.add('hidden');

    if (id) {
        title.textContent = 'Editar Lançamento Financeiro';
        deleteBtn.classList.remove('hidden');
        
        const t = transacoesGlobais.find(x => x.id === id);
        if (t) {
            document.getElementById('transaction-id').value = t.id;
            document.getElementById('transaction-type').value = t.tipo;
            document.getElementById('transaction-category').value = t.subcategoria;
            document.getElementById('transaction-description').value = t.descricao;
            document.getElementById('transaction-amount-parcela').value = t.valor_parcela;
            document.getElementById('transaction-amount-realizado').value = t.valor_realizado || '';
            document.getElementById('transaction-date-vencimento').value = t.data_vencimento;
            document.getElementById('transaction-date-realizacao').value = t.data_realizacao || '';
            document.getElementById('transaction-status').value = t.status;
            document.getElementById('transaction-recurrence-count').value = t.total_parcelas || 0;
            document.getElementById('transaction-recurrence-frequency').value = t.frequencia || 'Mensal';
        }
    } else {
        title.textContent = 'Novo Lançamento Financeiro';
        document.getElementById('transaction-date-vencimento').value = new Date().toISOString().split('T')[0];
    }
    
    abrirModal('modal-transaction');
}

async function submeterTransacao(e) {
    e.preventDefault();
    const id = document.getElementById('transaction-id').value || null;
    const type = document.getElementById('transaction-type').value;
    const category = document.getElementById('transaction-category').value.trim();
    const description = document.getElementById('transaction-description').value.trim();
    const amountParcela = parseFloat(document.getElementById('transaction-amount-parcela').value);
    const amountRealizadoVal = document.getElementById('transaction-amount-realizado').value;
    const amountRealizado = amountRealizadoVal ? parseFloat(amountRealizadoVal) : null;
    const dateVenc = document.getElementById('transaction-date-vencimento').value;
    const dateReal = document.getElementById('transaction-date-realizacao').value || null;
    const status = document.getElementById('transaction-status').value;
    const recurrenceCount = parseInt(document.getElementById('transaction-recurrence-count').value) || 0;
    const recurrenceFreq = document.getElementById('transaction-recurrence-frequency').value;

    const payload = {
        user_id: userAtual.id,
        tipo: type,
        subcategoria: category,
        descricao: description,
        valor_parcela: amountParcela,
        valor_realizado: amountRealizado,
        data_vencimento: dateVenc,
        data_realizacao: dateReal,
        status: status
    };

    mostrarLoading();
    try {
        if (recurrenceCount > 0 && !id) {
            // Generate installments
            const installments = gerarTransacoesParceladas(payload, recurrenceCount, recurrenceFreq);
            for (const inst of installments) {
                await salvarTransacao(inst);
            }
        } else {
            await salvarTransacao(payload, id);
        }
        
        mostrarToast("Lançamento salvo com sucesso!", "success");
        fecharModal('modal-transaction');
        carregarDadosFinanceiro();
    } catch (err) {
        mostrarToast("Erro ao salvar transação.", "error");
    } finally {
        ocultarLoading();
    }
}

async function excluirTransacaoAtual() {
    const id = document.getElementById('transaction-id').value;
    if (!id) return;
    if (!confirm("Tem certeza que deseja excluir esta transação?")) return;

    mostrarLoading();
    try {
        await excluirTransacao(id);
        mostrarToast("Lançamento excluído com sucesso!", "success");
        fecharModal('modal-transaction');
        carregarDadosFinanceiro();
    } catch (err) {
        mostrarToast("Erro ao excluir transação.", "error");
    } finally {
        ocultarLoading();
    }
}

// PRODUCT FORM
function abrirModalProduto(id = null) {
    const title = document.getElementById('modal-product-title');
    const form = document.getElementById('form-product');
    const deleteBtn = document.getElementById('btn-delete-product');
    
    form.reset();
    document.getElementById('product-id').value = '';
    deleteBtn.classList.add('hidden');

    if (id) {
        title.textContent = 'Editar Produto';
        deleteBtn.classList.remove('hidden');
        
        const p = produtosGlobais.find(x => x.id === id);
        if (p) {
            document.getElementById('product-id').value = p.id;
            document.getElementById('product-name').value = p.nome;
            document.getElementById('product-category').value = p.categoria;
            document.getElementById('product-stock-actual').value = p.estoque_atual;
            document.getElementById('product-price-cost').value = p.custo_unitario;
            document.getElementById('product-price-sale').value = p.valor_venda;
            document.getElementById('product-promo').checked = p.em_promocao || false;
        }
    } else {
        title.textContent = 'Novo Produto';
    }
    
    abrirModal('modal-product');
}

async function submeterProduto(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value || null;
    const name = document.getElementById('product-name').value.trim();
    const category = document.getElementById('product-category').value.trim();
    const stockActual = parseInt(document.getElementById('product-stock-actual').value) || 0;
    const priceCost = parseFloat(document.getElementById('product-price-cost').value);
    const priceSale = parseFloat(document.getElementById('product-price-sale').value);
    const promo = document.getElementById('product-promo').checked;
    const imageFile = document.getElementById('product-image-file').files[0];

    mostrarLoading();
    try {
        let imageUrl = null;
        if (imageFile) {
            imageUrl = await fazerUploadImagem(imageFile);
        } else if (id) {
            const prodExistente = produtosGlobais.find(x => x.id === id);
            imageUrl = prodExistente ? prodExistente.imagem_url : null;
        }

        const payload = {
            user_id: userAtual.id,
            nome: name,
            categoria: category,
            estoque_atual: stockActual,
            custo_unitario: priceCost,
            valor_venda: priceSale,
            em_promocao: promo
        };
        if (imageUrl) {
            payload.imagem_url = imageUrl;
        }

        await salvarProduto(payload, id);
        mostrarToast("Produto salvo com sucesso!", "success");
        fecharModal('modal-product');
        carregarDadosEstoque();
    } catch (err) {
        mostrarToast("Erro ao salvar produto.", "error");
    } finally {
        ocultarLoading();
    }
}

async function excluirProdutoAtual() {
    const id = document.getElementById('product-id').value;
    if (!id) return;
    if (!confirm("Tem certeza que deseja deletar este produto?")) return;

    mostrarLoading();
    try {
        await deletarProduto(id);
        mostrarToast("Produto removido com sucesso!", "success");
        fecharModal('modal-product');
        carregarDadosEstoque();
    } catch (err) {
        mostrarToast("Erro ao deletar produto.", "error");
    } finally {
        ocultarLoading();
    }
}

// FEE FORM
async function submeterTaxa(e) {
    e.preventDefault();
    const id = document.getElementById('fee-order-id').value;
    const feeVal = parseFloat(document.getElementById('fee-amount').value) || 0;

    mostrarLoading();
    try {
        await registrarTaxaCartao(id, feeVal);
        mostrarToast("Taxa registrada retroativamente com sucesso!", "success");
        fecharModal('modal-fee');
        carregarDadosVendas();
    } catch (err) {
        mostrarToast("Erro ao registrar taxa.", "error");
    } finally {
        ocultarLoading();
    }
}

// =========================================================================
// CUSTOMER CHECKOUT
// =========================================================================
async function submeterCheckout(e) {
    e.preventDefault();
    if (carrinho.length === 0) {
        mostrarToast("Seu carrinho está vazio.", "warning");
        return;
    }

    const name = document.getElementById('cart-client-name').value.trim();
    const address = document.getElementById('cart-client-address').value.trim();

    mostrarLoading();
    try {
        const orderItems = carrinho.map(item => ({
            produto_id: item.id,
            quantidade: item.quantidade,
            valor_venda: item.preco,
            custo_unitario: item.custo
        }));

        const orderData = {
            user_id: lojaUserId || '00000000-0000-0000-0000-000000000000', // Use captured store user_id or generic fallback
            cliente: name,
            endereco: address,
            data: new Date().toISOString().split('T')[0],
            status_pagamento: 'Pendente'
        };

        // 1. Save to Supabase (creates sales + item entries + sets status + pending ledger)
        await criarPedido(orderData, orderItems);

        // 2. Format WhatsApp link and redirect
        const whatsItems = carrinho.map(item => ({
            nome: item.nome,
            quantidade: item.quantidade,
            preco: item.preco
        }));

        const msgText = formatarMensagemWhatsApp(name, address, whatsItems);
        // Direct checkout to Everton's WhatsApp number (hardcoded/standard configuration)
        const waUrl = `https://wa.me/5521972828691?text=${encodeURIComponent(msgText)}`;
        
        mostrarToast("Pedido registrado! Redirecionando para o WhatsApp...", "success");
        
        // Reset Cart
        carrinho = [];
        atualizarInterfaceCarrinho();
        fecharCarrinho();
        document.getElementById('cart-checkout-form').reset();

        // Redirect
        window.open(waUrl, '_blank');
    } catch (err) {
        console.error(err);
        mostrarToast("Erro ao processar seu pedido. Tente novamente.", "error");
    } finally {
        ocultarLoading();
    }
}

// =========================================================================
// AUTHENTICATION WIRING
// =========================================================================
async function tentarLogin(e) {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const pass = document.getElementById('admin-password').value;

    mostrarLoading();
    try {
        const user = await loginComEmail(email, pass);
        userAtual = user;
        mostrarToast("Acesso autorizado!", "success");
        verificarRotasSPA();
    } catch (err) {
        mostrarToast(err.message || "Erro de login. Verifique as credenciais.", "error");
    } finally {
        ocultarLoading();
    }
}

async function tentarSair() {
    mostrarLoading();
    try {
        await sair();
        userAtual = null;
        mostrarToast("Sessão encerrada.", "success");
        verificarRotasSPA();
    } catch (err) {
        console.error(err);
    } finally {
        ocultarLoading();
    }
}

// =========================================================================
// ADJUSTMENTS & THEMES
// =========================================================================
function initConfiguracoes() {
    // Theme setup
    const isDark = localStorage.getItem('epicdrop_theme') === 'dark';
    if (isDark) {
        document.documentElement.classList.add('dark');
        const toggles = [document.getElementById('admin-dark-mode-toggle')];
        toggles.forEach(t => { if (t) t.checked = true; });
    }

    // Bind theme toggles
    const catToggle = document.getElementById('catalog-theme-toggle');
    if (catToggle) {
        catToggle.addEventListener('click', () => {
            const isD = document.documentElement.classList.toggle('dark');
            localStorage.setItem('epicdrop_theme', isD ? 'dark' : 'light');
            mostrarToast("Tema alternado!", "success");
        });
    }

    const adminToggle = document.getElementById('admin-dark-mode-toggle');
    if (adminToggle) {
        adminToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('epicdrop_theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('epicdrop_theme', 'light');
            }
            mostrarToast("Tema alternado!", "success");
        });
    }

    // Notification Permission
    const notifBtn = document.getElementById('btn-request-notif');
    if (notifBtn) {
        if ('Notification' in window && Notification.permission === 'granted') {
            notifBtn.textContent = 'Ativado ✓';
            notifBtn.disabled = true;
            notifBtn.className = 'bg-green-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-default';
        }
        notifBtn.addEventListener('click', async () => {
            if (!('Notification' in window)) {
                mostrarToast("Navegador não suporta notificações.", "warning");
                return;
            }
            const perm = await Notification.requestPermission();
            if (perm === 'granted') {
                mostrarToast("Lembretes push ativados!", "success");
                notifBtn.textContent = 'Ativado ✓';
                notifBtn.disabled = true;
                notifBtn.className = 'bg-green-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-default';
            }
        });
    }

    // Export Backup
    const exportBtn = document.getElementById('btn-export-backup');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const backup = exportarBackupJSON(
                userAtual ? userAtual.email : 'anonimo',
                transacoesGlobais,
                [], // subcategorias are dynamic categories in EpicDrop
                produtosGlobais,
                [], // clients
                []  // suppliers
            );
            const blob = new Blob([backup], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `epicdrop-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            mostrarToast("Backup exportado!", "success");
        });
    }
}

// =========================================================================
// INITIALIZATION
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verify existing session
    try {
        const session = await verificarSessao();
        if (session && session.user && session.user.email === 'evertonmaxwel@gmail.com') {
            userAtual = session.user;
            document.getElementById('admin-user-email').textContent = userAtual.email;
        }
    } catch (e) {
        console.warn("Sem sessão prévia.");
    }

    // 2. Setup Route listening
    verificarRotasSPA();
    window.addEventListener('popstate', verificarRotasSPA);

    // 3. Setup configurations and PWA Settings
    initConfiguracoes();

    // ==========================================
    // BIND EVENT LISTENERS
    // ==========================================

    // Catalog navigation / drawer cart
    document.getElementById('btn-floating-cart').addEventListener('click', abrirCarrinho);
    document.getElementById('btn-close-cart').addEventListener('click', fecharCarrinho);
    document.getElementById('cart-overlay').addEventListener('click', fecharCarrinho);
    document.getElementById('cart-checkout-form').addEventListener('submit', submeterCheckout);
    document.getElementById('catalog-search').addEventListener('input', renderizarCatalogo);
    document.getElementById('catalog-category-filter').addEventListener('change', renderizarCatalogo);
    
    // Lock Access Icon
    document.getElementById('btn-admin-access').addEventListener('click', () => {
        window.history.pushState({}, '', '?admin=true');
        verificarRotasSPA();
    });

    // Login Overlay
    document.getElementById('btn-close-login').addEventListener('click', () => {
        window.history.pushState({}, '', window.location.pathname);
        verificarRotasSPA();
    });
    document.getElementById('admin-login-form').addEventListener('submit', tentarLogin);

    // Admin Logout
    document.getElementById('btn-admin-logout').addEventListener('click', tentarSair);

    // Admin Navigation
    const tabs = ['financeiro', 'compras', 'estoque', 'vendas', 'relatorios', 'ajustes'];
    tabs.forEach(id => {
        const btnD = document.getElementById(`btn-tab-${id}`);
        if (btnD) btnD.addEventListener('click', () => mudarAbaAdmin(id));
        const btnM = document.getElementById(`mobile-btn-tab-${id}`);
        if (btnM) btnM.addEventListener('click', () => mudarAbaAdmin(id));
    });

    // Financeiro specific events
    document.getElementById('financeiro-search').addEventListener('input', renderizarFinanceiro);
    document.getElementById('financeiro-filter-month').addEventListener('change', renderizarFinanceiro);
    document.getElementById('financeiro-filter-year').addEventListener('change', renderizarFinanceiro);
    document.getElementById('financeiro-grouping').addEventListener('change', renderizarFinanceiro);
    document.getElementById('btn-new-transaction').addEventListener('click', () => abrirModalTransacao());
    document.getElementById('btn-close-modal-transaction').addEventListener('click', () => fecharModal('modal-transaction'));
    document.getElementById('form-transaction').addEventListener('submit', submeterTransacao);
    document.getElementById('btn-delete-transaction').addEventListener('click', excluirTransacaoAtual);

    // Estoque specific events
    document.getElementById('estoque-search').addEventListener('input', renderizarEstoque);
    document.getElementById('btn-new-product').addEventListener('click', () => abrirModalProduto());
    document.getElementById('btn-close-modal-product').addEventListener('click', () => fecharModal('modal-product'));
    document.getElementById('form-product').addEventListener('submit', submeterProduto);
    document.getElementById('btn-delete-product').addEventListener('click', excluirProdutoAtual);

    // Relatorios specific events
    document.getElementById('relatorio-filter-month').addEventListener('change', carregarDadosRelatorios);
    document.getElementById('relatorio-filter-year').addEventListener('change', carregarDadosRelatorios);
    document.getElementById('btn-print-dre').addEventListener('click', imprimirDRE);

    // Fee specific events
    document.getElementById('btn-close-modal-fee').addEventListener('click', () => fecharModal('modal-fee'));
    document.getElementById('form-fee').addEventListener('submit', submeterTaxa);
});
