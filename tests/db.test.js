import test from 'node:test';
import assert from 'node:assert';

// Mock do localStorage para testes locais do Node
global.localStorage = {
    store: {},
    setItem(key, value) { this.store[key] = String(value); },
    getItem(key) { return this.store[key] || null; },
    removeItem(key) { delete this.store[key]; }
};

import { cacheOffline, isOnline } from '../js/db.js';

test('verifica salvar e obter cache offline', () => {
    const dados = { items: [1, 2, 3] };
    cacheOffline.salvar('teste', dados);
    
    const obtido = cacheOffline.obter('teste');
    assert.deepStrictEqual(obtido, dados, 'Os dados retornados do cache devem ser iguais aos salvos');
    
    cacheOffline.limpar('teste');
    assert.strictEqual(cacheOffline.obter('teste'), null, 'Os dados limpos devem retornar nulo');
});

test('verifica isOnline', () => {
    // Por padrão no Node (sem navigator com onLine definido como boolean), deve retornar true
    assert.strictEqual(isOnline(), true, 'Deve retornar true por padrão quando navigator não tem onLine definido');

    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

    // Com navigator.onLine = true
    Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: true },
        configurable: true,
        writable: true
    });
    assert.strictEqual(isOnline(), true, 'Deve retornar true quando navigator.onLine é true');

    // Com navigator.onLine = false
    Object.defineProperty(globalThis, 'navigator', {
        value: { onLine: false },
        configurable: true,
        writable: true
    });
    assert.strictEqual(isOnline(), false, 'Deve retornar false quando navigator.onLine é false');

    // Restaurar
    if (originalDescriptor) {
        Object.defineProperty(globalThis, 'navigator', originalDescriptor);
    } else {
        delete globalThis.navigator;
    }
});

