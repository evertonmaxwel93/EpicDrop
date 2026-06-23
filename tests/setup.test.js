import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';

test('verifica arquivos de PWA', () => {
    assert.ok(fs.existsSync('./manifest.json'), 'manifest.json deve existir');
    assert.ok(fs.existsSync('./sw.js'), 'sw.js deve existir');
    
    const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
    assert.strictEqual(manifest.name, 'EpicDrop Informática', 'Nome do PWA incorreto');
});
