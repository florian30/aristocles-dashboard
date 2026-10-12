// Tests AVIS-3 : page Retours (retours parents « Votre avis »).
// Adaptateurs sur les exemples du contrat, routeur, cache, mock à
// état, règles pures de ui/retours.js.

import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { adapterRetour, adapterRetours, ApiError, creerApi } from '../api.js';
import { creerRetoursMock } from '../mock/retours.js';
import { transportMock } from '../mock/transport.js';
import { analyserHash, construireHash } from '../router.js';
import {
  auteurRetour,
  detailCourt,
  libelleNouveaux,
  lireRefRegistre,
  resumeApp,
  statutDepuisQuery,
} from '../ui/retours.js';
import { RETOUR, RETOUR_STATUT, RETOURS } from './contrat_retours_exemples.js';

// ---------- Adaptateurs (exemples du contrat § 2.13 à 2.15) ----------

Deno.test('adapterRetours : exemple du contrat § 2.13', () => {
  const l = adapterRetours(RETOURS);
  assertEquals(l.compteurs, { nouveau: 1, lu: 1, inscrit: 1, clos: 0 });
  assertEquals(l.statut, null);
  assertEquals(l.retours.length, 2);
  const [a, b] = l.retours;
  assertEquals(a.id, 'c0000000-0000-4000-8000-000000000001');
  assertEquals(a.enfant, { childId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', prenom: 'Léa', classe: 'CE2' });
  assertEquals(a.app, { version: '1.4.0', build: 212, plateforme: 'ios', env: 'prod' });
  assertEquals([a.statut, a.aCapture, a.refRegistre], ['nouveau', true, null]);
  assert(a.extrait.endsWith('…'));
  assertEquals([b.enfant, b.parentEmail, b.aCapture, b.sessionId], [null, null, false, null]);
});

Deno.test('adapterRetour : exemple du contrat § 2.14', () => {
  const d = adapterRetour(RETOUR);
  assert(d.retour.texte.includes('\nDeuxième ligne.'));
  assertEquals([d.retour.prisesVoix, d.retour.lancementId], [2, '1a000000-0000-4000-8000-000000000001']);
  assertEquals(d.retour.appareil.modele, 'iPad (9e génération)');
  assertEquals(d.seance, { sessionId: '11111111-1111-4111-8111-111111111111', debut: '2026-10-10T16:30:00Z', mode: 'dictee', theme: 'Les sons [s] et [z]' });
  assertEquals(d.capture.etat, 'ok');
  assertEquals(d.capture.validiteS, 3600);
  assert(d.capture.url.startsWith('https://'));
  assertEquals(d.fil.length, 4);
  assertEquals(d.fil.map((e) => e.apresRetour), [false, false, false, true]);
  assertEquals(d.fil[2], { seq: 3, clientTs: '2026-10-10T16:41:00Z', type: 'erreur_client', ecran: 'dictee', detail: { code: 'rotation' }, apresRetour: false });
  assertEquals(d.erreurs7j.map((e) => e.memeLancement), [true, false]);
  assertEquals(d.erreurs7j[0].build, 212);
  assert(d.fiche.startsWith('--- début ---'));
  assert(d.fiche.endsWith('--- fin ---'));
  // La fiche ne porte jamais l'URL signée.
  assert(!d.fiche.includes('signed-token'));
});

Deno.test('adapterRetour : capture purgée ou inconnue → pas d’URL', () => {
  const purgee = adapterRetour({ ...RETOUR, capture: { etat: 'purgee', url: 'x', expire_le: 'y', validite_s: 3600 } });
  assertEquals([purgee.capture.etat, purgee.capture.url, purgee.capture.expireLe], ['purgee', null, null]);
  assertEquals(adapterRetour({ retour: { id: 'r' } }).capture.etat, 'absente');
  assertEquals(adapterRetour({ retour: { id: 'r' }, capture: { etat: 'bizarre', url: 'x' } }).capture.url, null);
});

// ---------- Routeur ----------

Deno.test('route : #/{env}/retours et #/{env}/retours/{id}', () => {
  assertEquals(analyserHash('#/prod/retours'),
    { env: 'prod', vue: 'retours', retourId: null, query: {}, canonique: true });
  const r = analyserHash('#/dev/retours/ret-01?statut=nouveau');
  assertEquals([r.env, r.vue, r.retourId, r.query.statut, r.canonique], ['dev', 'retours', 'ret-01', 'nouveau', true]);
  assertEquals(construireHash(r), '#/dev/retours/ret-01?statut=nouveau');
  assertEquals(construireHash({ env: 'prod', vue: 'retours', query: {} }), '#/prod/retours');
});

// ---------- API : cache ----------

function transportCompte() {
  const appels = [];
  const reponses = {
    retours: () => RETOURS,
    retour: () => RETOUR,
    retour_statut: () => RETOUR_STATUT,
  };
  const transport = (env, action, params) => {
    appels.push({ env, action, params });
    return Promise.resolve(reponses[action]());
  };
  return { appels, transport };
}

Deno.test('api : retours en cache, retour jamais en cache', async () => {
  const { appels, transport } = transportCompte();
  const a = creerApi({ transport });
  await a.retours('dev');
  await a.retours('dev');
  assertEquals(appels.filter((x) => x.action === 'retours').length, 1);
  await a.retour('dev', 'c0000000-0000-4000-8000-000000000001');
  await a.retour('dev', 'c0000000-0000-4000-8000-000000000001');
  assertEquals(appels.filter((x) => x.action === 'retour').length, 2);
  assertEquals(appels.find((x) => x.action === 'retour').params, { retour_id: 'c0000000-0000-4000-8000-000000000001' });
});

Deno.test('api : filtre statut transmis ; absent sinon', async () => {
  const { appels, transport } = transportCompte();
  const a = creerApi({ transport });
  await a.retours('dev', { statut: 'lu' });
  await a.retours('dev');
  assertEquals(appels[0].params.statut, 'lu');
  assert(!('statut' in appels[1].params));
});

Deno.test('api : retourStatut vide le cache, omet ref_registre si undefined, envoie null', async () => {
  const { appels, transport } = transportCompte();
  const a = creerApi({ transport });
  await a.retours('dev');
  const r = await a.retourStatut('dev', 'c0000000-0000-4000-8000-000000000001', 'lu');
  assertEquals(r, { id: 'c0000000-0000-4000-8000-000000000001', statut: 'inscrit', refRegistre: 'R-1010-dictee-rotation' });
  const ecriture = appels.find((x) => x.action === 'retour_statut');
  assertEquals(ecriture.params, { retour_id: 'c0000000-0000-4000-8000-000000000001', statut: 'lu' });
  await a.retours('dev'); // cache vidé → relu
  assertEquals(appels.filter((x) => x.action === 'retours').length, 2);
  await a.retourStatut('dev', 'x', 'clos', null);
  assertEquals(appels.at(-1).params, { retour_id: 'x', statut: 'clos', ref_registre: null });
});

Deno.test('api : retour 404 → null', async () => {
  const a = creerApi({ transport: () => Promise.reject(new ApiError('Unknown retour_id', 404)) });
  assertEquals(await a.retour('dev', 'absent'), null);
});

// ---------- Mock à état ----------

const apiMock = () => creerApi({
  transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }),
});

Deno.test('mock : liste, compteurs, filtre, détail, 404', async () => {
  const a = apiMock();
  const l = await a.retours('dev');
  assertEquals(l.compteurs, { nouveau: 1, lu: 1, inscrit: 1, clos: 0 });
  assertEquals(l.retours.map((r) => r.id), ['ret-01', 'ret-02', 'ret-03']);
  const f = await a.retours('dev', { statut: 'inscrit' });
  assertEquals(f.retours.map((r) => r.id), ['ret-03']);
  assertEquals(f.compteurs.nouveau, 1); // compteurs sur toute la fenêtre
  const d = await a.retour('dev', 'ret-01');
  assertEquals(d.capture.etat, 'ok');
  assert(d.fil.some((e) => e.apresRetour));
  assertEquals((await a.retour('dev', 'ret-03')).capture.etat, 'purgee');
  assertEquals((await a.retour('dev', 'ret-02')).capture.etat, 'absente');
  assertEquals(await a.retour('dev', 'inconnu'), null);
});

Deno.test('mock : retour_statut garde l’état et valide comme l’Edge', async () => {
  const a = apiMock();
  const r = await a.retourStatut('dev', 'ret-01', 'inscrit', 'R-1110-rotation');
  assertEquals(r, { id: 'ret-01', statut: 'inscrit', refRegistre: 'R-1110-rotation' });
  const l = await a.retours('dev');
  assertEquals(l.compteurs, { nouveau: 0, lu: 1, inscrit: 2, clos: 0 });
  // ref absente → inchangée ; null → effacée.
  await a.retourStatut('dev', 'ret-01', 'clos');
  assertEquals((await a.retour('dev', 'ret-01')).retour.refRegistre, 'R-1110-rotation');
  await a.retourStatut('dev', 'ret-01', 'clos', null);
  assertEquals((await a.retour('dev', 'ret-01')).retour.refRegistre, null);
  const e1 = await assertRejects(() => a.retourStatut('dev', 'ret-01', 'archive'), ApiError);
  assertEquals(e1.status, 400);
  const e2 = await assertRejects(() => a.retourStatut('dev', 'ret-01', 'lu', 'pas une ref'), ApiError);
  assertEquals(e2.status, 400);
});

Deno.test('mock : un état par mock', () => {
  const a = creerRetoursMock();
  a.retour_statut({ retour_id: 'ret-01', statut: 'clos' });
  assertEquals(creerRetoursMock().retours().compteurs.clos, 0);
  assertEquals(a.retours().compteurs.clos, 1);
});

// ---------- ui/retours.js ----------

Deno.test('lireRefRegistre : vide → null, forme vérifiée', () => {
  assertEquals(lireRefRegistre('  '), { valeur: null, erreur: null });
  assertEquals(lireRefRegistre(' R-1010-dictee-rotation '), { valeur: 'R-1010-dictee-rotation', erreur: null });
  for (const faux of ['R-10-x', 'r-1010-x', 'R-1010-Dictee', 'R-1010-', 'R-1010-a--b', 'R-1010-' + 'a'.repeat(60)]) {
    assert(lireRefRegistre(faux).erreur, faux);
  }
});

Deno.test('statutDepuisQuery, libelleNouveaux, auteurRetour', () => {
  assertEquals(statutDepuisQuery({ statut: 'lu' }), 'lu');
  assertEquals(statutDepuisQuery({ statut: 'toString' }), null);
  assertEquals(statutDepuisQuery({}), null);
  assertEquals(statutDepuisQuery(undefined), null);
  assertEquals([libelleNouveaux(1), libelleNouveaux(3)], ['1 nouveau', '3 nouveaux']);
  assertEquals(auteurRetour({ enfant: { prenom: 'Léa', classe: 'CE2' } }), 'parent de Léa (CE2)');
  assertEquals(auteurRetour({ enfant: null }), 'un parent');
});

Deno.test('resumeApp et detailCourt', () => {
  assertEquals(resumeApp({ version: '1.4.0', build: 212, plateforme: 'ios', env: 'prod' }, { ios: 'iOS' }), 'iOS · 1.4.0 (212) · prod');
  assertEquals(resumeApp({ build: 7 }), 'build 7');
  assertEquals(resumeApp(null), '—');
  assertEquals(detailCourt(null), '');
  assertEquals(detailCourt({ code: 'rotation', n: 2, o: { a: 1 } }), 'code : rotation · n : 2 · o : {"a":1}');
  assertEquals(detailCourt('<b>brut</b>'), '<b>brut</b>');
});
