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
