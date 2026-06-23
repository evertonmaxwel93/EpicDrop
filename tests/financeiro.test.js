import test, { after } from 'node:test';
import assert from 'node:assert';
import { clienteSupabase } from '../js/db.js';
import { 
    calcularSaldosAcumuladosPorDia, 
    gerarTransacoesParceladas, 
    exportarBackupJSON, 
    salvarTransacao, 
    excluirTransacao 
} from '../js/financeiro.js';

// Rastreamento para mocks do Supabase
let fromTabela = null;
let acaoRealizada = null;
let payloadRecebido = null;
let idFiltro = null;
let responseMock = { data: null, error: null };

// Mock de clienteSupabase
clienteSupabase.from = (tabela) => {
    fromTabela = tabela;
    return {
        insert(payload) {
            acaoRealizada = 'insert';
            payloadRecebido = payload;
            return {
                select() {
                    return Promise.resolve(responseMock);
                }
            };
        },
        update(payload) {
            acaoRealizada = 'update';
            payloadRecebido = payload;
            return {
                eq(campo, valor) {
                    if (campo === 'id') idFiltro = valor;
                    return {
                        select() {
                            return Promise.resolve(responseMock);
                        }
                    };
                }
            };
        },
        delete() {
            acaoRealizada = 'delete';
            return {
                eq(campo, valor) {
                    if (campo === 'id') idFiltro = valor;
                    return Promise.resolve(responseMock);
                }
            };
        }
    };
};

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

test('calcularSaldosAcumuladosPorDia usa valor_parcela para transacoes nao realizadas', () => {
    const transacoesMock = [
        { data_vencimento: '2026-07-01', tipo: 'Entrada', valor_realizado: null, valor_parcela: 200, status: 'Pendente' },
        { data_vencimento: '2026-07-01', tipo: 'Saída', valor_realizado: 50, valor_parcela: 80, status: 'Pendente' }
    ];

    const result = calcularSaldosAcumuladosPorDia(transacoesMock, 0);

    // Entrada Pendente: deve usar valor_parcela (200)
    // Saida Pendente: deve usar valor_parcela (80)
    // Balanço: 200 - 80 = 120
    assert.strictEqual(result['2026-07-01'].balanco, 120);
    assert.strictEqual(result['2026-07-01'].acumulado, 120);
});

test('calcularSaldosAcumuladosPorDia usa valor_realizado (ou valor_parcela se realizado/nulo) para transações realizadas', () => {
    const transacoesMock = [
        { data_vencimento: '2026-08-01', tipo: 'Entrada', valor_realizado: 150, valor_parcela: 200, status: 'Realizado' },
        { data_vencimento: '2026-08-01', tipo: 'Saída', valor_realizado: null, valor_parcela: 50, status: 'Realizado' }
    ];

    const result = calcularSaldosAcumuladosPorDia(transacoesMock, 0);

    // Entrada Realizada com valor_realizado=150: deve usar valor_realizado (150)
    // Saída Realizada com valor_realizado=null: deve usar valor_parcela (50)
    // Balanço: 150 - 50 = 100
    assert.strictEqual(result['2026-08-01'].balanco, 100);
});

test('gerarTransacoesParceladas gera parcelas corretas para frequencia Semanal', () => {
    const payload = { descricao: 'Compra Equipamento', data_vencimento: '2026-01-01', valor_parcela: 100 };
    const parcelas = 3;
    const frequencia = 'Semanal';

    const resultado = gerarTransacoesParceladas(payload, parcelas, frequencia);

    assert.strictEqual(resultado.length, 3);
    assert.strictEqual(resultado[0].data_vencimento, '2026-01-01');
    assert.strictEqual(resultado[0].parcela_atual, 1);
    assert.strictEqual(resultado[0].total_parcelas, 3);

    // Semanal adiciona 7 dias: 01-01 -> 08-01 -> 15-01
    assert.strictEqual(resultado[1].data_vencimento, '2026-01-08');
    assert.strictEqual(resultado[1].parcela_atual, 2);

    assert.strictEqual(resultado[2].data_vencimento, '2026-01-15');
    assert.strictEqual(resultado[2].parcela_atual, 3);
});

test('gerarTransacoesParceladas gera parcelas corretas para frequencia Mensal e corrige datas inexistentes', () => {
    const payload = { descricao: 'Mensalidade', data_vencimento: '2026-01-31', valor_parcela: 150 };
    const parcelas = 3;
    const frequencia = 'Mensal';

    const resultado = gerarTransacoesParceladas(payload, parcelas, frequencia);

    assert.strictEqual(resultado.length, 3);
    assert.strictEqual(resultado[0].data_vencimento, '2026-01-31');
    // Fevereiro tem 28 dias em 2026, então 31-02 corrige para 28-02 (ou último dia do mês)
    assert.strictEqual(resultado[1].data_vencimento, '2026-02-28');
    assert.strictEqual(resultado[2].data_vencimento, '2026-03-31');
});

test('gerarTransacoesParceladas gera parcelas corretas para frequencia Anual', () => {
    const payload = { descricao: 'Licença Anual', data_vencimento: '2026-05-15', valor_parcela: 1200 };
    const parcelas = 2;
    const frequencia = 'Anual';

    const resultado = gerarTransacoesParceladas(payload, parcelas, frequencia);

    assert.strictEqual(resultado.length, 2);
    assert.strictEqual(resultado[0].data_vencimento, '2026-05-15');
    assert.strictEqual(resultado[1].data_vencimento, '2027-05-15');
});

test('gerarTransacoesParceladas gera parcelas corretas para frequencia Diário', () => {
    const payload = { descricao: 'Serviço Diário', data_vencimento: '2026-04-29', valor_parcela: 20 };
    const parcelas = 3;
    const frequencia = 'Diário';

    const resultado = gerarTransacoesParceladas(payload, parcelas, frequencia);

    assert.strictEqual(resultado.length, 3);
    assert.strictEqual(resultado[0].data_vencimento, '2026-04-29');
    assert.strictEqual(resultado[1].data_vencimento, '2026-04-30');
    // Abril tem 30 dias, então deve ir para 01-05
    assert.strictEqual(resultado[2].data_vencimento, '2026-05-01');
});

test('gerarTransacoesParceladas gera 12 parcelas se o numero de parcelas for igual a zero', () => {
    const payload = { descricao: 'Assinatura Recorrente', data_vencimento: '2026-01-01', valor_parcela: 50 };
    const parcelas = 0;
    const frequencia = 'Mensal';

    const resultado = gerarTransacoesParceladas(payload, parcelas, frequencia);

    assert.strictEqual(resultado.length, 12);
    assert.strictEqual(resultado[0].parcela_atual, 1);
    assert.strictEqual(resultado[11].parcela_atual, 12);
    assert.strictEqual(resultado[11].total_parcelas, 0);
});

test('exportarBackupJSON retorna string JSON com estrutura e chaves corretas', () => {
    const transacoes = [{ id: 1 }];
    const subcategorias = [{ id: 2 }];
    const produtos = [{ id: 3 }];
    const clientes = [{ id: 4 }];
    const fornecedores = [{ id: 5 }];
    const email = 'evertonmaxwel@gmail.com';

    const backupStr = exportarBackupJSON(email, transacoes, subcategorias, produtos, clientes, fornecedores);
    const backupObj = JSON.parse(backupStr);

    assert.strictEqual(backupObj.app, 'EpicDrop');
    assert.strictEqual(backupObj.usuario, email);
    assert.deepStrictEqual(backupObj.transacoes, transacoes);
    assert.deepStrictEqual(backupObj.subcategorias, subcategorias);
    assert.deepStrictEqual(backupObj.produtos, produtos);
    assert.deepStrictEqual(backupObj.clientes, clientes);
    assert.deepStrictEqual(backupObj.fornecedores, fornecedores);
    assert.ok(backupObj.data_exportacao);
});

test('salvarTransacao sem ID faz insert no banco', async () => {
    fromTabela = null;
    acaoRealizada = null;
    payloadRecebido = null;
    responseMock = { data: [{ id: 99, descricao: 'Teste' }], error: null };

    const payload = { descricao: 'Teste', valor_parcela: 100 };
    const resultado = await salvarTransacao(payload);

    assert.strictEqual(fromTabela, 'transacoes');
    assert.strictEqual(acaoRealizada, 'insert');
    assert.deepStrictEqual(payloadRecebido, [payload]);
    assert.deepStrictEqual(resultado, responseMock.data);
});

test('salvarTransacao com ID faz update no banco', async () => {
    fromTabela = null;
    acaoRealizada = null;
    payloadRecebido = null;
    idFiltro = null;
    responseMock = { data: [{ id: 12, descricao: 'Teste Alt' }], error: null };

    const payload = { descricao: 'Teste Alt', valor_parcela: 120 };
    const resultado = await salvarTransacao(payload, 12);

    assert.strictEqual(fromTabela, 'transacoes');
    assert.strictEqual(acaoRealizada, 'update');
    assert.deepStrictEqual(payloadRecebido, payload);
    assert.strictEqual(idFiltro, 12);
    assert.deepStrictEqual(resultado, responseMock.data);
});

test('salvarTransacao lanca erro se Supabase retornar erro', async () => {
    responseMock = { data: null, error: new Error('Erro no Supabase') };

    await assert.rejects(async () => {
        await salvarTransacao({ descricao: 'Falha' });
    }, /Erro no Supabase/);
});

test('excluirTransacao faz delete no banco e retorna true', async () => {
    fromTabela = null;
    acaoRealizada = null;
    idFiltro = null;
    responseMock = { data: null, error: null };

    const resultado = await excluirTransacao(45);

    assert.strictEqual(fromTabela, 'transacoes');
    assert.strictEqual(acaoRealizada, 'delete');
    assert.strictEqual(idFiltro, 45);
    assert.strictEqual(resultado, true);
});

test('excluirTransacao lanca erro se Supabase retornar erro', async () => {
    responseMock = { data: null, error: new Error('Erro ao deletar') };

    await assert.rejects(async () => {
        await excluirTransacao(45);
    }, /Erro ao deletar/);
});

after(() => {
    clienteSupabase.from = () => {};
});
