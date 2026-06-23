import test from 'node:test';
import assert from 'node:assert';

// Mock realista do localStorage para rodar testes locais do Node
global.localStorage = {
    setItem(key, value) { this[key] = String(value); },
    getItem(key) { return this[key] || null; },
    removeItem(key) { delete this[key]; }
};

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

test('verificarSessao retorna null quando nao ha supabase session no mock local', async () => {
    const sessao = await verificarSessao();
    assert.strictEqual(sessao, null);
});
