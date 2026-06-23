import test, { after } from 'node:test';
import assert from 'node:assert';

// Mock realista do localStorage para rodar testes locais do Node
global.localStorage = {
    setItem(key, value) { this[key] = String(value); },
    getItem(key) { return this[key] || null; },
    removeItem(key) { delete this[key]; }
};

import { clienteSupabase } from '../js/db.js';

// Variaveis para rastrear chamadas da API do Supabase mock
let signupEmailRecebido = null;
let loginEmailRecebido = null;

clienteSupabase.auth.signUp = async ({ email, password }) => {
    signupEmailRecebido = email;
    return { data: { user: { email } }, error: null };
};

clienteSupabase.auth.signInWithPassword = async ({ email, password }) => {
    loginEmailRecebido = email;
    return { data: { user: { email } }, error: null };
};

clienteSupabase.auth.signOut = async () => {};

import { cadastrarComEmail, loginComEmail, sair, verificarSessao, userAtual } from '../js/auth.js';

test('rejeita cadastro de email que nao seja do Everton', async () => {
    try {
        await cadastrarComEmail('invasor@gmail.com', '123456');
        assert.fail('Deveria ter lançado erro de email não autorizado');
    } catch (err) {
        assert.strictEqual(err.message, 'Cadastro não autorizado. Apenas evertonmaxwel@gmail.com é permitido.');
    }
});

test('permite cadastro de email do Everton', async () => {
    const user = await cadastrarComEmail('evertonmaxwel@gmail.com', 'senha123');
    assert.strictEqual(user.email, 'evertonmaxwel@gmail.com');
});

test('rejeita login de email que nao seja do Everton', async () => {
    try {
        await loginComEmail('invasor@gmail.com', '123456');
        assert.fail('Deveria ter lançado erro de email não autorizado');
    } catch (err) {
        assert.strictEqual(err.message, 'Acesso exclusivo para evertonmaxwel@gmail.com.');
    }
});

test('permite login de email do Everton', async () => {
    const user = await loginComEmail('evertonmaxwel@gmail.com', 'senha123');
    assert.strictEqual(user.email, 'evertonmaxwel@gmail.com');
});

test('fluxo de sair limpa a sessao e localstorage', async () => {
    // Definimos um item fake no localStorage simulando o Supabase
    global.localStorage.setItem('sb-token', 'token-valido');
    
    // Logamos para ter userAtual
    await loginComEmail('evertonmaxwel@gmail.com', 'senha123');
    
    // Saímos
    await sair();
    
    assert.strictEqual(global.localStorage.getItem('sb-token'), null, 'O token do supabase no localStorage deve ser removido');
});

test('fluxo de sair remove multiplos tokens sb- sem pular nenhum devido a mutacao', async () => {
    global.localStorage.setItem('sb-token1', '1');
    global.localStorage.setItem('sb-token2', '2');
    global.localStorage.setItem('sb-token3', '3');
    global.localStorage.setItem('outro-item', 'valor');

    await sair();

    assert.strictEqual(global.localStorage.getItem('sb-token1'), null, 'sb-token1 deve ser removido');
    assert.strictEqual(global.localStorage.getItem('sb-token2'), null, 'sb-token2 deve ser removido');
    assert.strictEqual(global.localStorage.getItem('sb-token3'), null, 'sb-token3 deve ser removido');
    assert.strictEqual(global.localStorage.getItem('outro-item'), 'valor', 'outro-item nao deve ser removido');
});

test('cadastrarComEmail higieniza o email com trim()', async () => {
    signupEmailRecebido = null;
    await cadastrarComEmail('   evertonmaxwel@gmail.com   ', 'senha123');
    assert.strictEqual(signupEmailRecebido, 'evertonmaxwel@gmail.com', 'O email passado para a API do Supabase deve estar trimado');
});

test('loginComEmail higieniza o email com trim()', async () => {
    loginEmailRecebido = null;
    await loginComEmail('   evertonmaxwel@gmail.com   ', 'senha123');
    assert.strictEqual(loginEmailRecebido, 'evertonmaxwel@gmail.com', 'O email passado para a API do Supabase deve estar trimado');
});

test('verificarSessao retorna null quando nao ha supabase session no mock local', async () => {
    const sessao = await verificarSessao();
    assert.strictEqual(sessao, null);
});

after(() => {
    delete global.localStorage;
    clienteSupabase.auth = {};
});
