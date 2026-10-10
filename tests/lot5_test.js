import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import {
  adapterDetail,
  adapterEnfant,
  adapterEnfants,
  adapterJournee,
  adapterPhoto,
  adapterTour,
  ApiError,
  creerApi,
  etatErreurPhoto,
  trierParActivite,
} from '../api.js';
import { transportMock } from '../mock/transport.js';
import { analyserHash } from '../router.js';
import { periodeDepuisQuery } from '../ui/periode.js';
import { ENFANT, ENFANTS, JOURNEE, PHOTO, PHOTO_PURGEE, SESSION_DETAIL, TOUR, TOUR_SANS_TRACE } from './contrat_v2_exemples.js';

// ---------- Adaptateurs sur les exemples du contrat ----------

Deno.test('adaptateur enfants : exemple du contrat, tri par dernière activité', () => {
  const r = adapterEnfants(structuredClone(ENFANTS));
  assertEquals(r.enfants.map((e) => e.prenom), ['Ali', 'Zoé']); // 22:30Z après 17:00Z
  assertEquals(r.enfants[1], {
    childId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    prenom: 'Zoé',
    classe: 'CM1',
    genre: 'fille',
    createdAt: '2026-06-01T10:00:00Z',
    parentId: '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a',
    parentEmail: 'parent.a@example.org',
    derniereActivite: '2026-07-10T17:00:00Z',
    seances: 1,
    notionsAcquises: 1,
  });
  assertEquals(adapterEnfants({}).enfants, []);
});

Deno.test('tri familles : sans activité en dernier, puis par prénom', () => {
  const tri = trierParActivite([
    { prenom: 'Zoé', derniereActivite: null },
    { prenom: 'Ali', derniereActivite: null },
    { prenom: 'Léa', derniereActivite: '2026-07-01T10:00:00Z' },
    { prenom: 'Tom', derniereActivite: '2026-07-02T10:00:00.5Z' },
  ]);
  assertEquals(tri.map((e) => e.prenom), ['Tom', 'Léa', 'Ali', 'Zoé']);
});

Deno.test('adaptateur enfant : exemple du contrat', () => {
  const f = adapterEnfant(structuredClone(ENFANT));
  assertEquals(f.identite.parentEmail, 'parent.a@example.org');
  assertEquals([f.seances[0].heure, f.seances[0].nbEcrans], ['19:00', 2]); // heure de Paris
  assertEquals(f.maitrise[0], { conceptId: 'fractions-simples', notion: 'Les fractions simples', maitrise: 'acquise', vuEnClasse: 'presume_vu', majAt: '2026-07-10T17:10:00Z' });
  assertEquals(f.notionsAcquises, 1);
  assertEquals(f.devoirs[0].titre, 'Fractions p. 42');
  assertEquals(f.bilans[0].luAt, null); // non lu
  assertEquals(f.bilans[0].contenu, { resume: 'Bonne séance.' });
  assertEquals(f.conversationsParent[0].messages, [{ role: 'user', contenu: 'Comment ça s\'est passé ?' }]);
  assertEquals(f.memoire.interetsPersonnels, ['chats']);
  assertEquals(f.memoire.niveauDictee, 'facile');
  assertEquals(f.ecrans, [{ ecran: 'accueil', nb: 1, dureeMs: 15000 }]);
  assertEquals(f.versions[0].build, 101);
  assertEquals(f.photos.map((p) => p.interactionId), ['1c1c1c1c-1c1c-4c1c-8c1c-1c1c1c1c1c1c', '1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b']);
  assert(!JSON.stringify(f.photos).includes('url'));
  assertEquals(adapterEnfant({ ...structuredClone(ENFANT), memory_profile: null }).memoire, null);
});

Deno.test('adaptateur session_detail enrichi : exemple du contrat', () => {
  const d = adapterDetail(structuredClone(SESSION_DETAIL));
  assertEquals(d.endedAt, '2026-07-10T17:19:00Z');
  assertEquals(d.cloture, { soldeeAt: '2026-07-10T17:19:05Z', motif: 'menage_complet' });
  assertEquals(d.homework, { id: '4a4a4a4a-4a4a-4a4a-8a4a-4a4a4a4a4a4a', sessionId: '11111111-1111-1111-1111-111111111111', pourLe: '2026-07-11', matiere: 'maths', titre: 'Fractions p. 42', nbConsignes: 3 });
  const [e1, e2] = d.ecrans;
  assertEquals(e1.id, 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1');
  assertEquals(e1.interactions.map((i) => [i.position, i.locuteur, i.aPhoto]), [[1, 'enfant', true], [2, 'ari', false], [3, 'enfant', true]]);
  assertEquals(e1.interactions[1], {
    id: '1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a',
    position: 2,
    type: 'message_tuteur',
    locuteur: 'ari',
    texte: 'Comment tu ferais pour partager 20 en 4 ?',
    createdAt: '2026-07-10T17:05:00Z',
    generationId: '9e9e9e9e-9e9e-4e9e-8e9e-9e9e9e9e9e9e',
    modele: 'openai/gpt-5.6-luna',
    aPhoto: false,
    metadata: null,
  });
  assertEquals([e1.dictee, e2.interactions, e1.pouce], [null, [], 'haut']);
  assertEquals(d.evenements[0].detail, { tour: 1 });
  // v1 sans interactions : tolérant.
  const v1 = structuredClone(SESSION_DETAIL);
  for (const e of v1.ecrans) { delete e.interactions; delete e.dictee; }
  delete v1.homework;
  const r = adapterDetail(v1);
  assertEquals([r.homework, r.ecrans[0].interactions, r.ecrans[0].dictee], [null, [], null]);
});

Deno.test('adaptateur session_detail : dictée d’un écran et tri des interactions', () => {
  const d = structuredClone(SESSION_DETAIL);
  d.ecrans[0].interactions.reverse();
  d.ecrans[1].dictee = { id: 'dic-1', ecran_id: 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', origine: 'entrainement', texte_reference: 'Le chat dort.', mots_cibles: ['chat'], niveau_difficulte: 'facile', validation_status: 'valide', validation_tentatives: 1, ecarts_detectes: [], created_at: '2026-07-10T17:15:00Z' };
  const r = adapterDetail(d);
  assertEquals(r.ecrans[0].interactions.map((i) => i.position), [1, 2, 3]);
  assertEquals(r.ecrans[1].dictee, { id: 'dic-1', sessionId: null, origine: 'entrainement', texte: 'Le chat dort.', motsCibles: ['chat'], niveau: 'facile', validation: 'valide', tentatives: 1, ecarts: [],
    // Edge sans les champs DICT-12 : tout à null, rien d'inventé.
    classe: null, etape: null, creeAt: '2026-07-10T17:15:00Z', heure: '19:15', finieAt: null, nbFautes: null, reglesRevues: null, evenements: null });
});

Deno.test('adaptateur tour : avec trace, coût connu', () => {
  const t = adapterTour(structuredClone(TOUR));
  assertEquals(t.generation.role, 'tutor');
  assertEquals([t.generation.modele, t.generation.promptVersion, t.generation.latenceMs, t.generation.volumeEntree, t.generation.volumeSortie, t.generation.eur, t.generation.succes], ['openai/gpt-5.6-luna', 40, 1400, 900, 150, 0.012, true]);
  assertEquals(t.trace.requete.nb_photos, 1);
  assertEquals(t.trace.reponse.servi.reply, 'Comment tu ferais ?');
  assertEquals(t.promptSysteme.texte, 'Tu es Ari, un robot tuteur…');
  assertEquals(t.promptSysteme.sha256, 'abc123');
});

Deno.test('adaptateur tour : sans trace, coût inconnu jamais 0', () => {
  const t = adapterTour(structuredClone(TOUR_SANS_TRACE));
  assertEquals([t.trace, t.promptSysteme], [null, null]);
  assertEquals(t.generation.eur, null);
  assertEquals(t.generation.role, 'vision-parser');
  assertEquals(t.generation.metadata, null);
});

Deno.test('adaptateur photo et erreurs : purgée = état normal', () => {
  assertEquals(adapterPhoto(structuredClone(PHOTO)), {
    url: 'https://fake.supabase.co/storage/v1/object/sign/devoirs/signed-token-130',
    expireLe: '2026-07-12T08:05:00.000Z',
    nomFichier: 'devoir_2026-07-10_1b1b1b1b.jpg',
  });
  assertEquals(etatErreurPhoto(new ApiError(PHOTO_PURGEE.error, 404)), { code: 'purgee', message: 'Photo effacée (purge automatique)' });
  assertEquals(etatErreurPhoto(new ApiError('Unknown interaction_id', 404)).code, 'erreur');
  assertEquals(etatErreurPhoto(new ApiError('Internal server error', 500)).code, 'erreur');
  assertEquals(etatErreurPhoto(new ApiError('x', 0)).message, 'Téléchargement impossible, réessayez.');
});

// ---------- Client API ----------

Deno.test('api : photo jamais mise en cache, 404 propagé', async () => {
  const vus = [];
  const api = creerApi({
    transport: async (_env, action, params) => {
      vus.push([action, params]);
      if (params.interaction_id === 'purgee') throw new ApiError('photo_purgee', 404);
      return structuredClone(PHOTO);
    },
  });
  await api.photo('prod', 'i1');
  const p = await api.photo('prod', 'i1');
  assertEquals(vus, [['photo', { interaction_id: 'i1' }], ['photo', { interaction_id: 'i1' }]]);
  assertEquals(p.nomFichier, 'devoir_2026-07-10_1b1b1b1b.jpg');
  const e = await assertRejects(() => api.photo('prod', 'purgee'), ApiError);
  assertEquals([e.status, e.message], [404, 'photo_purgee']);
});

Deno.test('api : paramètres enfants / enfant / tour ; 404 → null', async () => {
  const vus = [];
  const api = creerApi({
    transport: async (_env, action, params) => {
      vus.push([action, params]);
      if (params.child_id === 'inconnu' || params.llm_generation_id === 'inconnu') throw new ApiError('x', 404);
      return action === 'tour' ? structuredClone(TOUR) : action === 'enfant' ? structuredClone(ENFANT) : structuredClone(ENFANTS);
    },
  });
  await api.enfants('prod');
  await api.enfant('prod', 'c1', '2026-07-10', '2026-07-11');
  await api.tour('dev', 'g1');
  assertEquals(vus, [
    ['enfants', {}],
    ['enfant', { child_id: 'c1', from: '2026-07-09T22:00:00.000Z', to: '2026-07-11T21:59:59.999Z' }],
    ['tour', { llm_generation_id: 'g1' }],
  ]);
  assertEquals(await api.enfant('prod', 'inconnu'), null);
  assertEquals(await api.tour('prod', 'inconnu'), null);
});

// ---------- Réserves du lot 4 ----------

const JOUR_VIDE = () => ({ date: '2026-07-11', enfants: [], technique: { ia: { appels: 0, echecs: 0, cout_total_eur: 0, appels_cout_inconnu: 0, par_role: [] }, echecs_ia: [], versions: [], incidents: { par_type: ['tour_erreur', 'tour_anomalie', 'filet_echec_llm', 'ecriture_echec'].map((type) => ({ type, nb: 0 })), recents: [] }, erreurs_client: [], ouvertures_app: 0 } });

Deno.test('réserve 7a : incidents seuls ou échecs IA seuls ≠ « Aucune activité »', () => {
  assertEquals(adapterJournee(JOUR_VIDE()).estVide, true);

  const incidents = JOUR_VIDE();
  incidents.technique.incidents.par_type[0].nb = 1;
  incidents.technique.incidents.recents = [structuredClone(JOURNEE.technique.incidents.recents[0] || { session_id: 's', type: 'tour_erreur', ecran_type: 'exercice', client_ts: '2026-07-11T08:00:00Z', detail: null })];
  assertEquals(adapterJournee(incidents).estVide, false);

  const compteSeul = JOUR_VIDE();
  compteSeul.technique.incidents.par_type[3].nb = 2;
  assertEquals(adapterJournee(compteSeul).estVide, false);

  const echecs = JOUR_VIDE();
  echecs.technique.echecs_ia = [{ llm_generation_id: 'g', child_id: 'c', role: 'tutor', modele: 'm', erreur: 'OpenRouter 502', created_at: '2026-07-11T08:00:00Z' }];
  assertEquals(adapterJournee(echecs).estVide, false);

  const echecsCompte = JOUR_VIDE();
  echecsCompte.technique.ia.echecs = 1;
  assertEquals(adapterJournee(echecsCompte).estVide, false);
});

Deno.test('réserve 7b : date inexistante dans l’URL → rejetée (retour à hier)', () => {
  for (const hash of ['#/prod/veille/2026-02-30', '#/prod/veille/2026-13-01', '#/dev/veille/2025-02-29', '#/prod/veille/2026-04-31']) {
    const r = analyserHash(hash);
    assertEquals([r.vue, r.date, r.canonique], ['veille', null, false], hash); // main.js réécrit vers hier
  }
  assertEquals(analyserHash('#/prod/veille/2028-02-29').date, '2028-02-29');
  assertEquals(analyserHash('#/prod/veille/2026-02-28').canonique, true);
});

Deno.test('période : défaut 92 jours pour la fiche enfant', () => {
  const maintenant = new Date('2026-09-16T10:00:00Z');
  assertEquals(periodeDepuisQuery({}, maintenant, { defaut: '92j' }), { cle: '92j', from: '2026-06-17', to: '2026-09-16', jours: 92, plafonnee: false });
  assertEquals(periodeDepuisQuery({}, maintenant).cle, '7j');
  assertEquals(periodeDepuisQuery({ periode: '30j' }, maintenant, { defaut: '92j' }).cle, '30j');
});

// ---------- Parcours en mode démo ----------

const apiMock = () => creerApi({ transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }) });

Deno.test('mock : Familles → fiche → séance tour par tour → trace IA → photo', async () => {
  const api = apiMock();
  const { enfants } = await api.enfants('prod');
  assert(enfants.length >= 8);
  assert(enfants[0].derniereActivite >= enfants[1].derniereActivite);
  assertEquals(enfants.at(-1).derniereActivite, null); // inscrit jamais venu, en dernier
  assert(enfants.some((e) => e.parentEmail === null));

  const mael = enfants.find((e) => e.prenom === 'Maël');
  const fiche = await api.enfant('prod', mael.childId, '2026-01-01', '2026-01-01');
  assertEquals(fiche.seances, []); // période sans séance
  const toute = await api.enfant('prod', mael.childId);
  assert(toute.identite.parentEmail.includes('@'));
  assert(toute.photos.length >= 2 && toute.bilans.some((b) => b.luAt === null) && toute.conversationsParent.length > 0);
  assert(toute.memoire && toute.devoirs.length > 0 && toute.versions.length > 0 && toute.ecrans.length > 0);
  assertEquals(await api.enfant('prod', 'inconnu'), null);

  const seance = await api.detail('prod', toute.photos[0].sessionId);
  assert(seance.homework);
  const tours = seance.ecrans.flatMap((e) => e.interactions);
  assert(tours.length >= 10);
  assert(seance.ecrans.some((e) => e.interactions.length >= 10)); // un fil d'une dizaine de tours
  const photos = tours.filter((i) => i.aPhoto);
  assertEquals(photos.length, 2);

  const ok = await api.photo('prod', photos[0].id);
  assert(ok.url.startsWith('data:image/svg+xml') && ok.nomFichier.startsWith('devoir_'));
  const purgee = await assertRejects(() => api.photo('prod', photos[1].id), ApiError);
  assertEquals(etatErreurPhoto(purgee).code, 'purgee');
  assertEquals(etatErreurPhoto(await assertRejects(() => api.photo('prod', 'inconnue'), ApiError)).code, 'erreur');

  const ari = tours.find((i) => i.locuteur === 'ari' && i.generationId);
  const tour = await api.tour('prod', ari.generationId);
  assert(tour.trace && tour.promptSysteme.texte.length > 100);
  assertEquals(tour.trace.reponse.servi.reply, ari.texte);
  assertEquals(await api.tour('prod', 'gen-inconnu'), null);
});

Deno.test('mock : trace purgée sur une séance d’au moins 7 jours, dictée d’hier relue', async () => {
  const api = apiMock();
  const { seances: liste } = await api.sessions('prod', null, null, 'all');
  let purgee = null;
  for (const s of liste) {
    const d = await api.detail('prod', s.id);
    const ari = d.ecrans.flatMap((e) => e.interactions).find((i) => i.generationId);
    if (!ari) continue;
    const t = await api.tour('prod', ari.generationId);
    if (!t.trace) { purgee = t; break; }
  }
  assert(purgee, 'au moins un tour sans trace');
  assertEquals(purgee.promptSysteme, null);
  const dictees = [];
  for (const s of liste) dictees.push(...(await api.detail('prod', s.id)).ecrans.filter((e) => e.dictee).map((e) => e.dictee));
  // Une dictée de l'ancien flux (classe null) + six passages du nouveau flux.
  assertEquals(dictees.length, 7);
  assertEquals(dictees.filter((d) => d.classe == null).length, 1);
});
