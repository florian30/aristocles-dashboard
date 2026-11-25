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
   Onglets : un onglet neuf sans session la demande aux onglets
   ouverts du même env (BroadcastChannel, un canal par env et par
   mode). Rien ne passe par le localStorage ; une fois tous les
   onglets fermés, il ne reste rien.
   ============================================================ */

import { ENVS, SUPABASE_JS_URL } from './config.js';

// Ancien stockage du mot de passe partagé (avant les comptes).
const CLE_MOT_DE_PASSE_HERITEE = 'aristocles-pw';
const PREFIXE_CLE_SESSION = 'aristocles-dashboard-auth-';
// Drapeau (sessionStorage, propre à l'onglet) : l'onglet s'est déconnecté
// de cet env ; il ne redemande plus la session aux autres onglets,
// même après un rafraîchissement.
const PREFIXE_CLE_DECONNECTE = 'aristocles-dashboard-deconnecte-';
// Attente maximale d'une réponse des autres onglets.
export const DELAI_PARTAGE_MS = 300;

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

// ---------- Partage de session entre onglets ----------

export function nomCanal(env, mock) {
  return 'aristocles-dashboard-session-' + (mock ? 'demo-' : '') + env;
}

// Identifiant de session Supabase porté par le jeton d'accès (claim
// `session_id`), ou null. Sert à ne suivre que les rafraîchissements
// de la même session.
export function idSessionJeton(jeton) {
  try {
    const charge = String(jeton).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(charge)).session_id ?? null;
  } catch (_) {
    return null;
  }
}

function idAleatoire() {
  return globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2);
}

// Un canal par env. `lire()` → session à partager ou null (un onglet
// sans session, ou déconnecté, ne répond pas). `surRafraichie(s)` :
// un autre onglet a rafraîchi ses jetons.
export function creerPartage({ nom, lire, surRafraichie, Canal = globalThis.BroadcastChannel, delaiMs = DELAI_PARTAGE_MS }) {
  if (typeof Canal !== 'function') {
    return { demander: async () => null, diffuser() {} };
  }
  const canal = new Canal(nom);
  const attentes = new Map();
  canal.onmessage = async (evenement) => {
    const m = evenement?.data;
    if (!m || typeof m !== 'object') return;
    if (m.type === 'demande') {
      let session = null;
      try { session = await lire(); } catch (_) { /* pas de réponse */ }
      if (session) canal.postMessage({ type: 'reponse', id: m.id, session });
    } else if (m.type === 'reponse') {
      attentes.get(m.id)?.(m.session);
    } else if (m.type === 'rafraichie' && m.session) {
      try { await surRafraichie?.(m.session); } catch (_) { /* ignoré */ }
    }
  };
  return {
    // Première réponse reçue, ou null après `delaiMs`.
    demander() {
      return new Promise((resolve) => {
        const id = idAleatoire();
        const finir = (session) => {
          if (!attentes.delete(id)) return;
          clearTimeout(minuteur);
          resolve(session ?? null);
        };
        const minuteur = setTimeout(() => finir(null), delaiMs);
        attentes.set(id, finir);
        canal.postMessage({ type: 'demande', id });
      });
    },
    diffuser(session) {
      canal.postMessage({ type: 'rafraichie', session });
    },
  };
}

// Reprise de session : une seule demande par env et par chargement de
// page, jamais après une déconnexion dans cet onglet.
function creerReprise({ envs, mock, lire, poser, surRafraichie, Canal, stockage = () => globalThis.sessionStorage }) {
  const partages = {};
  const demandes = new Map(); // env → promesse de la demande (une seule)
  const cleDeconnecte = (env) => PREFIXE_CLE_DECONNECTE + (mock ? 'demo-' : '') + env;
  for (const env of envs) {
    partages[env] = creerPartage({
      nom: nomCanal(env, mock),
      lire: () => lire(env),
      surRafraichie: (s) => surRafraichie?.(env, s),
      Canal,
    });
  }
  return {
    partages,
    // → true si une session a été reprise. Deux rendus rapprochés
    // partagent la même demande.
    reprendre(env) {
      if (!partages[env]) return Promise.resolve(false);
      if (!demandes.has(env)) demandes.set(env, (async () => {
        try { if (stockage()?.getItem(cleDeconnecte(env))) return false; } catch (_) { /* stockage bloqué */ }
        const session = await partages[env].demander();
        if (!session) return false;
        try {
          await poser(env, session);
          return true;
        } catch (_) {
          return false;
        }
      })());
      return demandes.get(env);
    },
    marquerDeconnecte(env) {
      demandes.set(env, Promise.resolve(false));
      try { stockage()?.setItem(cleDeconnecte(env), '1'); } catch (_) { /* stockage bloqué */ }
    },
    marquerConnecte(env) {
      try { stockage()?.removeItem(cleDeconnecte(env)); } catch (_) { /* stockage bloqué */ }
    },
  };
}

function messageErreurConnexion(error) {
  if (error.code === 'invalid_credentials' || error.status === 400) return 'E-mail ou mot de passe incorrect.';
  if (error.status === 0 || /fetch/i.test(error.message)) return 'Serveur injoignable.';
  return error.message;
}

function authReelle({ Canal } = {}) {
  let module = null;
  const clients = {};
  let reprise = null;

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
      // Jetons rafraîchis ici : les autres onglets de la même session
      // les reprennent, sinon leur ancien jeton de rafraîchissement,
      // réutilisé, ferait révoquer la session par Supabase.
      clients[env].auth.onAuthStateChange((evenement, s) => {
        if (evenement === 'TOKEN_REFRESHED' && s) {
          reprise.partages[env].diffuser({ access_token: s.access_token, refresh_token: s.refresh_token });
        }
      });
    }
    return clients[env];
  }

  async function jetonsCourants(env) {
    const { data } = await (await client(env)).auth.getSession();
    return data.session;
  }

  reprise = creerReprise({
    envs: Object.keys(ENVS),
    mock: false,
    Canal,
    lire: async (env) => {
      const s = await jetonsCourants(env);
      return s ? { access_token: s.access_token, refresh_token: s.refresh_token } : null;
    },
    poser: async (env, s) => {
      const { error } = await (await client(env)).auth.setSession(s);
      if (error) throw error;
    },
    surRafraichie: async (env, s) => {
      const courante = await jetonsCourants(env);
      if (!courante || courante.refresh_token === s.refresh_token) return;
      const id = idSessionJeton(courante.access_token);
      if (!id || id !== idSessionJeton(s.access_token)) return;
      await (await client(env)).auth.setSession(s);
    },
  });

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
      reprise.marquerConnecte(env);
    },
    async deconnexion(env) {
      reprise.marquerDeconnecte(env);
      await (await client(env)).auth.signOut({ scope: 'local' });
    },
    // Onglet neuf : demande la session aux onglets ouverts. → true si reprise.
    reprendreSession: (env) => reprise.reprendre(env),
  };
}

function authMock({ Canal, stockage } = {}) {
  const sessionStorage = stockage || globalThis.sessionStorage;
  const cle = (env) => 'aristocles-mock-session-' + env;
  const lire = (env) => {
    try { return JSON.parse(sessionStorage.getItem(cle(env))); } catch (_) { return null; }
  };
  const reprise = creerReprise({
    envs: Object.keys(ENVS),
    mock: true,
    Canal,
    stockage: () => sessionStorage,
    lire: (env) => lire(env),
    poser: (env, s) => {
      if (!s?.email) throw new Error('session démo invalide');
      sessionStorage.setItem(cle(env), JSON.stringify({ email: s.email }));
    },
  });
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
      reprise.marquerConnecte(env);
    },
    async deconnexion(env) {
      reprise.marquerDeconnecte(env);
      sessionStorage.removeItem(cle(env));
    },
    reprendreSession: (env) => reprise.reprendre(env),
    // Accès synchrones pour le transport mock.
    estConnecte: (env) => Boolean(lire(env)),
    estAutorise: (env) => !/^refuse/i.test(lire(env)?.email || ''),
  };
}

// `Canal` (BroadcastChannel par défaut) et `stockage` (sessionStorage,
// démo seulement) : des doubles dans les tests.
export function creerAuth({ mock, Canal, stockage }) {
  return mock ? authMock({ Canal, stockage }) : authReelle({ Canal });
}

// Soumission du formulaire : connexion, sonde d'autorisation, puis
// retour à la route demandée (hash complet, env compris), pas à
// l'accueil. → message d'erreur ou null.
export async function connecterPuisRevenir({ auth, api, route, email, motDePasse, naviguer }) {
  try {
    await auth.connexion(route.env, email, motDePasse);
  } catch (e) {
    return e.message;
  }
  // Sonde : un compte connecté mais non autorisé est refusé ici,
  // plutôt que de découvrir le 403 plus tard.
  try {
    await api.enfants(route.env);
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      await auth.deconnexion(route.env);
      api.viderCache(route.env);
      return e.status === 403
        ? 'Ce compte n’est pas autorisé sur ' + route.env + '.'
        : 'Connexion refusée par le serveur ' + route.env + '.';
    }
    // Autre échec (réseau…) : la session est valide, l'écran le dira.
  }
  naviguer(route);
  return null;
}
