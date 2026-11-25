import { assertEquals } from 'jsr:@std/assert@1';
import { clesAuthASupprimer } from '../auth.js';

Deno.test('auth : nettoyage du localStorage — sessions Supabase et ancien mot de passe', () => {
  assertEquals(clesAuthASupprimer([
    'aristocles-pw',
    'sb-ngbqqewpkcugdwajpbff-auth-token',
    'sb-mtuqpdtihltuuyemdyni-auth-token',
    'aristocles-dashboard-auth-prod',
    'theme',
    'sb-autre-chose',
  ]), [
    'aristocles-pw',
    'sb-ngbqqewpkcugdwajpbff-auth-token',
    'sb-mtuqpdtihltuuyemdyni-auth-token',
    'aristocles-dashboard-auth-prod',
  ]);
});

// ---------- Onglets : partage de session (lot 119) ----------

import { connecterPuisRevenir, creerAuth, creerPartage, idSessionJeton, nomCanal } from '../auth.js';
import { analyserHash, construireHash } from '../router.js';

// Double de BroadcastChannel : un bus en mémoire. Comme le vrai, un
// message n'est pas remis à l'objet qui l'envoie, et il arrive plus tard.
function busCanaux() {
  const abonnes = new Map();
  let ouverts = 0;
  class Canal {
    constructor(nom) {
      this.nom = nom;
      this.onmessage = null;
      if (!abonnes.has(nom)) abonnes.set(nom, new Set());
      abonnes.get(nom).add(this);
      ouverts++;
    }
    postMessage(message) {
      const copie = structuredClone(message);
      for (const autre of abonnes.get(this.nom)) {
        if (autre !== this) setTimeout(() => autre.onmessage?.({ data: copie }), 0);
      }
    }
    close() { abonnes.get(this.nom).delete(this); }
  }
  return { Canal, noms: () => [...abonnes.keys()].sort(), ouverts: () => ouverts };
}

function stockageMemoire() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

// Un « onglet » démo : son propre sessionStorage, le bus commun.
const onglet = (bus, stockage = stockageMemoire()) =>
  ({ auth: creerAuth({ mock: true, Canal: bus.Canal, stockage }), stockage });

Deno.test('onglets : un onglet neuf reprend la session d’un onglet connecté du même env', async () => {
  const bus = busCanaux();
  const a = onglet(bus);
  await a.auth.connexion('prod', 'ana@exemple.fr', 'x');
  const b = onglet(bus);
  assertEquals(await b.auth.session('prod'), null);
  assertEquals(await b.auth.reprendreSession('prod'), true);
  assertEquals((await b.auth.session('prod')).email, 'ana@exemple.fr');
  // Posée dans le sessionStorage de B, pas ailleurs.
  assertEquals(JSON.parse(b.stockage.getItem('aristocles-mock-session-prod')), { email: 'ana@exemple.fr' });
});

Deno.test('onglets : aucun onglet ouvert → pas de session (écran de connexion), après l’attente courte', async () => {
  const bus = busCanaux();
  const b = onglet(bus);
  const debut = Date.now();
  assertEquals(await b.auth.reprendreSession('prod'), false);
  const duree = Date.now() - debut;
  assertEquals(duree >= 250 && duree < 1000, true, 'attente ≈ 300 ms, obtenue ' + duree);
  assertEquals(await b.auth.session('prod'), null);
});

Deno.test('onglets : un onglet connecté à dev seulement ne répond pas pour prod', async () => {
  const bus = busCanaux();
  const a = onglet(bus);
  await a.auth.connexion('dev', 'ana@exemple.fr', 'x');
  const b = onglet(bus);
  assertEquals(await b.auth.reprendreSession('prod'), false);
  assertEquals(await b.auth.reprendreSession('dev'), true);
});

Deno.test('onglets : un onglet déconnecté ne répond pas', async () => {
  const bus = busCanaux();
  const a = onglet(bus);
  await a.auth.connexion('prod', 'ana@exemple.fr', 'x');
  await a.auth.deconnexion('prod');
  const b = onglet(bus);
  assertEquals(await b.auth.reprendreSession('prod'), false);
});

Deno.test('onglets : une déconnexion n’est pas réveillée par un autre onglet, même après rafraîchissement', async () => {
  const bus = busCanaux();
  const b = onglet(bus);
  await b.auth.connexion('prod', 'ana@exemple.fr', 'x');
  const a = onglet(bus);
  assertEquals(await a.auth.reprendreSession('prod'), true);
  await a.auth.deconnexion('prod');
  assertEquals(await a.auth.reprendreSession('prod'), false);
  // Rafraîchissement de A : même sessionStorage, nouvel état en mémoire.
  const aRecharge = onglet(bus, a.stockage);
  assertEquals(await aRecharge.auth.reprendreSession('prod'), false);
  assertEquals(await aRecharge.auth.session('prod'), null);
  // B reste connecté : la déconnexion ne se propage pas.
  assertEquals((await b.auth.session('prod')).email, 'ana@exemple.fr');
  // Une connexion explicite lève le drapeau.
  await aRecharge.auth.connexion('prod', 'ana@exemple.fr', 'x');
  assertEquals(aRecharge.stockage.getItem('aristocles-dashboard-deconnecte-demo-prod'), null);
});

Deno.test('onglets : une seule demande par env et par chargement, partagée par deux rendus rapprochés', async () => {
  const bus = busCanaux();
  const a = onglet(bus);
  await a.auth.connexion('prod', 'ana@exemple.fr', 'x');
  const b = onglet(bus);
  const [r1, r2] = await Promise.all([b.auth.reprendreSession('prod'), b.auth.reprendreSession('prod')]);
  assertEquals([r1, r2], [true, true]);
});

Deno.test('onglets : canaux distincts par env et par mode (la démo ne répond jamais au réel)', () => {
  assertEquals(nomCanal('prod', false), 'aristocles-dashboard-session-prod');
  assertEquals(nomCanal('dev', true), 'aristocles-dashboard-session-demo-dev');
  const bus = busCanaux();
  onglet(bus);
  assertEquals(bus.noms(), ['aristocles-dashboard-session-demo-dev', 'aristocles-dashboard-session-demo-prod']);
});

Deno.test('onglets : sans BroadcastChannel, pas de reprise (connexion comme avant)', async () => {
  const auth = creerAuth({ mock: true, Canal: null, stockage: stockageMemoire() });
  assertEquals(await auth.reprendreSession('prod'), false);
});

Deno.test('onglets (chemin réel) : le protocole transporte les jetons et diffuse le rafraîchissement', async () => {
  const bus = busCanaux();
  const jetons = { access_token: 'aaa', refresh_token: 'rrr' };
  const recus = [];
  const connecte = creerPartage({ nom: 'c', lire: async () => jetons, surRafraichie: (s) => recus.push(s), Canal: bus.Canal });
  creerPartage({ nom: 'c', lire: async () => null, Canal: bus.Canal }); // onglet déconnecté : muet
  const neuf = creerPartage({ nom: 'c', lire: async () => null, Canal: bus.Canal, delaiMs: 50 });
  assertEquals(await neuf.demander(), jetons);
  const seul = creerPartage({ nom: 'd', lire: async () => null, Canal: bus.Canal, delaiMs: 50 });
  creerPartage({ nom: 'd', lire: async () => null, Canal: bus.Canal });
  assertEquals(await seul.demander(), null);
  neuf.diffuser({ access_token: 'bbb', refresh_token: 'sss' });
  await new Promise((r) => setTimeout(r, 10));
  assertEquals(recus, [{ access_token: 'bbb', refresh_token: 'sss' }]);
});

Deno.test('onglets : identifiant de session lu dans le jeton d’accès', () => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jeton = b64({ alg: 'HS256' }) + '.' + b64({ sub: 'u1', session_id: 's-42' }) + '.sig';
  assertEquals(idSessionJeton(jeton), 's-42');
  assertEquals(idSessionJeton('pas-un-jwt'), null);
  assertEquals(idSessionJeton(null), null);
});

// ---------- Retour à la route après connexion ----------

function apiDouble(echec) {
  const vides = [];
  return {
    vides,
    enfants: async () => { if (echec) throw Object.assign(new Error('refus'), { status: echec }); return []; },
    viderCache: (env) => vides.push(env),
  };
}

Deno.test('connexion : retour à la page demandée (route complète, query et env compris)', async () => {
  for (const hash of [
    '#/dev/seances/abc-123/tour/gen-9?internes=1',
    '#/prod/familles/enfant-7',
    '#/prod/reecoute?tout=1&mode=devoirs',
    '#/dev/veille/2026-11-20',
  ]) {
    const auth = creerAuth({ mock: true, Canal: null, stockage: stockageMemoire() });
    const vers = [];
    const echec = await connecterPuisRevenir({
      auth, api: apiDouble(), route: analyserHash(hash), email: 'ana@exemple.fr', motDePasse: 'x',
      naviguer: (r) => vers.push(construireHash(r)),
    });
    assertEquals(echec, null);
    assertEquals(vers, [hash]);
    assertEquals((await auth.session(analyserHash(hash).env)).email, 'ana@exemple.fr');
  }
});

Deno.test('connexion : compte non autorisé → message, déconnexion, pas de navigation', async () => {
  const auth = creerAuth({ mock: true, Canal: null, stockage: stockageMemoire() });
  const api = apiDouble(403);
  const vers = [];
  const echec = await connecterPuisRevenir({
    auth, api, route: analyserHash('#/dev/sante'), email: 'ana@exemple.fr', motDePasse: 'x', naviguer: (r) => vers.push(r),
  });
  assertEquals(echec, 'Ce compte n’est pas autorisé sur dev.');
  assertEquals(vers, []);
  assertEquals(api.vides, ['dev']);
  assertEquals(await auth.session('dev'), null);
});
