/* ============================================================
   Aristocles — Connexion par compte, un client par environnement
   supabase-js v2 (ESM, version épinglée) gère la session : jeton
   d'accès + jeton de rafraîchissement, persistés par env en
   sessionStorage sous des clés distinctes (prod et dev coexistent).
   L'app ne stocke JAMAIS de mot de passe.
   En mode démo (`?mock=1`), connexion simulée sans réseau : seul
   l'e-mail est gardé en sessionStorage pour survivre au
   rafraîchissement ; un e-mail commençant par « refuse » simule un
   compte non autorisé (403).
   ============================================================ */

import { ENVS, SUPABASE_JS_URL } from './config.js';

// Ancien stockage du mot de passe partagé (avant les comptes).
const CLE_MOT_DE_PASSE_HERITEE = 'aristocles-pw';
const PREFIXE_CLE_SESSION = 'aristocles-dashboard-auth-';

// Clés d'auth à ne jamais laisser en localStorage : l'origine
// florian30.github.io est partagée avec d'autres sites (aristocles-site).
export function clesAuthASupprimer(cles) {
  return cles.filter((cle) =>
    cle === CLE_MOT_DE_PASSE_HERITEE ||
    /^sb-.+-auth-token$/.test(cle) ||
    cle.startsWith(PREFIXE_CLE_SESSION));
}

// Au chargement : ancien mot de passe partagé, et toute session
// Supabase restée en localStorage (les sessions vivent désormais en
// sessionStorage, effacé à la fermeture du navigateur).
export function nettoyerStockageHerite() {
  try { globalThis.sessionStorage?.removeItem(CLE_MOT_DE_PASSE_HERITEE); } catch (_) { /* stockage bloqué */ }
  try {
    const local = globalThis.localStorage;
    if (!local) return;
    for (const cle of clesAuthASupprimer(Object.keys(local))) local.removeItem(cle);
  } catch (_) { /* stockage bloqué */ }
}

function messageErreurConnexion(error) {
  if (error.code === 'invalid_credentials' || error.status === 400) return 'E-mail ou mot de passe incorrect.';
  if (error.status === 0 || /fetch/i.test(error.message)) return 'Serveur injoignable.';
  return error.message;
}

function authReelle() {
  let module = null;
  const clients = {};

  async function client(env) {
    if (!clients[env]) {
      module = module || (await import(SUPABASE_JS_URL));
      clients[env] = module.createClient(ENVS[env].url, ENVS[env].anonKey, {
        auth: {
          storageKey: PREFIXE_CLE_SESSION + env,
          // sessionStorage, pas localStorage : le jeton de rafraîchissement
          // ne survit pas à la fermeture du navigateur (reconnexion acceptée).
          storage: window.sessionStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      });
    }
    return clients[env];
  }

  return {
    async session(env) {
      const { data } = await (await client(env)).auth.getSession();
      const s = data.session;
      return s ? { email: s.user.email, jeton: s.access_token } : null;
    },
    async jeton(env) {
      return (await this.session(env))?.jeton ?? null;
    },
    async connexion(env, email, motDePasse) {
      const { error } = await (await client(env)).auth.signInWithPassword({ email, password: motDePasse });
      if (error) throw new Error(messageErreurConnexion(error));
    },
    async deconnexion(env) {
      await (await client(env)).auth.signOut({ scope: 'local' });
    },
  };
}

function authMock() {
  const cle = (env) => 'aristocles-mock-session-' + env;
  const lire = (env) => {
    try { return JSON.parse(sessionStorage.getItem(cle(env))); } catch (_) { return null; }
  };
  return {
    async session(env) {
      const s = lire(env);
      return s ? { email: s.email, jeton: 'jeton-demo' } : null;
    },
    async jeton(env) {
      return lire(env) ? 'jeton-demo' : null;
    },
    async connexion(env, email) {
      sessionStorage.setItem(cle(env), JSON.stringify({ email }));
    },
    async deconnexion(env) {
      sessionStorage.removeItem(cle(env));
    },
    // Accès synchrones pour le transport mock.
    estConnecte: (env) => Boolean(lire(env)),
    estAutorise: (env) => !/^refuse/i.test(lire(env)?.email || ''),
  };
}

export function creerAuth({ mock }) {
  return mock ? authMock() : authReelle();
}
