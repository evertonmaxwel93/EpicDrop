import { clienteSupabase } from './db.js';

export async function carregarProdutos() {
    if (!clienteSupabase.from) return [];
    const { data, error } = await clienteSupabase.from('produtos').select('*').order('categoria').order('nome');
    if (error) throw error;
    return data || [];
}

export async function salvarProduto(payload, id = null) {
    if (id) {
        const { data, error } = await clienteSupabase.from('produtos').update(payload).eq('id', id).select();
        if (error) throw error;
        return data;
    } else {
        const { data, error } = await clienteSupabase.from('produtos').insert([payload]).select();
        if (error) throw error;
        return data;
    }
}

export async function deletarProduto(id) {
    const { error } = await clienteSupabase.from('produtos').delete().eq('id', id);
    if (error) throw error;
    return true;
}

export function ordenarProdutosCatalogo(lista) {
    return [...lista].sort((a, b) => {
        // Agrupar por Categoria primeiro
        const catCompare = a.categoria.localeCompare(b.categoria);
        if (catCompare !== 0) return catCompare;
        
        // Se mesma categoria, o que tem estoque físico real (estoque_atual > 0) vem primeiro
        const aTemEstoque = a.estoque_atual > 0 ? 1 : 0;
        const bTemEstoque = b.estoque_atual > 0 ? 1 : 0;
        
        if (aTemEstoque !== bTemEstoque) {
            return bTemEstoque - aTemEstoque; // 1 (com estoque) vem antes de 0 (sem estoque)
        }
        
        // Se ambos têm estoque ou ambos estão zerados, ordena por nome alfabético
        return a.nome.localeCompare(b.nome);
    });
}

export async function fazerUploadImagem(file) {
    if (!clienteSupabase.storage) return 'http://placehold.co/150';
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `produtos/${fileName}`;

    const { error } = await clienteSupabase.storage.from('produtos').upload(filePath, file);
    if (error) throw error;

    const { data } = clienteSupabase.storage.from('produtos').getPublicUrl(filePath);
    return data.publicUrl;
}
