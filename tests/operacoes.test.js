import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { clienteSupabase } from '../js/db.js';
import { 
    criarPedido, 
    atualizarStatusPedido, 
    registrarTaxaCartao, 
    formatarMensagemWhatsApp 
} from '../js/operacoes.js';

// Setup database state for testing
let transacoesDb = [];
let vendasDb = [];
let vendasItensDb = [];
let produtosDb = [];
let comprasDb = [];
let comprasItensDb = [];

beforeEach(() => {
    transacoesDb = [];
    vendasDb = [];
    vendasItensDb = [];
    comprasDb = [];
    comprasItensDb = [];
    produtosDb = [
        { id: 'prod-ssd', nome: 'SSD 240GB', estoque_atual: 5, estoque_reservado: 0, custo_unitario: 100.00, valor_venda: 130.00 },
        { id: 'prod-ram', nome: 'RAM 8GB', estoque_atual: 1, estoque_reservado: 0, custo_unitario: 120.00, valor_venda: 150.00 }
    ];
});

// Setup mock for clienteSupabase
clienteSupabase.from = (table) => {
    return {
        select(fields = '*') {
            return {
                eq(field, value) {
                    const returnObj = {
                        async single() {
                            if (table === 'produtos') {
                                const prod = produtosDb.find(p => p[field] === value);
                                return { data: prod || null, error: null };
                            }
                            if (table === 'vendas') {
                                const venda = vendasDb.find(v => v[field] === value);
                                return { data: venda || null, error: null };
                            }
                            return { data: null, error: null };
                        },
                        then(onFulfilled) {
                            let result = [];
                            if (table === 'vendas_itens') {
                                result = vendasItensDb.filter(vi => vi[field] === value);
                            }
                            return Promise.resolve({ data: result, error: null }).then(onFulfilled);
                        }
                    };
                    return returnObj;
                }
            };
        },
        insert(payload) {
            const records = Array.isArray(payload) ? payload : [payload];
            const inserted = [];
            for (const item of records) {
                const copy = { id: `mock-id-${Math.random().toString(36).substr(2, 9)}`, ...item };
                if (table === 'transacoes') transacoesDb.push(copy);
                if (table === 'vendas') vendasDb.push(copy);
                if (table === 'vendas_itens') vendasItensDb.push(copy);
                if (table === 'compras') comprasDb.push(copy);
                if (table === 'compras_itens') comprasItensDb.push(copy);
                inserted.push(copy);
            }
            const returnObj = {
                select() {
                    return {
                        single() {
                            return Promise.resolve({ data: inserted[0], error: null });
                        }
                    };
                },
                error: null,
                data: inserted,
                then(onFulfilled) {
                    return Promise.resolve({ data: inserted, error: null }).then(onFulfilled);
                }
            };
            return returnObj;
        },
        update(payload) {
            return {
                eq(field, value) {
                    if (table === 'produtos') {
                        const prod = produtosDb.find(p => p[field] === value);
                        if (prod) {
                            Object.assign(prod, payload);
                        }
                    }
                    if (table === 'vendas') {
                        const venda = vendasDb.find(v => v[field] === value);
                        if (venda) {
                            Object.assign(venda, payload);
                        }
                    }
                    if (table === 'transacoes') {
                        const tr = transacoesDb.find(t => t[field] === value);
                        if (tr) {
                            Object.assign(tr, payload);
                        }
                    }
                    const returnObj = {
                        error: null,
                        data: null,
                        select() {
                            return {
                                single() {
                                    return Promise.resolve({ data: null, error: null });
                                }
                            };
                        },
                        then(onFulfilled) {
                            return Promise.resolve({ data: null, error: null }).then(onFulfilled);
                        }
                    };
                    return returnObj;
                }
            };
        }
    };
};

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

test('criarPedido insere transacao pendente se nao pago, cria venda e reserva estoque', async () => {
    const pedidoData = {
        user_id: 'user-123',
        cliente: 'Cliente Teste',
        data: '2026-06-23',
        status_pagamento: 'Pendente'
    };
    const itens = [
        { produto_id: 'prod-ssd', quantidade: 2, valor_venda: 130.00, custo_unitario: 100.00 }
    ];

    const vendaId = await criarPedido(pedidoData, itens);

    assert.ok(vendaId);
    
    // Deve criar transação pendente
    assert.strictEqual(transacoesDb.length, 1);
    assert.strictEqual(transacoesDb[0].status, 'Pendente');
    assert.strictEqual(transacoesDb[0].valor_parcela, 260.00);
    assert.strictEqual(transacoesDb[0].valor_realizado, null);

    // Deve criar venda
    assert.strictEqual(vendasDb.length, 1);
    assert.strictEqual(vendasDb[0].total, 260.00);
    assert.strictEqual(vendasDb[0].custo_total, 200.00);
    assert.strictEqual(vendasDb[0].transacao_id, transacoesDb[0].id);

    // Deve criar item de venda
    assert.strictEqual(vendasItensDb.length, 1);
    assert.strictEqual(vendasItensDb[0].venda_id, vendasDb[0].id);
    assert.strictEqual(vendasItensDb[0].produto_id, 'prod-ssd');
    assert.strictEqual(vendasItensDb[0].quantidade, 2);

    // Deve atualizar estoque reservado
    const prod = produtosDb.find(p => p.id === 'prod-ssd');
    assert.strictEqual(prod.estoque_reservado, 2);
});

test('criarPedido insere transacao realizada se pago', async () => {
    const pedidoData = {
        user_id: 'user-123',
        cliente: 'Cliente Teste Pago',
        data: '2026-06-23',
        status_pagamento: 'Pago'
    };
    const itens = [
        { produto_id: 'prod-ssd', quantidade: 1, valor_venda: 130.00, custo_unitario: 100.00 }
    ];

    await criarPedido(pedidoData, itens);

    assert.strictEqual(transacoesDb.length, 1);
    assert.strictEqual(transacoesDb[0].status, 'Realizado');
    assert.strictEqual(transacoesDb[0].valor_parcela, 130.00);
    assert.strictEqual(transacoesDb[0].valor_realizado, 130.00);
});

test('atualizarStatusPedido para Adquirido com estoque suficiente nao realiza compra dropship', async () => {
    // 1. Criar pedido
    const pedidoData = { user_id: 'user-123', cliente: 'Cliente Dropship', data: '2026-06-23', status_pagamento: 'Pago' };
    const itens = [{ produto_id: 'prod-ssd', quantidade: 2, valor_venda: 130.00, custo_unitario: 100.00 }];
    const vendaId = await criarPedido(pedidoData, itens);

    // SSD estoque_atual é 5, quantidade é 2 -> estoque suficiente
    await atualizarStatusPedido(vendaId, 'Adquirido');

    assert.strictEqual(vendasDb[0].status_entrega, 'Adquirido');
    assert.strictEqual(comprasDb.length, 0, 'Nao deve criar compras');
});

test('atualizarStatusPedido para Adquirido com estoque insuficiente cria transacao de saida, compra de dropship e atualiza estoque', async () => {
    // 1. Criar pedido
    const pedidoData = { user_id: 'user-123', cliente: 'Cliente Dropship Auto', data: '2026-06-23', status_pagamento: 'Pago' };
    const itens = [{ produto_id: 'prod-ram', quantidade: 3, valor_venda: 150.00, custo_unitario: 120.00 }];
    const vendaId = await criarPedido(pedidoData, itens);

    // RAM estoque_atual é 1, quantidade pedida é 3 -> falta 2
    await atualizarStatusPedido(vendaId, 'Adquirido');

    assert.strictEqual(vendasDb[0].status_entrega, 'Adquirido');
    
    // Deve criar transação de saída (custo total da compra: 2 * 120 = 240)
    assert.strictEqual(transacoesDb.length, 2); // 1 da venda, 1 da compra dropship
    const trCompra = transacoesDb.find(t => t.tipo === 'Saída');
    assert.ok(trCompra);
    assert.strictEqual(trCompra.subcategoria, 'Compras');
    assert.strictEqual(trCompra.valor_parcela, 240.00);

    // Deve criar compra
    assert.strictEqual(comprasDb.length, 1);
    assert.strictEqual(comprasDb[0].total, 240.00);
    assert.strictEqual(comprasDb[0].transacao_id, trCompra.id);

    // Deve criar item de compra
    assert.strictEqual(comprasItensDb.length, 1);
    assert.strictEqual(comprasItensDb[0].compra_id, comprasDb[0].id);
    assert.strictEqual(comprasItensDb[0].produto_id, 'prod-ram');
    assert.strictEqual(comprasItensDb[0].quantidade, 2);

    // Deve reabastecer estoque físico (estoque anterior 1 + falta 2 = 3)
    const prod = produtosDb.find(p => p.id === 'prod-ram');
    assert.strictEqual(prod.estoque_atual, 3);
});

test('atualizarStatusPedido para Entregue deduz estoque atual e reservado', async () => {
    // 1. Criar pedido
    const pedidoData = { user_id: 'user-123', cliente: 'Cliente Entrega', data: '2026-06-23', status_pagamento: 'Pago' };
    const itens = [{ produto_id: 'prod-ssd', quantidade: 3, valor_venda: 130.00, custo_unitario: 100.00 }];
    const vendaId = await criarPedido(pedidoData, itens);

    // Inicialmente: estoque_atual = 5, estoque_reservado = 3
    await atualizarStatusPedido(vendaId, 'Entregue');

    assert.strictEqual(vendasDb[0].status_entrega, 'Entregue');

    const prod = produtosDb.find(p => p.id === 'prod-ssd');
    // Deve subtrair 3: estoque_atual = 2, estoque_reservado = 0
    assert.strictEqual(prod.estoque_atual, 2);
    assert.strictEqual(prod.estoque_reservado, 0);
});

test('registrarTaxaCartao cria nova transacao de taxa se nao houver', async () => {
    // Criar uma venda
    const venda = {
        id: 'venda-teste-taxa',
        user_id: 'user-123',
        total: 100,
        data: '2026-06-23'
    };
    vendasDb.push(venda);

    await registrarTaxaCartao('venda-teste-taxa', 5.00);

    // Deve criar transação de saída para taxa
    assert.strictEqual(transacoesDb.length, 1);
    assert.strictEqual(transacoesDb[0].tipo, 'Saída');
    assert.strictEqual(transacoesDb[0].subcategoria, 'Taxas de Cartão');
    assert.strictEqual(transacoesDb[0].valor_parcela, 5.00);

    // Deve atualizar a venda com taxa e taxa_transacao_id
    assert.strictEqual(vendasDb[0].taxa_cartao, 5.00);
    assert.strictEqual(vendasDb[0].taxa_transacao_id, transacoesDb[0].id);
});

test('registrarTaxaCartao atualiza transacao de taxa se ja existir', async () => {
    // Criar uma venda com taxa existente
    const venda = {
        id: 'venda-teste-taxa-existente',
        user_id: 'user-123',
        total: 100,
        data: '2026-06-23',
        taxa_cartao: 4.00,
        taxa_transacao_id: 'taxa-tr-1'
    };
    const trTaxaOriginal = {
        id: 'taxa-tr-1',
        tipo: 'Saída',
        subcategoria: 'Taxas de Cartão',
        valor_parcela: 4.00,
        valor_realizado: 4.00
    };
    vendasDb.push(venda);
    transacoesDb.push(trTaxaOriginal);

    await registrarTaxaCartao('venda-teste-taxa-existente', 6.00);

    // Nao deve criar nova transação
    assert.strictEqual(transacoesDb.length, 1);
    // Deve atualizar valor da transacao
    assert.strictEqual(transacoesDb[0].valor_parcela, 6.00);
    assert.strictEqual(transacoesDb[0].valor_realizado, 6.00);
    // Deve atualizar valor da taxa na venda correspondente
    assert.strictEqual(vendasDb[0].taxa_cartao, 6.00);
});

after(() => {
    clienteSupabase.from = () => {};
});
