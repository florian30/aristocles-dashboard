// Voix de l'enfant dans le mot à mot (STOCKAGE-AUDIO-STT lot 2, contrat
// v2.9 § 2.16) : adaptateur, jamais en cache, répartition par tour,
// légende, mock. Données factices.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { adapterVoixSeance, creerApi } from '../api.js';
import { SESSIONS } from '../mock/donnees.js';
import { interactionsEcran } from '../mock/fil.js';
import { transportMock } from '../mock/transport.js';
import { legendePrise, repartirVoix } from '../ui/voix.js';

const apiMock = () => creerApi({
  transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }),
});

// Exemple recopié du contrat v2.9 § 2.16 (produit par le code de l'Edge).
const EXEMPLE = {
  session_id: '11111111-1111-4111-8111-111111111111',
  validite_s: 3600,
  expire_le: '2026-12-20T10:00:00.000Z',
  prises: [
    { rang: 1, interaction_id: '70000000-0000-4000-8000-000000000001', filtre: 'aucun', transcription: 'Sept fois huit', duree_s: 2.4, prise_le: '2026-12-19T17:00:07.000Z', etat: 'ok', url: 'https://fake.supabase.co/storage/v1/object/sign/voix-stt/lot-81' },
    { rang: 2, interaction_id: null, filtre: 'silence', transcription: '', duree_s: 0.8, prise_le: '2026-12-19T17:02:00.000Z', etat: 'ok', url: 'https://fake.supabase.co/storage/v1/object/sign/voix-stt/lot-81' },
    { rang: 3, interaction_id: '70000000-0000-4000-8000-000000000004', filtre: 'aucun', transcription: 'cinquante-six', duree_s: 1.9, prise_le: '2026-12-19T17:04:02.000Z', etat: 'purgee', url: null },
  ],
  tours_effaces: [],
};

Deno.test('voix_seance : adaptateur — exemple du contrat, purgée sans url, champs absents', () => {
  const v = adapterVoixSeance(EXEMPLE);
  assertEquals([v.sessionId, v.validiteS, v.expireLe], [EXEMPLE.session_id, 3600, EXEMPLE.expire_le]);
  assertEquals(v.prises.map((p) => [p.rang, p.interactionId, p.filtre, p.purgee, p.url === null]), [
    [1, '70000000-0000-4000-8000-000000000001', 'aucun', false, false],
    [2, null, 'silence', false, false],
    [3, '70000000-0000-4000-8000-000000000004', 'aucun', true, true],
  ]);
  assertEquals(v.prises[0].dureeS, 2.4);
  // Une prise « ok » sans url est traitée comme purgée ; formes vides tolérées.
  const w = adapterVoixSeance({ prises: [{ etat: 'ok', url: null }], tours_effaces: ['t', 3] });
  assertEquals([w.prises[0].purgee, w.prises[0].filtre, w.prises[0].transcription], [true, 'aucun', '']);
  assertEquals(w.toursEffaces, ['t']);
  assertEquals(adapterVoixSeance({}).prises, []);
});

Deno.test('api : voixSeance jamais en cache ; 404 → null ; autre erreur propagée', async () => {
  let appels = 0;
  const api = creerApi({
    transport: async (_env, action, params) => {
      assertEquals(action, 'voix_seance');
      appels++;
      if (params.session_id === 'inconnue') throw Object.assign(new Error('Introuvable'), { status: 404 });
      if (params.session_id === 'panne') throw Object.assign(new Error('Internal server error'), { status: 500 });
      return EXEMPLE;
    },
  });
  await api.voixSeance('prod', 's');
  await api.voixSeance('prod', 's');
  assertEquals(appels, 2);
  assertEquals(await api.voixSeance('prod', 'inconnue'), null);
  let leve = false;
  try { await api.voixSeance('prod', 'panne'); } catch (e) { leve = e.status === 500; }
  assert(leve);
});

Deno.test('voix : répartition — lecteur, effacé (purgée ou ligne partie), autres prises, tour inconnu', () => {
  const lot = adapterVoixSeance({
    prises: [
      { rang: 1, interaction_id: 'a', etat: 'ok', url: 'u1', transcription: 'oui' },
      { rang: 2, interaction_id: null, filtre: 'amorce', etat: 'ok', url: 'u2' },
      { rang: 3, interaction_id: 'b', etat: 'purgee', url: null, transcription: 'non' },
      // Rattachée à un tour qui n'est pas dans le fil : à part.
      { rang: 4, interaction_id: 'hors-fil', etat: 'ok', url: 'u4', transcription: 'peut-être' },
    ],
    tours_effaces: ['c', 'hors-fil-2'],
  });
  const { parInteraction, autres } = repartirVoix(lot, ['a', 'b', 'c', 'd']);
  assertEquals(parInteraction.get('a').etat, 'ok');
  assertEquals(parInteraction.get('a').prise.url, 'u1');
  assertEquals(parInteraction.get('b').etat, 'effacee');
  assertEquals(parInteraction.get('c'), { etat: 'effacee', prise: null });
  // Tour vocal sans prise et récent : rien (pas d'« effacé » inventé).
  assertEquals(parInteraction.has('d'), false);
  assertEquals(autres.map((p) => p.rang), [2, 4]);
});

Deno.test('voix : légende — filtre, durée à la française, heure de Paris', () => {
  const [p] = adapterVoixSeance({ prises: [{ filtre: 'silence', duree_s: 0.8, prise_le: '2026-12-19T17:02:00Z', etat: 'ok', url: 'u' }] }).prises;
  assertEquals(legendePrise(p), 'silence · 0,8 s · 18:02');
  const [q] = adapterVoixSeance({ prises: [{ filtre: 'aucun', duree_s: null, etat: 'ok', url: 'u' }] }).prises;
  assertEquals(legendePrise(q), '');
});

Deno.test('mock : voix_seance — chaque tour vocal servi, 1re purgée, dernière effacée, silence à part, 404', async () => {
  const api = apiMock();
  const s = SESSIONS.find((x) => x.ecrans.flatMap((e) => interactionsEcran(x, e.position)).filter((i) => i.type === 'message_enfant_vocal').length >= 3);
  assert(s, 'une séance factice avec au moins trois tours vocaux');
  const vocaux = s.ecrans.flatMap((e) => interactionsEcran(s, e.position)).filter((i) => i.type === 'message_enfant_vocal').map((i) => i.id);
  const r = await api.voixSeance('prod', s.id);
  assertEquals(r.prises.map((p) => p.rang), r.prises.map((_, i) => i + 1));
  const debuts = r.prises.map((p) => p.priseLe);
  assertEquals([...debuts].sort(), debuts);
  const { parInteraction, autres } = repartirVoix(r, vocaux);
  assertEquals(vocaux.filter((id) => !parInteraction.has(id)), []);
  assertEquals(vocaux.map((id) => parInteraction.get(id).etat).filter((e) => e === 'effacee').length, 2);
  assertEquals(autres.map((p) => p.filtre), ['silence']);
  assert(r.prises.every((p) => p.purgee || p.url.startsWith('data:audio/wav;base64,')));
  assertEquals(await api.voixSeance('prod', 'inconnue'), null);
});
