// EpicDrop Supabase Configuration
const SUPABASE_URL = 'https://rkwoerrsicftcjgaakte.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ug1NkS3w4DACmOIpiafAAA_yQtSud7-';

// Criação do cliente Supabase. Tratamento para rodar sob Node de forma mockada nos testes.
export const clienteSupabase = (typeof supabase !== 'undefined') 
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : {
        auth: {},
        from: () => {}
    };

export const cacheOffline = {
    salvar(chave, dados) {
        try {
            localStorage.setItem(`epicdrop_cache_${chave}`, JSON.stringify(dados));
        } catch (e) {
            console.warn("Erro ao salvar no cache local:", e);
        }
    },
    obter(chave) {
        try {
            const raw = localStorage.getItem(`epicdrop_cache_${chave}`);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn("Erro ao ler do cache local:", e);
            return null;
        }
    },
    limpar(chave) {
        localStorage.removeItem(`epicdrop_cache_${chave}`);
    }
};

export function isOnline() {
    return (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') ? navigator.onLine : true;
}
