// DASH-REPONSES-UI (lot 46) : ce que l'enfant a répondu à chaque
// exercice et question de quizz (`ecrans[].reponses_exercices[]`,
// contrat-dashboard.md v2.14 § 2.3) — adaptateur, libellés, placement
// dans le fil, encart rendu sur un mini-DOM (présent, vide, absent,
// réponse non enregistrée). Données fabriquées, aucun prénom.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { adapterDetail, creerApi } from '../api.js';
import { transportMock } from '../mock/transport.js';
import { SESSIONS } from '../mock/donnees.js';
import {
  adapterReponsesExercices,
  derniersToursParEcran,
  encartReponse,
  libelleResultat,
  NON_ENREGISTREE,
  placerReponses,
  titreReponse,
} from '../ui/reponses.js';
import { filChronologique } from '../ui/fil-seance.js';

// Exemple du contrat v2.14 (exercice vérifié à l'écran).
const EXEMPLE_CONTRAT = {
  source: 'exercice', exercise_id: 'ex-1', numero_quizz: null, type_exercice: 'qcm', oral: false,
  enonce: "texte de l'énoncé présenté, ou null",
  presente_at: '2026-11-19T10:00:00Z', resolu_at: '2026-11-19T10:01:30Z',
  resultat: 'fragile', correct: false, nb_tentatives: 2, reponses_enregistrees: false,
  tentatives: [
    { numero: 1, at: null, reponse: null, canal: 'ecran', correcte: false },
    { numero: 2, at: '2026-11-19T10:01:30Z', reponse: null, canal: 'ecran', correcte: null },
  ],
  paroles_enfant: [{ at: '2026-11-19T10:00:40Z', texte: "je crois que c'est le b", canal: 'voix' }],
};
// Exercice à l'oral : les réponses sont les paroles de l'enfant.
const ORAL = {
  source: 'exercice', exercise_id: 'ex-2', numero_quizz: null, type_exercice: null, oral: true,
  enonce: 'Combien font 7 × 8 ?', presente_at: '2026-11-19T10:05:00Z', resolu_at: '2026-11-19T10:06:00Z',
  resultat: 'succes', correct: true, nb_tentatives: 2, reponses_enregistrees: true,
  tentatives: [
    { numero: 1, at: '2026-11-19T10:05:20Z', reponse: 'cinquante-quatre', canal: 'voix', correcte: null },
    { numero: 2, at: '2026-11-19T10:05:50Z', reponse: '56', canal: 'texte', correcte: true },
  ],
  paroles_enfant: [],
};
const QUIZZ = {
  source: 'quizz', exercise_id: null, numero_quizz: 2, type_exercice: null, oral: true, enonce: null,
  presente_at: null, resolu_at: '2026-11-19T10:09:00Z', resultat: 'pas_trouve', correct: false,
  nb_tentatives: 1, reponses_enregistrees: true,
  tentatives: [{ numero: 1, at: '2026-11-19T10:08:50Z', reponse: 'je sais pas', canal: 'voix', correcte: false }],
  paroles_enfant: [],
};

// Mini-DOM : assez pour el() et encartReponse (append, textContent, className).
function avecDom(f) {
  class Noeud {
    constructor(tag) { this.tag = tag; this.enfants = []; this.className = ''; this._texte = ''; }
    append(...n) { for (const x of n) this.enfants.push(typeof x === 'string' ? { textContent: x } : x); }
    set textContent(t) { this._texte = String(t); this.enfants = []; }
    get textContent() { return this._texte + this.enfants.map((e) => e.textContent).join(''); }
    get innerHTML() { throw new Error('innerHTML interdit'); }
  }
  const avant = globalThis.document;
  globalThis.document = { createElement: (tag) => new Noeud(tag) };
  try { return f(); } finally { globalThis.document = avant; }
}
const tous = (n, classe) => [
  ...(String(n.className).split(' ').includes(classe) ? [n] : []),
  ...(n.enfants || []).flatMap((e) => tous(e, classe)),
];

// Un écran brut minimal de session_detail.
const ecranBrut = (extra) => ({
  id: 'e-1', position: 1, type: 'exercice', exercices: [],
  interactions: [
    { id: 'i-1', position: 1, type: 'exercice_presente', locuteur: 'systeme', contenu_texte: 'Énoncé', created_at: '2026-11-19T10:00:00Z', metadata: { exercise_id: 'ex-1', type: 'qcm' } },
    { id: 'i-2', position: 2, type: 'message_enfant_vocal', locuteur: 'enfant', contenu_texte: "je crois que c'est le b", created_at: '2026-11-19T10:00:40Z' },
    { id: 'i-3', position: 3, type: 'exercice_resolu', locuteur: 'systeme', created_at: '2026-11-19T10:01:30Z', metadata: { exercise_id: 'ex-1', resultat: 'fragile' } },
    { id: 'i-4', position: 4, type: 'reponse_quizz', locuteur: 'systeme', created_at: '2026-11-19T10:09:00Z', metadata: { numero: 2, verdict: 'pas_trouve' } },
    { id: 'i-5', position: 5, type: 'message_tuteur', locuteur: 'ari', contenu_texte: 'Bravo pour tes efforts.', created_at: '2026-11-19T10:10:00Z' },
  ],
  ...extra,
});
const detailBrut = (ecran) => ({ session: { id: 's-1', child_id: 'c-1', first_name: 'X', mode: 'entrainement', started_at: '2026-11-19T09:59:00Z' }, ecrans: [ecran] });

Deno.test('réponses : adaptateur — exemple du contrat, absent ou mal formé → []', () => {
  const [r] = adapterReponsesExercices([EXEMPLE_CONTRAT]);
  assertEquals(r.source, 'exercice');
  assertEquals(r.exerciseId, 'ex-1');
  assertEquals(r.typeExercice, 'qcm');
  assertEquals(r.oral, false);
  assertEquals(r.nbTentatives, 2);
  assertEquals(r.reponsesEnregistrees, false);
  assertEquals(r.tentatives.map((t) => [t.numero, t.reponse, t.canal, t.correcte]), [[1, null, 'ecran', false], [2, null, 'ecran', null]]);
  assertEquals(r.parolesEnfant.length, 1);
  assertEquals(adapterReponsesExercices(undefined), []);
  assertEquals(adapterReponsesExercices(null), []);
  assertEquals(adapterReponsesExercices({}), []);
  assertEquals(adapterReponsesExercices([]), []);
  // reponses_enregistrees absent → faux (jamais une réponse inventée).
  assertEquals(adapterReponsesExercices([{ source: 'exercice' }])[0].reponsesEnregistrees, false);
});

Deno.test('réponses : session_detail — champ absent (Edge d’avant) ou vide → reponses []', () => {
  assertEquals(adapterDetail(detailBrut(ecranBrut())).ecrans[0].reponses, []);
  assertEquals(adapterDetail(detailBrut(ecranBrut({ reponses_exercices: [] }))).ecrans[0].reponses, []);
  assertEquals(adapterDetail(detailBrut(ecranBrut({ reponses_exercices: [EXEMPLE_CONTRAT] }))).ecrans[0].reponses.length, 1);
});

Deno.test('réponses : libellés en français simple', () => {
  const [ecran, oral, quizz] = adapterReponsesExercices([EXEMPLE_CONTRAT, ORAL, QUIZZ]);
  assertEquals(libelleResultat(oral).label, 'juste du premier coup');
  assertEquals(libelleResultat(ecran).label, 'juste après plusieurs essais, ou passé');
  assertEquals(libelleResultat({ ...ecran, nbTentatives: 1 }).label, 'passé');
  assertEquals(libelleResultat({ ...ecran, resultat: null }).label, 'pas terminé');
  assertEquals(libelleResultat(quizz).label, 'pas trouvé');
  assertEquals(libelleResultat({ ...quizz, resultat: 'juste' }).label, 'juste');
  assertEquals(titreReponse(ecran), 'Exercice · choix multiple · à l’écran');
  assertEquals(titreReponse(oral), 'Exercice · à l’oral');
  assertEquals(titreReponse(quizz), 'Quiz · question 2');
});

Deno.test('réponses : encart présent — énoncé, résultat, tentatives avec réponse et verdict', () => avecDom(() => {
  const [oral] = adapterReponsesExercices([ORAL]);
  const encart = encartReponse(oral);
  const texte = encart.textContent;
  assert(texte.includes('Combien font 7 × 8 ?'));
  assert(texte.includes('juste du premier coup'));
  const lignes = tous(encart, 'reponse-tentative').map((l) => l.textContent);
  assertEquals(lignes.length, 2);
  assert(lignes[0].startsWith('Essai 1'));
  assert(lignes[0].includes('« cinquante-quatre » (dit)'));
  assert(!lignes[0].includes('juste') && !lignes[0].includes('faux'), 'verdict seulement sur la dernière');
  assert(lignes[1].includes('« 56 » (tapé)'));
  assert(lignes[1].endsWith('juste'));
  assert(!texte.includes(NON_ENREGISTREE));
}));

Deno.test('réponses : encart d’un exercice vérifié à l’écran — réponse non enregistrée', () => avecDom(() => {
  const [ecran] = adapterReponsesExercices([EXEMPLE_CONTRAT]);
  const lignes = tous(encartReponse(ecran), 'reponse-tentative').map((l) => l.textContent);
  assertEquals(lignes.length, 2);
  for (const l of lignes) assert(l.includes(NON_ENREGISTREE));
  assert(lignes[0].endsWith('faux'));
  // Même avec reponses_enregistrees vrai, une réponse null n'est jamais inventée.
  const [trou] = adapterReponsesExercices([{ ...ORAL, tentatives: [{ numero: 1, at: null, reponse: null, canal: 'voix', correcte: true }] }]);
  assert(encartReponse(trou).textContent.includes(NON_ENREGISTREE));
}));

Deno.test('réponses : encart sans tentative — compteur seul, ou « aucun essai »', () => avecDom(() => {
  const [sansListe] = adapterReponsesExercices([{ ...EXEMPLE_CONTRAT, tentatives: [], nb_tentatives: 3 }]);
  assert(encartReponse(sansListe).textContent.includes('3 essais, ' + NON_ENREGISTREE));
  const [rien] = adapterReponsesExercices([{ ...EXEMPLE_CONTRAT, tentatives: [], nb_tentatives: null, resultat: null, correct: null }]);
  const t = encartReponse(rien).textContent;
  assert(t.includes('Aucun essai enregistré.'));
  assert(t.includes('pas terminé'));
}));

Deno.test('réponses : placement — après la résolution, après le verdict du quizz, sinon en fin d’écran', () => {
  const seance = adapterDetail(detailBrut(ecranBrut({
    reponses_exercices: [EXEMPLE_CONTRAT, QUIZZ, { ...ORAL, exercise_id: 'ex-inconnu' }],
  })));
  const { apres, finEcran } = placerReponses(seance.ecrans);
  assertEquals(apres.get('i-3').map((r) => r.exerciseId), ['ex-1']);
  assertEquals(apres.get('i-4').map((r) => r.numeroQuizz), [2]);
  assertEquals(finEcran.get(seance.ecrans[0]).map((r) => r.exerciseId), ['ex-inconnu']);
  // La fin d'écran = le dernier tour de l'écran dans le fil.
  const elements = filChronologique(seance.ecrans);
  const derniers = derniersToursParEcran(elements);
  assertEquals(elements[derniers.get(seance.ecrans[0])].interaction.id, 'i-5');
  // Non résolu : l'encart se pose après la présentation.
  const nonResolu = adapterDetail(detailBrut(ecranBrut({
    interactions: ecranBrut().interactions.filter((i) => i.type !== 'exercice_resolu'),
    reponses_exercices: [{ ...EXEMPLE_CONTRAT, resultat: null, resolu_at: null }],
  })));
  assertEquals(placerReponses(nonResolu.ecrans).apres.get('i-1').length, 1);
});

Deno.test('réponses : champ absent ou vide → rien à placer', () => {
  for (const extra of [{}, { reponses_exercices: [] }, { reponses_exercices: null }]) {
    const seance = adapterDetail(detailBrut(ecranBrut(extra)));
    const { apres, finEcran } = placerReponses(seance.ecrans);
    assertEquals(apres.size, 0);
    assertEquals(finEcran.size, 0);
  }
});

Deno.test('mock : session_detail rend reponses_exercices, à l’oral et à l’écran, chacun à sa place', async () => {
  const api = creerApi({ transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }) });
  let oral = 0, ecran = 0, quizz = 0, placees = 0, total = 0;
  for (const s of SESSIONS) {
    const d = await api.detail('prod', s.id);
    const { apres, finEcran } = placerReponses(d.ecrans);
    for (const e of d.ecrans) {
      for (const r of e.reponses) {
        total++;
        if (r.source === 'quizz') quizz++;
        else if (r.oral) oral++;
        else ecran++;
      }
    }
    placees += [...apres.values()].flat().length;
    assertEquals(finEcran.size, 0);
  }
  assert(oral > 0 && ecran > 0 && quizz > 0, `oral ${oral}, écran ${ecran}, quizz ${quizz}`);
  assertEquals(placees, total);
});
