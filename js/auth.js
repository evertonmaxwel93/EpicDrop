import { clienteSupabase } from './db.js';

export let userAtual = null;

export async function loginComEmail(email, senha) {
    if (email.trim() !== 'evertonmaxwel@gmail.com') {
        throw new Error('Acesso exclusivo para evertonmaxwel@gmail.com.');
    }
    
    // Tratamento para teste unitário local
    if (!clienteSupabase.auth.signInWithPassword) {
        userAtual = { email: 'evertonmaxwel@gmail.com' };
        return userAtual;
    }

    const { data, error } = await clienteSupabase.auth.signInWithPassword({
        email,
        password: senha
    });
    if (error) throw error;
    userAtual = data.user;
    return userAtual;
}

export async function cadastrarComEmail(email, senha) {
    if (email.trim() !== 'evertonmaxwel@gmail.com') {
        throw new Error('Cadastro não autorizado. Apenas evertonmaxwel@gmail.com é permitido.');
    }

    if (!clienteSupabase.auth.signUp) {
        return { email: 'evertonmaxwel@gmail.com' };
    }

    const { data, error } = await clienteSupabase.auth.signUp({
        email,
        password: senha
    });
    if (error) throw error;
    return data.user;
}

export async function sair() {
    if (clienteSupabase.auth.signOut) {
        await clienteSupabase.auth.signOut();
    }
    userAtual = null;
    for (let key in localStorage) {
        if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
        }
    }
    if (typeof window !== 'undefined') window.location.reload();
}

export async function verificarSessao() {
    if (!clienteSupabase.auth.getSession) return null;
    const { data: { session }, error } = await clienteSupabase.auth.getSession();
    if (error) throw error;
    if (session) {
        userAtual = session.user;
        return session.user;
    }
    userAtual = null;
    return null;
}
