import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { adapterVeille, ApiError, creerApi } from '../api.js';
import { transportMock } from '../mock/transport.js';
import { analyserHash, construireHash } from '../router.js';
import { fmtEuros } from '../ui/format.js';
import {
  FAMILLES, famillesSignalees, filtrerLignes, fmtCompte, libelleCode, libelleFonction, porteUnCout,
  queryDeSelection, resumeJours, selectionDepuisQuery,
} from '../ui/incidents.js';
import { aujourdhuiParis, hierParis } from '../ui/paris.js';
import { VEILLE } from './contrat_veille_exemples.js';

Deno.test('adaptateur veille : exemple du contrat', () => {
  const v = adapterVeille(structuredClone(VEILLE));
  assertEquals([v.aujourdhui, v.jours, v.premierJour, v.niveau], ['2026-10-07', 2, '2026-10-06', 'rouge']);
  assertEquals(v.familles[0], {
    famille: 'F1', libelle: "Un enfant n'a pas eu ce qu'il demandait", niveau: 'rouge', nb: 2,
    joursRouges: 1, joursOrange: 0, dernierJourSignale: '2026-10-06', seuil: { orange: null, rouge: 'dès 1' },
  });
  assertEquals(v.familles[1].dernierJourSignale, null);
  assertEquals(v.serie.map((p) => [p.jour, p.partiel, p.niveau]), [['2026-10-06', false, 'rouge'], ['2026-10-07', true, 'vert']]);
  assertEquals(v.serie[0].familles.F1, { niveau: 'rouge', nb: 2, motifs: ['2 ce jour (seuil : 1)'] });
  assertEquals(v.lignes[0], {
    jour: '2026-10-06', famille: 'F1', fonction: 'app', role: null, modele: null, code: 'tour_erreur', nb: 2, nbTotal: null,
    p50: null, p95: null, eur: null, premierAt: '2026-10-06T07:12:00Z', dernierAt: '2026-10-06T16:40:00Z',
  });
  assertEquals([v.lignes[1].nbTotal, v.lignes[1].p95, v.lignes[1].eur], [80, 6000, 0.4]);
});

Deno.test('adaptateur veille : tolérant, familles remises dans l’ordre F1 → F8, coût null jamais 0', () => {
  const v = adapterVeille({
    familles: [{ famille: 'F8', niveau: 'orange' }, { famille: 'F2', niveau: 'bizarre' }],
    serie: [{ jour: '2026-10-07', cout_eur: null, familles: { F1: {} } }],
    lignes: [{ jour: '2026-10-07', famille: 'mesure', code: 'appels', cout_eur: null }],
  });
  assertEquals(v.familles.map((f) => [f.famille, f.niveau]), [['F2', 'vert'], ['F8', 'orange']]);
  assertEquals(v.serie[0].eur, null);
  assertEquals(v.serie[0].familles.F1, { niveau: 'vert', nb: 0, motifs: [] });
  assertEquals(v.lignes[0].eur, null);
  assertEquals(fmtEuros(v.lignes[0].eur), 'inconnu');
  assertEquals(adapterVeille({}).familles, []);
});

Deno.test('incidents : fenêtre et sélection lues dans le hash', () => {
  assertEquals(selectionDepuisQuery({}), { jours: 14, famille: null, jour: null });
  assertEquals(selectionDepuisQuery({ jours: '30', famille: 'F2', jour: '2026-10-06' }), { jours: 30, famille: 'F2', jour: '2026-10-06' });
  for (const jours of ['15', '7.0', 'abc', '0', '93']) assertEquals(selectionDepuisQuery({ jours }).jours, 14, jours);
  assertEquals(selectionDepuisQuery({ famille: 'F9', jour: 'hier' }), { jours: 14, famille: null, jour: null });
  assertEquals(selectionDepuisQuery({ jour: '2026-09-01' }, ['2026-10-06', '2026-10-07']).jour, null); // hors fenêtre
  assertEquals(queryDeSelection({ jours: 14, famille: null, jour: null }), {});
  assertEquals(queryDeSelection({ jours: 92, famille: 'F1', jour: '2026-10-06' }), { jours: '92', famille: 'F1', jour: '2026-10-06' });
});

Deno.test('routeur : #/{env}/incidents?jours=…', () => {
  assertEquals(analyserHash('#/prod/incidents?jours=7'), { env: 'prod', vue: 'incidents', query: { jours: '7' }, canonique: true });
  assertEquals(analyserHash('#/dev/incidents/truc').canonique, false);
  assertEquals(construireHash({ env: 'dev', vue: 'incidents', query: { jours: '30', famille: 'F2' } }), '#/dev/incidents?jours=30&famille=F2');
  // La veille des enfants garde sa route.
  assertEquals(analyserHash('#/prod/veille/2026-10-06').vue, 'veille');
});

Deno.test('incidents : filtrage des lignes pour creuser', () => {
  const l = (jour, famille, code, nb = 1) => ({ jour, famille, code, nb });
  const lignes = [
    l('2026-10-05', 'F2', 'content_filter', 4), l('2026-10-06', 'F1', 'tour_erreur', 2), l('2026-10-06', 'F2', 'delai_depasse'),
    l('2026-10-06', 'info', 'relance_reussie'), l('2026-10-06', 'mesure', 'appels', 0), l('2026-10-05', 'mesure', 'appels', 0),
  ];
  assertEquals(filtrerLignes(lignes, {}), { signaux: [], contexte: [] });
  const f2 = filtrerLignes(lignes, { famille: 'F2' });
  assertEquals(f2.signaux.map((x) => x.jour), ['2026-10-06', '2026-10-05']); // récents d'abord
  assertEquals(f2.contexte, []);
  const jour = filtrerLignes(lignes, { jour: '2026-10-06' });
  assertEquals(jour.signaux.map((x) => x.famille), ['F1', 'F2']);
  assertEquals(jour.contexte.map((x) => x.famille), ['info', 'mesure']);
  assertEquals(filtrerLignes(lignes, { jour: '2026-10-06', famille: 'F1' }).signaux.length, 1);
  // F5 / F6 / F7 : le détail est dans les mesures du jour.
  assertEquals(filtrerLignes(lignes, { jour: '2026-10-06', famille: 'F5' }).contexte.map((x) => x.code), ['appels']);
});

Deno.test('incidents : libellés produit, code brut gardé, code inconnu affiché tel quel', () => {
  assertEquals(libelleCode('content_filter'), { libelle: 'Le fournisseur a refusé le contenu (filtre)', brut: 'content_filter' });
  assertEquals(libelleCode('erreur_client:dictee/TimeoutException').libelle, 'Plantage de l’app — dictee · TimeoutException');
  assertEquals(libelleCode('tour_anomalie:silence_long').libelle, 'Anomalie pendant un tour (silence_long)');
  assertEquals(libelleCode('tour_anomalie:echec_llm').libelle, 'Tour sans réponse de l’IA');
  assertEquals(libelleCode('code_futur'), { libelle: 'code_futur', brut: null });
  assertEquals(libelleFonction('cron:purge-photos'), 'Automate « purge-photos »');
  assertEquals(libelleFonction('llm'), 'IA');
  assertEquals([porteUnCout({ code: 'appels' }), porteUnCout({ code: 'tour_erreur' })], [true, false]);
  assertEquals([fmtCompte(3, null), fmtCompte(2, 80)], ['3', '2 sur 80']);
  assertEquals(resumeJours({ joursRouges: 2, joursOrange: 1 }), '2 jours rouges · 1 jour orange');
  assertEquals(resumeJours({ joursRouges: 0, joursOrange: 0 }), '');
});

const apiMock = () => creerApi({ transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }) });

Deno.test('api : veille envoie { jours } entier, mis en cache par fenêtre', async () => {
  const vus = [];
  const api = creerApi({ transport: async (_env, action, params) => { vus.push([action, params]); return {}; } });
  await api.veille('prod', 14);
  await api.veille('prod', 14);
  await api.veille('prod', 92);
  assertEquals(vus, [['veille', { jours: 14 }], ['veille', { jours: 92 }]]);
});

Deno.test('mock veille : hier rouge « recopie refusée », aujourd’hui partiel, 8 familles', async () => {
  const v = await apiMock().veille('prod', 14);
  assertEquals(v.familles.map((f) => f.famille), FAMILLES);
  assertEquals(v.serie.length, 14);
  assertEquals([v.premierJour, v.aujourdhui], [v.serie[0].jour, aujourdhuiParis()]);
  const dernier = v.serie[v.serie.length - 1];
  assert(dernier.partiel && v.serie.slice(0, -1).every((p) => !p.partiel));
  const hier = v.serie.find((p) => p.jour === hierParis());
  assertEquals(hier.niveau, 'rouge');
  assertEquals(famillesSignalees(hier).map((x) => x.famille), ['F1', 'F2', 'F3']);
  const refus = filtrerLignes(v.lignes, { jour: hier.jour, famille: 'F2' }).signaux;
  assertEquals(refus.map((x) => [x.code, x.role, x.nb]), [['content_filter', 'vision_devoirs', 4]]);
  assert(v.familles.find((f) => f.famille === 'F2').dernierJourSignale === hier.jour);
  assert(v.lignes.some((l) => l.code === 'appels' && l.eur == null)); // coût inconnu
  assert(v.lignes.every((l) => !('child_id' in l) && !('session_id' in l)));
});

Deno.test('mock veille : 92 jours, refus hors 1..92 comme l’Edge', async () => {
  const v = await apiMock().veille('dev', 92);
  assertEquals(v.serie.length, 92);
  assert(v.familles.some((f) => f.niveau === 'orange') && v.familles.some((f) => f.joursRouges > 1));
  const transport = transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 });
  for (const jours of [0, 93, '7', 2.5]) {
    const e = await assertRejects(() => transport('prod', 'veille', { jours }), ApiError);
    assertEquals([e.status, e.message], [400, "'jours' must be an integer between 1 and 92"]);
  }
  assertEquals((await transport('prod', 'veille', {})).jours, 14);
});
