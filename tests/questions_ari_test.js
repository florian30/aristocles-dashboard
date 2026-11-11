// Questions à Ari (GAMIF-L15, contrat v2.11 § 2.17) : adaptateur
// (exemple du contrat recopié), jamais en cache, jour du hash, état de
// la voix, rendu d'un échange sur un mini-DOM, mock. Données factices.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { adapterQuestionsAri, creerApi } from '../api.js';
import { questions_ari } from '../mock/questions_ari.js';
import { transportMock } from '../mock/transport.js';
import { decalerJour, hierParis } from '../ui/paris.js';
import {
  carteEchange, echangesDuJour, etatVoixQuestion, jourQuestions, messageErreurQuestions, TEXTE_SANS_REPONSE, TEXTE_VOIX_EFFACEE,
} from '../ui/questions-ari.js';

// Exemple recopié du contrat v2.11 § 2.17 (produit par le code de l'Edge).
const EXEMPLE = {
  child_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  from: '2026-12-18T23:00:00.000Z',
  to: '2026-12-19T23:00:00.000Z',
  validite_s: 3600,
  expire_le: '2026-12-20T10:00:00.000Z',
  nb_echanges: 5,
  jours: [{
    jour: '2026-12-19',
    echanges: [
      { id: '90000000-0000-4000-8000-000000000001', rang: 1, posee_le: '2026-12-19T17:00:05.000Z', question: '  Tu es un   robot ? ',
        reponse: 'Oui, je suis une IA.', prompt_version: '1',
        voix: { etat: 'ok', url: 'https://fake.supabase.co/storage/v1/object/sign/voix-stt/lot-72', duree_s: 2.4, prise_le: '2026-12-19T17:00:01.000Z' } },
      { id: '90000000-0000-4000-8000-000000000004', rang: 4, posee_le: '2026-12-19T17:04:00.000Z', question: "c'est quoi une étoile d'or",
        reponse: 'Deux tampons.', prompt_version: '1',
        voix: { etat: 'purgee', url: null, duree_s: 2.4, prise_le: '2026-12-19T17:03:58.000Z' } },
      { id: '90000000-0000-4000-8000-000000000005', rang: 5, posee_le: '2026-12-19T17:05:00.000Z', question: 'et les accessoires',
        reponse: 'Tu en gagnes…', prompt_version: '1', voix: null },
    ],
  }],
};

const MAINTENANT = new Date('2026-11-11T15:00:00Z');

Deno.test('questions_ari : adaptateur — exemple du contrat, trois états de voix, formes vides', () => {
  const q = adapterQuestionsAri(EXEMPLE);
  assertEquals([q.childId, q.validiteS, q.expireLe, q.nbEchanges], [EXEMPLE.child_id, 3600, EXEMPLE.expire_le, 5]);
  const e = echangesDuJour(q, '2026-12-19');
  assertEquals(e.map((x) => [x.rang, x.voix?.etat ?? null]), [[1, 'ok'], [4, 'effacee'], [5, null]]);
  assertEquals(e[0].voix, { etat: 'ok', url: EXEMPLE.jours[0].echanges[0].voix.url, dureeS: 2.4, priseLe: '2026-12-19T17:00:01.000Z' });
  assertEquals(e[1].voix.url, null);
  assertEquals(e.map((x) => etatVoixQuestion(x.voix)), ['ok', 'effacee', 'aucune']);
  // « ok » sans url = effacée ; réponse null gardée null ; formes vides tolérées.
  const w = adapterQuestionsAri({ jours: [{ jour: 'j', echanges: [{ question: 3, reponse: null, voix: { etat: 'ok', url: null } }] }] });
  assertEquals([w.jours[0].echanges[0].question, w.jours[0].echanges[0].reponse, w.jours[0].echanges[0].voix.etat], ['', null, 'effacee']);
  assertEquals(adapterQuestionsAri({}).jours, []);
  assertEquals(echangesDuJour(q, '2026-12-18'), []);
});

Deno.test('api : questionsAri jamais en cache, param date ; 404 → null ; autre erreur propagée', async () => {
  const vus = [];
  const api = creerApi({
    transport: async (_env, action, params) => {
      assertEquals(action, 'questions_ari');
      vus.push(params);
      if (params.child_id === 'inconnu') throw Object.assign(new Error('Unknown child_id'), { status: 404 });
      if (params.child_id === 'panne') throw Object.assign(new Error('Internal server error'), { status: 500 });
      return EXEMPLE;
    },
  });
  await api.questionsAri('prod', 'c', '2026-12-19');
  await api.questionsAri('prod', 'c', '2026-12-19');
  assertEquals(vus, [{ child_id: 'c', date: '2026-12-19' }, { child_id: 'c', date: '2026-12-19' }]);
  assertEquals(await api.questionsAri('prod', 'inconnu', '2026-12-19'), null);
  let leve = false;
  try { await api.questionsAri('prod', 'panne', '2026-12-19'); } catch (e) { leve = e.status === 500; }
  assert(leve);
});

Deno.test('questions_ari : jour du hash (hier par défaut, date invalide ou future → hier), messages d’erreur', () => {
  assertEquals(jourQuestions({}, MAINTENANT), '2026-11-10');
  assertEquals(jourQuestions({ qjour: '2026-10-01' }, MAINTENANT), '2026-10-01');
  assertEquals(jourQuestions({ qjour: '2026-11-11' }, MAINTENANT), '2026-11-11');
  assertEquals(jourQuestions({ qjour: '2026-02-30' }, MAINTENANT), '2026-11-10');
  assertEquals(jourQuestions({ qjour: '2026-11-12' }, MAINTENANT), '2026-11-10');
  assertEquals(messageErreurQuestions({ status: 400 }, 'dev'), 'Pas encore disponible sur dev (Edge à mettre à jour).');
  assertEquals(messageErreurQuestions({ status: 502 }, 'prod'), 'Impossible de charger les questions (erreur 502).');
});

// Mini-DOM : assez pour carteEchange (el, append, setAttribute, écouteurs).
function avecDom(f) {
  class Noeud {
    constructor(tag) { this.tag = tag; this.enfants = []; this.className = ''; this._texte = ''; this.attrs = {}; }
    append(...n) { for (const x of n) this.enfants.push(typeof x === 'string' ? { textContent: x } : x); }
    setAttribute(k, v) { this.attrs[k] = v; }
    addEventListener() {}
    set textContent(t) { this._texte = String(t); this.enfants = []; }
    get textContent() { return this._texte + this.enfants.map((e) => e.textContent).join(''); }
    get innerHTML() { throw new Error('innerHTML interdit'); }
    tous(tag) { return [...(this.tag === tag ? [this] : []), ...this.enfants.flatMap((e) => (e.tous ? e.tous(tag) : []))]; }
  }
  const avant = globalThis.document;
  globalThis.document = { createElement: (tag) => new Noeud(tag) };
  try { return f(); } finally { globalThis.document = avant; }
}

Deno.test('questions_ari : rendu — lecteur, voix effacée, rien sans prise, réponse absente', () => {
  const q = adapterQuestionsAri(EXEMPLE);
  const [avecVoix, effacee, sansVoix] = echangesDuJour(q, '2026-12-19');
  avecDom(() => {
    const a = carteEchange(avecVoix, 'Lina', () => {});
    assertEquals(a.tous('audio').map((x) => x.attrs.src), [avecVoix.voix.url]);
    assert(a.textContent.includes('Tu es un   robot ?'));
    assert(a.textContent.includes('Oui, je suis une IA.'));
    assert(a.textContent.includes('18:00')); // heure de Paris
    assert(!a.textContent.includes('http'));

    const b = carteEchange(effacee, 'Lina', () => {});
    assertEquals(b.tous('audio').length, 0);
    assert(b.textContent.includes(TEXTE_VOIX_EFFACEE));

    const c = carteEchange({ ...sansVoix, reponse: null }, 'Lina', () => {});
    assertEquals(c.tous('audio').length, 0);
    assert(!c.textContent.includes(TEXTE_VOIX_EFFACEE));
    assert(c.textContent.includes(TEXTE_SANS_REPONSE));
  });
});

Deno.test('mock : un échange avec voix, un à la voix effacée, un sans voix, un jour vide ; enfant inconnu → 404', async () => {
  const api = creerApi({ transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }) });
  const hier = hierParis();
  const lot = await api.questionsAri('prod', 'c1', hier);
  const e = echangesDuJour(lot, hier);
  assertEquals(e.map((x) => etatVoixQuestion(x.voix)), ['ok', 'effacee', 'aucune', 'ok']);
  assertEquals(e.map((x) => x.rang), [1, 2, 3, 4]);
  assertEquals(e[3].reponse, null);
  assertEquals(lot.nbEchanges, 4);
  assert(e[0].voix.url.startsWith('data:audio/wav;base64,'));

  const vide = await api.questionsAri('prod', 'c1', decalerJour(hier, 1));
  assertEquals([vide.nbEchanges, vide.jours], [0, []]);
  assertEquals((await api.questionsAri('prod', 'c2', hier)).jours, []);
  // Il y a 35 jours : ligne d'index purgée, voix effacée sans date de prise.
  const ancien = echangesDuJour(await api.questionsAri('prod', 'c1', decalerJour(hier, -35)), decalerJour(hier, -35));
  assertEquals(ancien.map((x) => [etatVoixQuestion(x.voix), x.voix.priseLe]), [['effacee', null]]);
  assertEquals(await api.questionsAri('prod', 'inconnu', hier), null);
  // Fenêtre lue = le jour civil de Paris demandé.
  const brut = questions_ari({ child_id: 'c1', date: '2026-12-19' });
  assertEquals([brut.from, brut.to], ['2026-12-18T23:00:00.000Z', '2026-12-19T23:00:00.000Z']);
});
