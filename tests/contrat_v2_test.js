import { assert, assertEquals } from 'jsr:@std/assert@1';
import { adapterApercu, adapterJournee, adapterSante, creerApi } from '../api.js';
import { transportMock } from '../mock/transport.js';
import { decalerJour, hierParis } from '../ui/paris.js';
import { coutAffiche } from '../ui/unites.js';
import { APERCU, JOURNEE, SANTE } from './contrat_v2_exemples.js';

Deno.test('adaptateur journee : exemple du contrat', () => {
  const j = adapterJournee(structuredClone(JOURNEE));
  assertEquals(j.date, '2026-07-10');
  const zoe = j.enfants[0];
  assertEquals([zoe.prenom, zoe.classe, zoe.ouvertures], ['Zoé', 'CM1', 1]);
  const s = zoe.seances[0];
  assertEquals([s.heure, s.heureFin, s.dureeSec, s.nbEcrans], ['19:00', '19:19', 1140, 2]); // heure de Paris
  assertEquals(s.exercices, { nb: 1, succes: 1, fragile: 0, autres: 0 });
  assertEquals(s.pouces, { haut: 1, bas: 1 });
  assertEquals(s.cloture, { soldeeAt: '2026-07-10T17:19:05Z', motif: 'menage_complet' });
  assertEquals(zoe.devoirs[0], { id: '4a4a4a4a-4a4a-4a4a-8a4a-4a4a4a4a4a4a', sessionId: '11111111-1111-1111-1111-111111111111', pourLe: '2026-07-11', matiere: 'maths', titre: 'Fractions p. 42', nbConsignes: 3 });
  assertEquals(zoe.ecrans, [{ ecran: 'accueil', nb: 1, dureeMs: 15000 }]);
  assertEquals(j.resume, { enfantsActifs: 1, seances: 1, seancesEnCours: 0, minutes: 19, exercices: 1, exercicesReussis: 1, ouvertures: 1, erreurs: 0, incidents: 0, echecsIa: 0 });
  const vision = j.technique.ia.parRole[1];
  assertEquals([vision.role, vision.eur, vision.appelsCoutInconnu, vision.p50, vision.volumeEntree], ['vision-parser', null, 1, 6000, 6000]);
  assertEquals(coutAffiche(j.technique.ia).note, 'dont 1 appel au coût inconnu');
  assertEquals(j.technique.incidents.parType.length, 4);
  assertEquals(j.estVide, false);
});

Deno.test('adaptateur journee : jour vide', () => {
  const j = adapterJournee({ date: '2026-07-11', enfants: [], technique: { ia: { appels: 0, echecs: 0, cout_total_eur: 0, appels_cout_inconnu: 0, par_role: [] }, echecs_ia: [], versions: [], incidents: { par_type: [], recents: [] }, erreurs_client: [], ouvertures_app: 0 } });
  assertEquals(j.estVide, true);
  assertEquals(j.resume.seances, 0);
  assertEquals(adapterJournee({ date: '2026-07-11' }).estVide, true); // tolérant aux blocs absents
});

Deno.test('adaptateur apercu : exemple du contrat', () => {
  const a = adapterApercu(structuredClone(APERCU));
  assertEquals([a.enfantsActifs, a.famillesActives, a.minutes, a.ouvertures], [2, 2, 19, 2]);
  assertEquals(a.seances, { total: 2, parMode: { devoirs: 1, entrainement: 1 } });
  assertEquals(a.entreesParMode, { apprentissage: 0, devoirs: 1, dictee: 1, autre: 0 });
  assertEquals(a.retention.j7, { eligibles: 1, revenus: 1, taux: 1 });
  assertEquals(a.serie[1], { jour: '2026-07-11', seances: 1, enfantsActifs: 1, minutes: 0, ouvertures: 1 });
  assertEquals(a.couts.parRole[1].eur, null);
  assertEquals(adapterApercu({ retention: { j7: { eligibles: 0, revenus: 0, taux: null } } }).retention.j7.taux, null);
});

Deno.test('adaptateur sante : exemple du contrat', () => {
  const s = adapterSante(structuredClone(SANTE));
  assertEquals(s.erreursClient[0], { type: 'TimeoutException', zone: 'tutor', ecran: 'session', version: '1.0.0', plateforme: 'android', nb: 1, derniere: '2026-07-10T22:41:30Z', pile: 'a.dart:12' });
  assertEquals(s.versions.map((v) => [v.version, v.build, v.plateforme]), [['1.0.0', 101, 'ios'], ['1.0.0', 100, 'android']]);
  assertEquals([s.ia.appels, s.ia.echecs, s.ia.eur, s.ia.appelsCoutInconnu], [3, 1, 0.012, 1]);
  assertEquals(s.echecsIa[0].erreur, 'OpenRouter 502');
  assertEquals(s.incidents.recents[0], { sessionId: '22222222-2222-2222-2222-222222222222', type: 'tour_erreur', ecranType: 'exercice', ts: '2026-07-10T22:41:00Z', detail: { tour: 1, erreur: 'TimeoutException' } });
  assertEquals(s.quotas, { plafond: 300, auPlafond: [{ parentId: '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', jour: '2026-07-10', unites: 300 }] });
  assertEquals(adapterSante({}).quotas, null);
});

Deno.test('api : journee envoie la date, apercu/sante des bornes ISO de Paris', async () => {
  const vus = [];
  const api = creerApi({ transport: async (_env, action, params) => { vus.push([action, params]); return {}; } });
  await api.journee('prod', '2026-07-10');
  await api.apercu('prod', '2026-07-10', '2026-07-11');
  await api.sante('dev', '2026-01-10', '2026-01-10');
  assertEquals(vus, [
    ['journee', { date: '2026-07-10' }],
    ['apercu', { from: '2026-07-09T22:00:00.000Z', to: '2026-07-11T21:59:59.999Z' }],
    ['sante', { from: '2026-01-09T23:00:00.000Z', to: '2026-01-10T22:59:59.999Z' }],
  ]);
});

const apiMock = () => creerApi({ transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }) });

Deno.test('mock : la veille d’hier est riche, certains jours sont vides', async () => {
  const api = apiMock();
  const hier = await api.journee('prod', hierParis());
  assert(hier.enfants.length >= 2);
  assert(hier.resume.seances > 0 && hier.resume.erreurs > 0);
  assert(hier.technique.ia.parRole.some((r) => r.eur == null));
  assert(hier.technique.ia.parRole.some((r) => r.unite === 'seconde'));
  const detail = await api.detail('prod', hier.enfants.flatMap((e) => e.seances)[0].id);
  assert(detail !== null); // clic séance → lecteur
  const vides = [];
  for (let i = 2; i < 14; i++) if ((await api.journee('prod', decalerJour(hierParis(), -i))).estVide) vides.push(i);
  assert(vides.length > 0);
});

Deno.test('mock : apercu et sante sur 92 jours', async () => {
  const api = apiMock();
  const to = decalerJour(hierParis(), 1);
  const from = decalerJour(to, -91);
  const a = await api.apercu('prod', from, to);
  assertEquals(a.serie.length, 92);
  assert(a.seances.total > 0 && a.entreesParMode.dictee > 0);
  const s = await api.sante('prod', from, to);
  assert(s.erreursClient.length > 0 && s.erreursClient.every((e) => e.pile));
  assertEquals(s.incidents.parType.length, 4);
  assert(s.ia.appelsCoutInconnu > 0);
});
