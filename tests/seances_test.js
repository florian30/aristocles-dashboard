import { assert, assertEquals } from 'jsr:@std/assert@1';
import { adapterConsignes, adapterDetail, adapterPhotosSeance, adapterSessions, creerApi } from '../api.js';
import { SESSIONS } from '../mock/donnees.js';
import { transportMock } from '../mock/transport.js';

const apiMock = () => creerApi({
  transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }),
});

const presente = (texte, metadata = null) => ({ type: 'exercice_presente', texte, metadata });
const ecran = (position, interactions, statutFermeture = 'resolu_succes') =>
  ({ id: 'e' + position, position, type: 'exercice', statutFermeture, exercices: [], interactions });

Deno.test('consignes : corrigée (origine → texte), matière seule, ajoutée, retirée, par position', () => {
  const c = adapterConsignes([
    ecran(3, [presente('Texte juste', { corrige_par_enfant: true, enonce_origine: 'Texte fau' })]),
    ecran(1, [presente('Même texte', { corrige_par_enfant: true, enonce_origine: 'Même texte', matiere: 'maths' })]),
    ecran(2, [presente('Ajoutée', { ajoute_par_enfant: true })]),
    ecran(4, [presente('Retirée')], 'retire_par_enfant'),
    { id: 'v', position: 0, type: 'vue_ensemble', statutFermeture: null, exercices: [], interactions: [] },
    ecran(5, []),
  ]);
  assertEquals(c.map((x) => x.position), [1, 2, 3, 4]);
  assertEquals([c[0].origine, c[0].corrigee, c[0].matiere], [null, true, 'maths']);
  assertEquals(c[1].ajoutee, true);
  assertEquals([c[2].origine, c[2].texte], ['Texte fau', 'Texte juste']);
  assertEquals([c[3].retiree, c[3].texte], [true, 'Retirée']);
});

Deno.test('détail : écrans dans l’ordre reçu (jamais retriés), premiere_activite_at exposé', () => {
  const d = adapterDetail({
    session: { id: 's', started_at: '2026-10-09T16:00:00Z' },
    ecrans: [
      { id: 'b', position: 3, type: 'exercice', premiere_activite_at: '2026-10-09T16:01:00Z' },
      { id: 'a', position: 1, type: 'vue_ensemble', premiere_activite_at: null },
    ],
  });
  assertEquals(d.ecrans.map((e) => e.position), [3, 1]);
  assertEquals([d.ecrans[0].premiereActiviteAt, d.ecrans[1].premiereActiviteAt], ['2026-10-09T16:01:00Z', null]);
});

Deno.test('sessions : { seances, sansEchange } ; compteur absent → null', () => {
  assertEquals(adapterSessions({ sessions: [] }), { seances: [], sansEchange: null });
  assertEquals(adapterSessions({ sessions: [], seances_sans_echange: 3 }).sansEchange, 3);
});

Deno.test('api : avec_sans_echange posé seulement si demandé, clé de cache distincte', async () => {
  const recus = [];
  const api = creerApi({ transport: async (_env, action, params, options) => {
    recus.push({ action, params, options });
    return { sessions: [], seances_sans_echange: 2 };
  } });
  await api.sessions('prod', null, null, 'all');
  await api.sessions('prod', null, null, 'all', { avecSansEchange: false });
  await api.sessions('prod', null, null, 'all', { avecSansEchange: true });
  await api.journee('prod', '2026-10-09', { avecSansEchange: true });
  assertEquals(recus.length, 3); // le 2e appel sort du cache du 1er
  assertEquals('avec_sans_echange' in recus[0].params, false);
  assertEquals(recus[1].params.avec_sans_echange, true);
  assertEquals(recus[2].params, { date: '2026-10-09', avec_sans_echange: true });
  assertEquals('avecSansEchange' in recus[1].options, false);
});

Deno.test('photos_seance : adaptateur (purgée sans url, dictée, redressée)', () => {
  const r = adapterPhotosSeance({
    session_id: 's', validite_s: 3600, expire_le: 'x',
    photos: [
      { rang: 1, source: 'devoirs', ecran_id: 'e1', interaction_id: 'i1', dictee_id: null, redressee: false, prise_le: 't', etat: 'ok', url: 'u1' },
      { rang: 2, source: 'devoirs', ecran_id: 'e1', interaction_id: 'i1', dictee_id: null, redressee: true, prise_le: 't', etat: 'ok', url: 'u2' },
      { rang: 3, source: 'devoirs', ecran_id: 'e1', interaction_id: 'i2', dictee_id: null, redressee: false, prise_le: 't', etat: 'purgee', url: null },
      { rang: 4, source: 'dictee', ecran_id: 'e2', interaction_id: null, dictee_id: 'd1', redressee: false, prise_le: 't', etat: 'ok', url: 'u4' },
    ],
  });
  assertEquals(r.validiteS, 3600);
  assertEquals(r.photos.map((p) => [p.redressee, p.purgee, p.url]), [[false, false, 'u1'], [true, false, 'u2'], [false, true, null], [false, false, 'u4']]);
  assertEquals([r.photos[3].source, r.photos[3].dicteeId, r.photos[3].interactionId], ['dictee', 'd1', null]);
});

Deno.test('api : photosSeance jamais en cache ; 404 → null', async () => {
  let appels = 0;
  const api = creerApi({ transport: async (_e, _a, params) => {
    appels += 1;
    if (params.session_id === 'inconnue') throw Object.assign(new Error('x'), { status: 404 });
    return { session_id: params.session_id, photos: [] };
  } });
  await api.photosSeance('prod', 's');
  const r = await api.photosSeance('prod', 's');
  assertEquals([appels, r.photos.length], [2, 0]);
  assertEquals(await api.photosSeance('prod', 'inconnue'), null);
});

Deno.test('mock : séances sans échange masquées par défaut, comptées, affichables', async () => {
  const api = apiMock();
  const defaut = await api.sessions('prod', null, null, 'all');
  const toutes = await api.sessions('prod', null, null, 'all', { avecSansEchange: true });
  assert(defaut.sansEchange >= 4);
  assertEquals(toutes.sansEchange, defaut.sansEchange);
  assertEquals(toutes.seances.length - defaut.seances.length, defaut.sansEchange);

  const fiche = await api.enfant('prod', 'c4', null, null, { avecSansEchange: true });
  assert(fiche.sansEchange >= 2);
  assertEquals(fiche.seances.filter((s) => s.sansEchange).length, fiche.sansEchange);
  const ficheDefaut = await api.enfant('prod', 'c4');
  assertEquals(ficheDefaut.seances.some((s) => s.sansEchange), false);

  const familles = await api.enfants('prod');
  assertEquals(familles.sansEchange, defaut.sansEchange);
});

Deno.test('mock : séance de devoirs — écrans par 1re activité, consignes corrigée / ajoutée / retirée', async () => {
  const api = apiMock();
  const s = SESSIONS.find((x) => x.scenarioIdx === 1);
  const d = await api.detail('prod', s.id);
  assertEquals(d.ecrans.map((e) => e.position), [1, 5, 6, 2, 3, 4]);
  const debuts = d.ecrans.map((e) => e.premiereActiviteAt).filter(Boolean);
  assertEquals([...debuts].sort(), debuts);
  const parPosition = Object.fromEntries(d.consignes.map((c) => [c.position, c]));
  assert(parPosition[2].corrigee && parPosition[2].origine.includes('acordant'));
  assert(parPosition[5].retiree);
  assert(parPosition[6].ajoutee);
});

Deno.test('mock : photos_seance — ordre de prise, redressée après l’originale, purgée, dictée, vide, 404', async () => {
  const api = apiMock();
  const devoirs = SESSIONS.find((x) => x.scenarioIdx === 1);
  const r = await api.photosSeance('prod', devoirs.id);
  assertEquals(r.photos.map((p) => p.rang), r.photos.map((_, i) => i + 1));
  assertEquals(r.photos.map((p) => [p.redressee, p.purgee]), [[false, false], [true, false], [false, true]]);
  assertEquals(r.photos[0].interactionId, r.photos[1].interactionId);
  assertEquals(r.photos[2].url, null);

  const dictee = SESSIONS.find((x) => x.dictee);
  const rd = await api.photosSeance('prod', dictee.id);
  assert(rd.photos.some((p) => p.source === 'dictee' && p.dicteeId && !p.interactionId));

  const sans = SESSIONS.find((x) => x.scenarioIdx === 0);
  assertEquals((await api.photosSeance('prod', sans.id)).photos, []);
  assertEquals(await api.photosSeance('prod', 'inconnue'), null);
});
