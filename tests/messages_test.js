import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { ApiError, creerApi, transportHttp } from '../api.js';
import { urlDashboard, urlEdge } from '../config.js';
import { creerConsoleMock } from '../mock/console.js';
import { transportMock } from '../mock/transport.js';
import { analyserHash, construireHash } from '../router.js';
import {
  ajusterInApp, champRefuse, choixInApp, creerNumeroEnvoi, formulaireDepuisMessage, messageNotif, formulaireNotifVide, issueErreur,
  messageInAppVide, paramsMessageInApp, paramsNotif, parisEnLocal, parisVersIso, phraseAvertissement, resumeCible,
  verifierMessageInApp, verifierNotif,
} from '../ui/messages.js';

const api = (opts = {}) => creerApi({
  transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0, ...opts }),
});
const notif = (champs = {}) => ({ ...formulaireNotifVide(), titre: 'Bonjour', texte: 'Un texte factice.', ...champs });
const inApp = (champs = {}) => ({ ...messageInAppVide(), nom: 'Essai', texte: 'Un texte.', ...champs });
const champs = (erreurs) => erreurs.map((e) => e.champ);

// ---------- Route et Edge ----------

Deno.test('route : #/dev/messages et ?onglet=app', () => {
  assertEquals(analyserHash('#/dev/messages').vue, 'messages');
  const r = analyserHash('#/prod/messages?onglet=app');
  assertEquals([r.env, r.vue, r.query.onglet], ['prod', 'messages', 'app']);
  assertEquals(analyserHash(construireHash(r)).query.onglet, 'app');
});

Deno.test('config : l’Edge notifs_console à côté de dashboard', () => {
  assert(urlEdge('dev', 'notifs_console').endsWith('/functions/v1/notifs_console'));
  assertEquals(urlEdge('dev'), urlDashboard('dev'));
});

Deno.test('http : la console appelle notifs_console, même jeton, même corps ; le 409 garde son corps', async () => {
  const appels = [];
  const fetchFactice = (url, init) => {
    appels.push({ url, init });
    const conflit = JSON.parse(init.body).action === 'envoyer';
    const corps = conflit ? { error: 'doublon_probable', campagne: { id: 'x', titre: 'T' } } : { campagnes: [], automatiques: [] };
    return Promise.resolve(new Response(JSON.stringify(corps), { status: conflit ? 409 : 200 }));
  };
  const a = creerApi({ transport: transportHttp(() => Promise.resolve('jeton'), fetchFactice) });
  await a.console.resultats('dev', 7);
  assert(appels[0].url.endsWith('/functions/v1/notifs_console'));
  assertEquals(appels[0].init.headers.Authorization, 'Bearer jeton');
  assertEquals(JSON.parse(appels[0].init.body), { action: 'resultats', params: { jours: 7 } });
  const e = await assertRejects(() => a.console.envoyer('dev', { message: {} }), ApiError);
  assertEquals(issueErreur(e), { cas: 'doublon', campagne: { id: 'x', titre: 'T' } });
});

Deno.test('console : jamais en cache (deux lectures, deux appels)', async () => {
  let n = 0;
  const transport = (_env, action) => { n++; return Promise.resolve(action === 'messages' ? { messages: [] } : {}); };
  const a = creerApi({ transport });
  await a.console.messages('dev');
  await a.console.messages('dev');
  assertEquals(n, 2);
});

// ---------- Dates de Paris ----------

Deno.test('dates : heure de Paris ↔ ISO avec fuseau, été comme hiver', () => {
  assertEquals(parisVersIso('2026-07-01T09:00'), '2026-07-01T09:00:00+02:00');
  assertEquals(parisVersIso('2026-12-01T09:00'), '2026-12-01T09:00:00+01:00');
  assertEquals(parisVersIso('2026-10-25T12:00'), '2026-10-25T12:00:00+01:00'); // jour du changement d'heure
  assertEquals(parisVersIso('2026-04-31T09:00'), null);
  assertEquals(parisVersIso(''), null);
  assertEquals(parisEnLocal('2026-07-01T07:00:00Z'), '2026-07-01T09:00');
});

// ---------- Numéro d'envoi ----------

Deno.test('numéro d’envoi : stable jusqu’au renouvellement', () => {
  let k = 0;
  const n = creerNumeroEnvoi(() => 'id-' + (++k));
  assertEquals([n.id, n.id], ['id-1', 'id-1']);
  n.renouveler();
  assertEquals(n.id, 'id-2');
});

// ---------- Erreurs ----------

Deno.test('erreurs : champ refusé et cas', () => {
  assertEquals(champRefuse("Invalid body: 'cible.parent_ids' must be …"), 'parent_ids');
  assertEquals(issueErreur(new ApiError('x', 503)).cas, 'indisponible');
  assertEquals(issueErreur(new ApiError('x', 0)).cas, 'reseau');
  assertEquals(issueErreur(new ApiError("Invalid body: 'message.titre' must be a string", 400)).champ, 'titre');
  assertEquals(issueErreur(new ApiError('deja_partie', 409, { error: 'deja_partie' })).cas, 'deja_partie');
  assert(phraseAvertissement({ code: 'horaire_nuit', heure_paris: '22:00', debut: '20:30', fin: '08:00' }).includes('22:00'));
  assert(phraseAvertissement({ code: 'inconnu' }).includes('inconnu'));
});

// ---------- Formulaire de notification ----------

Deno.test('notif : vide = tout le monde, rien dans cible', () => {
  assertEquals(paramsNotif(notif()), { message: { type: 'nouveautes', titre: 'Bonjour', texte: 'Un texte factice.', destination: 'aucune' } });
  assertEquals(verifierNotif(notif()), []);
});

Deno.test('notif : règles avant envoi', () => {
  assertEquals(champs(verifierNotif(notif({ titre: '', texte: 'x'.repeat(241) }))), ['titre', 'texte']);
  assertEquals(champs(verifierNotif(notif({ destination: 'url', url: 'http://non' }))), ['url']);
  assertEquals(champs(verifierNotif(notif({ buildMin: '50', buildMax: '40' }))), ['build_max']);
  assertEquals(verifierNotif(notif({ buildMin: '40', buildMax: '40' })), []); // max inclus
  const futur = parisEnLocal(new Date(Date.now() + 86400000));
  assertEquals(champs(verifierNotif(notif({ envoyerA: futur, parentIds: ['p-0001'] }))), ['parent_ids']);
  const p = paramsNotif(notif({ envoyerA: futur, classes: ['CM2'], destination: 'url', url: ' https://example.org ' }));
  assert(/[+-]\d{2}:\d{2}$/.test(p.envoyer_a));
  assertEquals(p.cible, { classes: ['CM2'] });
  assertEquals(p.message.url, 'https://example.org');
});

// ---------- Formulaire de message dans l'app ----------

Deno.test('in-app : ouverture_notif jamais proposé, gardé seulement s’il est déjà là', () => {
  assert(!choixInApp(messageInAppVide()).declencheurs.includes('ouverture_notif'));
  assert(!choixInApp({ ...messageInAppVide(), emplacement: 'espace_parent' }).declencheurs.includes('ouverture_notif'));
  assert(choixInApp({ ...messageInAppVide(), declencheur: 'ouverture_notif' }).declencheurs.includes('ouverture_notif'));
});

Deno.test('in-app : l’accueil enfant ramène format, déclencheur, destination', () => {
  const f = inApp({ emplacement: 'espace_parent', format: 'plein_ecran', declencheur: 'nieme_entree_parent', destination: 'url', url: 'https://a.b' });
  f.emplacement = 'accueil_enfant';
  assertEquals(ajusterInApp(f).length, 3);
  assertEquals([f.format, f.declencheur, f.destination, f.url], ['feuille', 'prochaine_ouverture', 'aucune', '']);
});

Deno.test('in-app : règles de la table', () => {
  assertEquals(verifierMessageInApp(inApp()), []);
  assertEquals(champs(verifierMessageInApp(inApp({ destination: 'dictee' }))), ['bouton_libelle']);
  assertEquals(champs(verifierMessageInApp(inApp({ texte: '' }))), ['texte']);
  assertEquals(champs(verifierMessageInApp(inApp({ emplacement: 'espace_parent', format: 'plein_ecran' }))), ['titre']);
  assertEquals(champs(verifierMessageInApp(inApp({ emplacement: 'espace_parent', declencheur: 'nieme_entree_parent' }))), ['declencheur_n']);
  assertEquals(champs(verifierMessageInApp(inApp({ declencheur: 'nieme_entree_parent', declencheur_n: '2' }))), ['declencheur']);
  assertEquals(champs(verifierMessageInApp(inApp({ buildMin: '40', buildMax: '40' }))), ['build_max']); // max exclu
  assertEquals(champs(verifierMessageInApp(inApp({ debut: '2026-11-02T10:00', fin: '2026-11-01T10:00' }))), ['fin_at']);
  assertEquals(champs(verifierMessageInApp(inApp({ priorite: '1001', max_affichages: '0' }))), ['priorite', 'max_affichages']);
  assertEquals(champs(verifierMessageInApp(inApp({ image_chemin: 'https://x/y.png' }))), ['image_chemin']);
  assertEquals(champs(verifierMessageInApp(inApp({ familles: 'designees' }))), ['parent_ids']);
});

Deno.test('in-app : familles — toutes, désignées, inchangées', () => {
  assertEquals(paramsMessageInApp(inApp()).toutes_les_familles, true);
  assertEquals(paramsMessageInApp(inApp({ familles: 'designees', parentIds: ['p-0001'] })).parent_ids, ['p-0001']);
  const p = paramsMessageInApp(inApp({ familles: 'inchangees' }));
  assert(!('parent_ids' in p) && !('toutes_les_familles' in p));
});

Deno.test('in-app : un message relu revient tel quel au serveur', () => {
  const m = {
    nom: 'N', format: 'plein_ecran', emplacement: 'espace_parent', declencheur: 'nieme_entree_parent', declencheur_n: 3,
    surtitre: null, titre: 'T', texte: null, points: ['a', 'b'], image_chemin: 'annonces/x.png', bouton_libelle: 'Voir',
    destination: 'bilan_semaine', url: null, priorite: 5, max_affichages: 2, debut_at: '2026-11-01T08:00:00.000Z', fin_at: null,
    cible: { plateforme: 'ios', classes: null, build_min: 140, build_max: null, familles: 4 },
  };
  const f = formulaireDepuisMessage(m);
  assertEquals(f.familles, 'inchangees');
  assertEquals(verifierMessageInApp(f), []);
  const { message } = paramsMessageInApp(f);
  assertEquals(message.declencheur_n, 3);
  assertEquals(Date.parse(message.debut_at), Date.parse(m.debut_at));
  assertEquals(message.cible, { plateforme: 'ios', build_min: 140 });
});

Deno.test('résumé de cible', () => {
  assertEquals(resumeCible({}), 'Tout le monde');
  assertEquals(resumeCible({ plateforme: 'ios', classes: ['CM1'], build_max: 141, familles: 2 }), 'iOS · CM1 · build ≤ 141 · 2 familles choisies');
  assertEquals(resumeCible({ build_max: 141 }, { maxExclu: true }), 'build < 141');
});

// ---------- Le mock, scénario par scénario ----------

const UUID = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

Deno.test('mock console : aperçu — audience, type coupé, sans téléphone', async () => {
  const a = await api().console.apercu('dev', paramsNotif(notif({ type: 'actualites' })));
  assertEquals(a.audience.familles, 7);
  assertEquals(a.audience.avecAppareil, 6); // p-0005 sans téléphone
  assertEquals(a.audience.typeCoupe, 1); // p-0003 a coupé actualites
  assertEquals(a.audience.joignables, 5);
  assertEquals(a.audience.appareils, a.audience.parPlateforme.ios + a.audience.parPlateforme.android);
  assert(a.avertissements.some((w) => w.code === 'repere_mensuel'));
});

Deno.test('mock console : essai — appareils puis envoi, type coupé respecté', async () => {
  const c = api().console;
  const tel = await c.appareils('dev', 'p-0003');
  assertEquals(tel.length, 1);
  assertEquals((await c.envoyerTest('dev', tel[0].appareil_id, messageNotif(notif()))).statut, 'envoye');
  const coupe = await c.envoyerTest('dev', tel[0].appareil_id, { type: 'actualites', titre: 'T', texte: 'X', destination: 'aucune' });
  assertEquals([coupe.statut, coupe.raison], ['non_envoye', 'type_coupe']);
  assertEquals(await c.appareils('dev', 'p-0005'), []);
});

Deno.test('mock console : envoyer, réessayer avec le même numéro = déjà', async () => {
  const c = api().console;
  const params = { ...paramsNotif(notif({ titre: 'Unique 1' })), campagne_id: UUID(1) };
  const r = await c.envoyer('dev', params);
  assertEquals([r.deja, r.campagne.etat], [false, 'terminee']);
  assert(r.campagne.envoyes > 0);
  assert(!('cibleEnvoi' in r.campagne) && !('reponsePerdue' in r.campagne));
  assertEquals((await c.envoyer('dev', params)).deja, true);
});

Deno.test('mock console : coupure réseau, le nouvel essai ne renvoie rien', async () => {
  const c = api().console;
  const params = { ...paramsNotif(notif({ texte: 'Test coupure' })), campagne_id: UUID(2) };
  const e = await assertRejects(() => c.envoyer('dev', params), ApiError);
  assertEquals(issueErreur(e).cas, 'reseau');
  const r = await c.envoyer('dev', params);
  assertEquals([r.deja, r.campagne.etat], [true, 'terminee']);
});

Deno.test('mock console : bloqué en cours → 409, reprendre termine', async () => {
  const c = api().console;
  const params = { ...paramsNotif(notif({ texte: 'Envoi bloque' })), campagne_id: UUID(3) };
  await assertRejects(() => c.envoyer('dev', params), ApiError);
  const e = await assertRejects(() => c.envoyer('dev', params), ApiError);
  assertEquals(issueErreur(e).cas, 'en_cours');
  assertEquals((await c.envoyer('dev', { ...params, reprendre: true })).campagne.etat, 'terminee');
});

Deno.test('mock console : doublon sous un autre numéro → 409, confirmer passe', async () => {
  const c = api().console;
  const base = paramsNotif(notif({ titre: 'Deux fois' }));
  await c.envoyer('dev', { ...base, campagne_id: UUID(4) });
  const apercu = await c.apercu('dev', { ...base, campagne_id: UUID(5) });
  assert(apercu.avertissements.some((w) => w.code === 'doublon_probable'));
  const e = await assertRejects(() => c.envoyer('dev', { ...base, campagne_id: UUID(5) }), ApiError);
  const issue = issueErreur(e);
  assertEquals([issue.cas, issue.campagne.id], ['doublon', UUID(4)]);
  assertEquals((await c.envoyer('dev', { ...base, campagne_id: UUID(5), confirmer_doublon: true })).deja, false);
});

Deno.test('mock console : programmer, annuler, annuler encore, trop tard', async () => {
  const c = api().console;
  const futur = parisEnLocal(new Date(Date.now() + 3 * 86400000));
  const r = await c.envoyer('dev', { ...paramsNotif(notif({ titre: 'Plus tard', envoyerA: futur })), campagne_id: UUID(6) });
  assertEquals(r.campagne.etat, 'programmee');
  assertEquals((await c.annuler('dev', UUID(6))).deja, false);
  assertEquals((await c.annuler('dev', UUID(6))).deja, true);
  const e = await assertRejects(() => c.annuler('dev', UUID(9001)), ApiError);
  assertEquals(issueErreur(e).cas, 'deja_partie');
  const futurFamilles = { ...paramsNotif(notif({ envoyerA: futur })), cible: { parent_ids: ['p-0001'] }, campagne_id: UUID(7) };
  const refus = await assertRejects(() => c.envoyer('dev', futurFamilles), ApiError);
  assertEquals(issueErreur(refus).champ, 'parent_ids');
});

Deno.test('mock console : résultats — en retard, codes d’échec, automatiques', async () => {
  const r = await api().console.resultats('dev', 30);
  const parId = Object.fromEntries(r.campagnes.map((c) => [c.id, c]));
  assertEquals(parId[UUID(9004)].en_retard, true);
  assertEquals(parId[UUID(9003)].en_retard, false);
  assertEquals(parId[UUID(9005)].codes_echec, { UNREGISTERED: 1 });
  assertEquals(r.automatiques.length, 3);
  assert(!(await api().console.resultats('dev', 7)).campagnes.some((c) => c.id === UUID(9005)));
});

Deno.test('mock console : un message naît inactif, se publie, se retire', async () => {
  const c = api().console;
  const id = UUID(42);
  const m = await c.ecrireMessage('dev', id, paramsMessageInApp(inApp({ nom: 'Nouveau' })));
  assertEquals([m.actif, m.cible.familles], [false, null]);
  assertEquals((await c.activerMessage('dev', id, true)).actif, true);
  const modifie = await c.ecrireMessage('dev', id, paramsMessageInApp({ ...formulaireDepuisMessage(m), texte: 'Autre' }));
  assertEquals([modifie.actif, modifie.texte], [true, 'Autre']); // modifier ne dépublie pas
  assertEquals((await c.activerMessage('dev', id, false)).actif, false);
  assert((await c.messages('dev')).some((x) => x.id === id));
});

Deno.test('mock console : familles inchangées gardent la liste, désignées la remplacent', async () => {
  const c = api().console;
  const [m] = (await c.messages('dev')).filter((x) => x.id === UUID(8003));
  assertEquals(m.cible.familles, 2);
  const f = { ...formulaireDepuisMessage(m), declencheur: 'prochaine_ouverture' };
  assertEquals((await c.ecrireMessage('dev', m.id, paramsMessageInApp(f))).cible.familles, 2);
  const g = { ...f, familles: 'designees', parentIds: ['p-0001', 'p-0002', 'p-0004'] };
  assertEquals((await c.ecrireMessage('dev', m.id, paramsMessageInApp(g))).cible.familles, 3);
});

Deno.test('mock console : le serveur reste juge (règles refusées sans l’écran)', async () => {
  const c = api().console;
  const refuse = async (message) => issueErreur(await assertRejects(() => c.ecrireMessage('dev', UUID(43), { message }), ApiError));
  assertEquals((await refuse({ nom: 'X', format: 'plein_ecran', titre: 'T' })).champ, 'format');
  assertEquals((await refuse({ nom: 'X', texte: 'T', destination: 'url', url: 'https://a.b', bouton_libelle: 'Go' })).champ, 'destination');
  assertEquals((await refuse({ nom: 'X', texte: 'T', destination: 'dictee' })).champ, 'bouton_libelle');
  assertEquals((await refuse({ nom: 'X', emplacement: 'espace_parent', declencheur: 'fin_de_seance', texte: 'T' })).champ, 'declencheur');
  const e = await assertRejects(() => c.activerMessage('dev', UUID(44), true), ApiError);
  assertEquals(e.status, 404);
});

Deno.test('mock console : action inconnue → 400 ; console isolée par transport', async () => {
  const transport = transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 });
  const e = await assertRejects(() => transport('dev', 'stats', {}, { edge: 'notifs_console' }), ApiError);
  assertEquals(e.status, 400);
  const autre = creerConsoleMock();
  assertEquals(autre.messages().messages.length, 3);
});
