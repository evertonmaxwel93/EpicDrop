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
            const { data: prod, error: prodErr } = await clienteSupabase.from('produtos').select('*').eq('id', it.produto_id).single();
            if (prodErr) throw prodErr;
            if (prod) {
                const falta = it.quantidade - prod.estoque_atual;
                if (falta > 0) {
                    // 1. Criar transação de Saída de Compra
                    const custoCompra = falta * prod.custo_unitario;
                    const { data: trComp, error: trCompErr } = await clienteSupabase.from('transacoes').insert([{
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
                    if (trCompErr) throw trCompErr;

                    // 2. Criar registro de Compra
                    const { data: comp, error: compErr } = await clienteSupabase.from('compras').insert([{
                        user_id: venda.user_id,
                        data: new Date().toISOString().split('T')[0],
                        fornecedor: 'Dropship (Auto)',
                        total: custoCompra,
                        transacao_id: trComp.id
                    }]).select().single();
                    if (compErr) throw compErr;

                    // 3. Criar item da compra
                    const { error: compItErr } = await clienteSupabase.from('compras_itens').insert([{
                        compra_id: comp.id,
                        produto_id: it.produto_id,
                        quantidade: falta,
                        custo_unitario: prod.custo_unitario
                    }]);
                    if (compItErr) throw compItErr;

                    // 4. Abastecer estoque físico
                    const { error: updateProdErr } = await clienteSupabase.from('produtos')
                        .update({ estoque_atual: prod.estoque_atual + falta })
                        .eq('id', it.produto_id);
                    if (updateProdErr) throw updateProdErr;
                }
            }
        }
    }

    // Se mudou para Entregue (fulfillment final)
    if (novoStatus === 'Entregue' && venda.status_entrega !== 'Entregue') {
        for (const it of itens) {
            const { data: prod, error: prodErr } = await clienteSupabase.from('produtos').select('*').eq('id', it.produto_id).single();
            if (prodErr) throw prodErr;
            if (prod) {
                const { error: updateProdErr } = await clienteSupabase.from('produtos').update({
                    estoque_atual: Math.max(0, prod.estoque_atual - it.quantidade),
                    estoque_reservado: Math.max(0, (prod.estoque_reservado || 0) - it.quantidade)
                }).eq('id', it.produto_id);
                if (updateProdErr) throw updateProdErr;
            }
        }
    }

    // Atualizar status da venda
    const { error: finalErr } = await clienteSupabase.from('vendas').update({ status_entrega: novoStatus }).eq('id', pedidoId);
    if (finalErr) throw finalErr;
}

export async function registrarTaxaCartao(vendaId, valorTaxa) {
    if (!clienteSupabase.from) return;
    const { data: venda, error: vErr } = await clienteSupabase.from('vendas').select('*').eq('id', vendaId).single();
    if (vErr) throw vErr;
    if (!venda) return;

    if (venda.taxa_transacao_id) {
        // Atualizar taxa existente
        const { error: trErr } = await clienteSupabase.from('transacoes')
            .update({ valor_parcela: valorTaxa, valor_realizado: valorTaxa })
            .eq('id', venda.taxa_transacao_id);
        if (trErr) throw trErr;

        // Atualizar taxa de cartão na venda
        const { error: vUpdateErr } = await clienteSupabase.from('vendas')
            .update({ taxa_cartao: valorTaxa })
            .eq('id', vendaId);
        if (vUpdateErr) throw vUpdateErr;
    } else {
        // Criar nova taxa associada
        const { data: trTaxa, error: trErr } = await clienteSupabase.from('transacoes').insert([{
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
        if (trErr) throw trErr;

        const { error: vUpdateErr } = await clienteSupabase.from('vendas')
            .update({ taxa_cartao: valorTaxa, taxa_transacao_id: trTaxa.id })
            .eq('id', vendaId);
        if (vUpdateErr) throw vUpdateErr;
    }
}

export function formatarMensagemWhatsApp(clienteNome, endereco, itens) {
    const listText = itens.map(it => ` - ${it.quantidade}x ${it.nome} (R$ ${it.preco.toFixed(2).replace('.', ',')})`).join('\n');
    const total = itens.reduce((sum, it) => sum + (it.quantidade * it.preco), 0);
    return `Olá EpicDrop! Gostaria de fazer o seguinte pedido:\n${listText}\n\nTotal: R$ ${total.toFixed(2).replace('.', ',')}\nCliente: ${clienteNome}\nEndereço de Entrega: ${endereco}\n\n*Agende sua Entrega*`;
}
