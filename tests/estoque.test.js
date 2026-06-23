import test from 'node:test';
import assert from 'node:assert';
import { ordenarProdutosCatalogo } from '../js/estoque.js';

test('ordena produtos colocando em estoque primeiro dentro da categoria', () => {
    const produtosMock = [
        { nome: 'Memória B', categoria: 'RAM', estoque_atual: 0, valor_venda: 100 },
        { nome: 'Memória A', categoria: 'RAM', estoque_atual: 5, valor_venda: 100 },
        { nome: 'SSD B', categoria: 'SSD', estoque_atual: 3, valor_venda: 150 },
        { nome: 'SSD A', categoria: 'SSD', estoque_atual: 0, valor_venda: 150 }
    ];

    const ordenados = ordenarProdutosCatalogo(produtosMock);

    // Categoria SSD deve vir ordenada alfabeticamente ou agrupada, mas dentro de RAM 'Memória A' (estoque > 0) deve vir antes de 'Memória B' (estoque = 0)
    const indexMemA = ordenados.findIndex(p => p.nome === 'Memória A');
    const indexMemB = ordenados.findIndex(p => p.nome === 'Memória B');
    assert.ok(indexMemA < indexMemB, 'Memória com estoque deve vir primeiro');
});
