import { clienteSupabase } from './db.js';

export let userAtual = null;

const EMAILS_AUTORIZADOS = ['evertonmaxwel@gmail.com', 'evertonmaxwel93@gmail.com'];

export async function loginComEmail(email, senha) {
    const emailLimpo = email.trim();
    if (!EMAILS_AUTORIZADOS.includes(emailLimpo)) {
        throw new Error('Acesso exclusivo para evertonmaxwel@gmail.com ou evertonmaxwel93@gmail.com.');
    }
    
    // Tratamento para teste unitário local
    if (!clienteSupabase.auth.signInWithPassword) {
        userAtual = { email: emailLimpo };
        return userAtual;
    }

    const { data, error } = await clienteSupabase.auth.signInWithPassword({
        email: emailLimpo,
        password: senha
    });
    if (error) throw error;
    userAtual = data.user;
    return userAtual;
}

export async function cadastrarComEmail(email, senha) {
    const emailLimpo = email.trim();
    if (!EMAILS_AUTORIZADOS.includes(emailLimpo)) {
        throw new Error('Cadastro não autorizado. Apenas evertonmaxwel@gmail.com ou evertonmaxwel93@gmail.com é permitido.');
    }

    if (!clienteSupabase.auth.signUp) {
        return { email: emailLimpo };
    }

    const { data, error } = await clienteSupabase.auth.signUp({
        email: emailLimpo,
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
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
        }
    });
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
