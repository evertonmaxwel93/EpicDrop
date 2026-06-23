import test from 'node:test';
import assert from 'node:assert';
import { calcularIndicadoresDRE, obterRankingProdutos } from '../js/relatorios.js';

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

test('calcula ranking de produtos de vendas corretamente', () => {
    const vendas = [
        {
            id: 'v1',
            itens: [
                { produto_id: 'p1', quantidade: 2, valor_venda: 100, custo_unitario: 60 },
                { produto_id: 'p2', quantidade: 1, valor_venda: 50, custo_unitario: 30 }
            ]
        },
        {
            id: 'v2',
            itens: [
                { produto_id: 'p1', quantidade: 1, valor_venda: 100, custo_unitario: 60 }
            ]
        }
    ];

    const produtos = [
        { id: 'p1', nome: 'RAM 8GB' },
        { id: 'p2', nome: 'SSD 240GB' }
    ];

    const ranking = obterRankingProdutos(vendas, produtos);

    assert.strictEqual(ranking.length, 2);
    const r1 = ranking.find(r => r.nome === 'RAM 8GB');
    assert.strictEqual(r1.quantidade, 3);
    assert.strictEqual(r1.faturamento, 300);
    assert.strictEqual(r1.lucro, 120);

    const r2 = ranking.find(r => r.nome === 'SSD 240GB');
    assert.strictEqual(r2.quantidade, 1);
    assert.strictEqual(r2.faturamento, 50);
    assert.strictEqual(r2.lucro, 20);
});
