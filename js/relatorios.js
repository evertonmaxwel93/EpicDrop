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

export function obterRankingProdutos(vendas, produtos) {
    const ranking = {};
    vendas.forEach(v => {
        if (v.itens && Array.isArray(v.itens)) {
            v.itens.forEach(it => {
                const pid = it.produto_id;
                if (!ranking[pid]) {
                    const prod = produtos.find(p => p.id === pid);
                    ranking[pid] = {
                        nome: prod ? prod.nome : 'Produto Deletado',
                        quantidade: 0,
                        faturamento: 0,
                        lucro: 0
                    };
                }
                ranking[pid].quantidade += it.quantidade;
                ranking[pid].faturamento += (it.valor_venda * it.quantidade);
                ranking[pid].lucro += ((it.valor_venda - it.custo_unitario) * it.quantidade);
            });
        }
    });
    return Object.values(ranking);
}
