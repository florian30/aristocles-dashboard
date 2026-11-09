import { assert, assertEquals } from 'jsr:@std/assert@1';
import { creerApi } from '../api.js';
import { transportMock } from '../mock/transport.js';
import { analyserHash, construireHash } from '../router.js';
import { avecInternes, etatInternes, queryDeSection } from '../ui/internes.js';
import { decalerJour, hierParis } from '../ui/paris.js';
import { queryTri, trier, triDepuisQuery } from '../ui/tri.js';
import { COLONNES_TRI, TRI_PAR_DEFAUT } from '../vues/familles.js';

// ---------- Tri (Familles) ----------

const E = (prenom, classe, seances, derniereActivite, parentEmail = null) =>
  ({ prenom, classe, seances, derniereActivite, parentEmail, createdAt: null, notionsAcquises: 0 });
const ENFANTS = [
  E('Maël', 'CM1', 3, '2026-10-12T08:00:00Z', 'k@example.org'),
  E('adam', 'CE2', 12, '2026-10-14T08:00:00Z', 'a@example.org'),
  E('Lina', null, 0, null),
  E('Éloi', 'CM2', 1, '2026-10-01T08:00:00Z', 'e@example.org'),
];
const prenoms = (l) => l.map((e) => e.prenom);

Deno.test('tri texte : croissant puis décroissant, accents et casse ignorés, absents en fin', () => {
  assertEquals(prenoms(trier(ENFANTS, COLONNES_TRI, { cle: 'prenom', sens: 'asc' })), ['adam', 'Éloi', 'Lina', 'Maël']);
  assertEquals(prenoms(trier(ENFANTS, COLONNES_TRI, { cle: 'prenom', sens: 'desc' })), ['Maël', 'Lina', 'Éloi', 'adam']);
  // Classe absente (Lina) : dernière dans les deux sens.
  assertEquals(prenoms(trier(ENFANTS, COLONNES_TRI, { cle: 'classe', sens: 'asc' })), ['adam', 'Maël', 'Éloi', 'Lina']);
  assertEquals(prenoms(trier(ENFANTS, COLONNES_TRI, { cle: 'classe', sens: 'desc' })), ['Éloi', 'Maël', 'adam', 'Lina']);
});

Deno.test('tri nombre et date : numérique (12 > 3), dates absentes en fin', () => {
  assertEquals(prenoms(trier(ENFANTS, COLONNES_TRI, { cle: 'seances', sens: 'asc' })), ['Lina', 'Éloi', 'Maël', 'adam']);
  assertEquals(prenoms(trier(ENFANTS, COLONNES_TRI, { cle: 'seances', sens: 'desc' })), ['adam', 'Maël', 'Éloi', 'Lina']);
  assertEquals(prenoms(trier(ENFANTS, COLONNES_TRI, { cle: 'activite', sens: 'asc' })), ['Éloi', 'Maël', 'adam', 'Lina']);
  assertEquals(prenoms(trier(ENFANTS, COLONNES_TRI, { cle: 'activite', sens: 'desc' })), ['adam', 'Maël', 'Éloi', 'Lina']);
  // La liste d'origine n'est pas modifiée.
  assertEquals(prenoms(ENFANTS), ['Maël', 'adam', 'Lina', 'Éloi']);
});

Deno.test('tri : état lu dans la query, clic = croissant puis bascule', () => {
  assertEquals(triDepuisQuery({}, COLONNES_TRI, TRI_PAR_DEFAUT), { cle: 'activite', sens: 'desc' });
  assertEquals(triDepuisQuery({ tri: 'seances', sens: 'asc' }, COLONNES_TRI, TRI_PAR_DEFAUT), { cle: 'seances', sens: 'asc' });
  assertEquals(triDepuisQuery({ tri: 'inconnu', sens: 'asc' }, COLONNES_TRI, TRI_PAR_DEFAUT), TRI_PAR_DEFAUT);
  assertEquals(triDepuisQuery({ tri: 'prenom', sens: 'n_importe' }, COLONNES_TRI, TRI_PAR_DEFAUT), TRI_PAR_DEFAUT);

  const courant = TRI_PAR_DEFAUT;
  assertEquals(queryTri({ internes: '1' }, 'prenom', courant), { internes: '1', tri: 'prenom', sens: 'asc' });
  assertEquals(queryTri({}, 'prenom', { cle: 'prenom', sens: 'asc' }), { tri: 'prenom', sens: 'desc' });
  assertEquals(queryTri({}, 'prenom', { cle: 'prenom', sens: 'desc' }), { tri: 'prenom', sens: 'asc' });
  assertEquals(queryTri({}, 'activite', courant), { tri: 'activite', sens: 'asc' });
  // Le tri tient dans le hash.
  const r = analyserHash(construireHash({ env: 'prod', vue: 'familles', query: { tri: 'seances', sens: 'desc' } }));
  assertEquals(triDepuisQuery(r.query, COLONNES_TRI, TRI_PAR_DEFAUT), { cle: 'seances', sens: 'desc' });
});

// ---------- Interrupteur « Comptes de test internes » ----------

Deno.test('internes : avec_internes passé à l’Edge seulement si l’interrupteur est activé', async () => {
  const recus = [];
  const api = creerApi({ transport: async (_env, action, params) => {
    recus.push({ action, params });
    return {};
  } });
  const avec = { avecInternes: true };
  await api.sessions('prod', '2026-10-01', '2026-10-07', null, avec);
  await api.journee('prod', '2026-10-07', avec);
  await api.apercu('prod', '2026-10-01', '2026-10-07', avec);
  await api.sante('prod', '2026-10-01', '2026-10-07', avec);
  await api.enfants('prod', null, null, avec);
  assertEquals(recus.map((r) => r.action), ['session', 'journee', 'apercu', 'sante', 'enfants']);
  assert(recus.every((r) => r.params.avec_internes === true));
  // `enfant` n'écarte pas (contrat v2.8 § 1.10) : jamais de param.
  recus.length = 0;
  await api.enfant('prod', 'c1', null, null, avec);
  assertEquals(recus[0].params, { child_id: 'c1' });

  recus.length = 0;
  await api.sessions('prod', '2026-10-01', '2026-10-07', null, { avecInternes: false });
  await api.journee('prod', '2026-10-07');
  await api.sante('prod', '2026-10-01', '2026-10-07', {});
  await api.enfants('prod');
  assert(recus.every((r) => !('avec_internes' in r.params)));
  // Combinable avec les séances sans échange ; clés de cache distinctes.
  recus.length = 0;
  await api.journee('prod', '2026-10-06', { avecInternes: true, avecSansEchange: true });
  await api.journee('prod', '2026-10-06', {});
  assertEquals(recus.map((r) => r.params), [
    { date: '2026-10-06', avec_sans_echange: true, avec_internes: true },
    { date: '2026-10-06' },
  ]);
});

Deno.test('internes : état lu dans le hash, conservé au changement de section, coupé par internes=0', () => {
  const hash = (vue, query) => analyserHash(construireHash({ env: 'prod', vue, query }));

  // Défaut : désactivé, rien à réécrire.
  assertEquals(etatInternes(hash('familles', {}), false), { actif: false, reecrire: null });
  // Activé par le hash (lien de l'interrupteur, ou rechargement).
  const familles = hash('familles', { internes: '1' });
  assertEquals(avecInternes(familles), true);
  assertEquals(etatInternes(familles, false), { actif: true, reecrire: null });

  // Changement de section par l'onglet : la query de l'onglet porte l'interrupteur…
  assertEquals(queryDeSection(true), { internes: '1' });
  assertEquals(queryDeSection(false), {});
  assertEquals(avecInternes(hash('seances', queryDeSection(true))), true);
  // …et un lien sans query (ligne de tableau, retour) le reçoit par réécriture.
  const seance = analyserHash('#/prod/seances/ses-01');
  const etat = etatInternes(seance, true);
  assertEquals(etat.actif, true);
  assertEquals(construireHash(etat.reecrire), '#/prod/seances/ses-01?internes=1');
  // Les autres filtres sont gardés.
  const veille = analyserHash('#/prod/veille/2026-10-14?sans_echange=1');
  assertEquals(construireHash(etatInternes(veille, true).reecrire), '#/prod/veille/2026-10-14?sans_echange=1&internes=1');

  // Coupure : internes=0 → désactivé, hash nettoyé ; la section suivante reste au défaut.
  const coupe = etatInternes(hash('apercu', { periode: '30j', internes: '0' }), true);
  assertEquals(coupe.actif, false);
  assertEquals(construireHash(coupe.reecrire), '#/prod/apercu?periode=30j');
  assertEquals(etatInternes(hash('familles', {}), coupe.actif), { actif: false, reecrire: null });
});

Deno.test('mock : le compte de test interne est écarté par défaut, réaffiché avec avec_internes', async () => {
  const api = creerApi({
    transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }),
  });
  const ids = (l) => l.map((e) => e.childId);

  const sans = await api.enfants('prod');
  const avec = await api.enfants('prod', null, null, { avecInternes: true });
  assert(!ids(sans.enfants).includes('c9'));
  assert(ids(avec.enfants).includes('c9'));
  assertEquals(avec.enfants.length, sans.enfants.length + 1);

  // La fiche s'ouvre par son id, avec le drapeau pour le badge.
  const fiche = await api.enfant('prod', 'c9');
  assertEquals(fiche.identite.prenom, 'Camille');
  assertEquals(fiche.identite.compteInterne, true);
  assertEquals((await api.enfant('prod', 'c1')).identite.compteInterne, false);

  const to = hierParis();
  const from = decalerJour(to, -6);
  const s0 = await api.sessions('prod', from, to, null);
  const s1 = await api.sessions('prod', from, to, null, { avecInternes: true });
  assert(!s0.seances.some((s) => s.childId === 'c9'));
  assert(s1.seances.some((s) => s.childId === 'c9'));

  const j0 = await api.journee('prod', to);
  const j1 = await api.journee('prod', to, { avecInternes: true });
  assert(!j0.enfants.some((e) => e.childId === 'c9'));
  assert(j1.enfants.some((e) => e.childId === 'c9'));

  const a0 = await api.apercu('prod', from, to);
  const a1 = await api.apercu('prod', from, to, { avecInternes: true });
  assert(a1.seances.total > a0.seances.total);
});

Deno.test('internes : la page Retours et sa pastille suivent l’interrupteur', async () => {
  const recus = [];
  const api = creerApi({ transport: async (_env, action, params) => {
    recus.push({ action, params });
    return {};
  } });
  await api.retours('prod', { statut: 'nouveau' }, { avecInternes: true });
  await api.retours('prod', {}, { avecInternes: true }); // pastille
  await api.retours('prod', {}, { avecInternes: false });
  assertEquals(recus.map((r) => r.params), [
    { statut: 'nouveau', avec_internes: true },
    { avec_internes: true },
    {},
  ]);

  // Mock : le retour du compte interne (ret-04, nouveau) n'apparaît qu'avec le param.
  const mock = creerApi({
    transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }),
  });
  const sans = await mock.retours('prod');
  const avec = await mock.retours('prod', {}, { avecInternes: true });
  assert(!sans.retours.some((r) => r.id === 'ret-04'));
  assert(avec.retours.some((r) => r.id === 'ret-04'));
  assertEquals(avec.compteurs.nouveau, sans.compteurs.nouveau + 1);
});
