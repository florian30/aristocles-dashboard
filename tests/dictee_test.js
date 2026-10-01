// Rubrique Dictée (DICT-12c) : adaptateurs des champs DICT-12 et
// tolérance à leur absence (Edge PROD pas encore à jour).
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { adapterApercu, adapterApercuDictees, adapterDictee, adapterEnfant, adapterJournee } from '../api.js';
import { creerApi } from '../api.js';
import { transportMock } from '../mock/transport.js';
import { etapeDictee, partDictee, resumeFautes, resumeJournal } from '../ui/dictee.js';
import { decalerJour, hierParis } from '../ui/paris.js';
import { APERCU, ENFANT, JOURNEE } from './contrat_v2_exemples.js';

// Forme brute d'une dictée du nouveau flux (contrat § 2.5, texte fictif).
const DICTEE_DICT12 = {
  id: 'd-1',
  session_id: 's-1',
  ecran_id: 'e-1',
  origine: 'entrainement',
  texte_reference: 'Le chat gris dort sur le muret.',
  classe: 'CE2',
  etape: 'fin',
  finie_at: '2026-07-10T17:32:00Z',
  mots_cibles: ['muret'],
  niveau_difficulte: 2,
  validation_status: 'valide',
  validation_tentatives: 1,
  ecarts_detectes: [],
  created_at: '2026-07-10T17:15:00Z',
  nb_fautes_comptees: 2,
  regles_revues: ['accord_gn', 'homophone_a'],
  evenements_par_type: { ouverture: 1, etape: 6, verdict: 2, reglee: 1, cloture: 1 },
};

// Même dictée telle que la rend l'Edge d'avant DICT-12.
const DICTEE_ANCIENNE = {
  id: 'd-0',
  session_id: 's-0',
  origine: 'entrainement',
  texte_reference: 'Un texte.',
  mots_cibles: null,
  niveau_difficulte: 1,
  validation_status: 'valide',
  validation_tentatives: 1,
  ecarts_detectes: 0,
  created_at: '2026-07-10T08:05:00Z',
};

Deno.test('adaptateur dictée : champs DICT-12 complets', () => {
  const d = adapterDictee(DICTEE_DICT12);
  assertEquals(d.classe, 'CE2');
  assertEquals(d.etape, 'fin');
  assertEquals(d.heure, '19:15');
  assertEquals(d.finieAt, '2026-07-10T17:32:00Z');
  assertEquals(d.nbFautes, 2);
  assertEquals(d.reglesRevues, ['accord_gn', 'homophone_a']);
  assertEquals(d.evenements, { ouverture: 1, etape: 6, verdict: 2, reglee: 1, cloture: 1 });
  assertEquals(etapeDictee(d), { label: 'Finie', cls: 'is-success' });
  assertEquals(resumeFautes(d), '2 fautes comptées · 1 réglée');
  assertEquals(resumeJournal(d), '1 ouverture · 6 étapes · 2 verdicts · 1 règlement · 1 clôture');
});

Deno.test('adaptateur dictée : champs DICT-12 absents → null, rien à afficher', () => {
  const d = adapterDictee(DICTEE_ANCIENNE);
  for (const k of ['classe', 'etape', 'finieAt', 'nbFautes', 'reglesRevues', 'evenements']) assertEquals(d[k], null, k);
  assertEquals(d.texte, 'Un texte.');
  assertEquals(etapeDictee(d), null);
  assertEquals(resumeFautes(d), null);
  assertEquals(resumeJournal(d), null);
});

Deno.test('adaptateur dictée : valeurs bancales filtrées', () => {
  const d = adapterDictee({
    ...DICTEE_DICT12,
    nb_fautes_comptees: 'deux',
    regles_revues: ['accord_gn', 3, null],
    evenements_par_type: { ouverture: 1, etape: 'x', inconnu: 2 },
  });
  assertEquals(d.nbFautes, null);
  assertEquals(d.reglesRevues, ['accord_gn']);
  assertEquals(d.evenements, { ouverture: 1, inconnu: 2 });
  assertEquals(resumeJournal(d), '1 ouverture · inconnu × 2');
  assertEquals(resumeJournal({ evenements: {} }), null);
  assertEquals(resumeJournal({ evenements: [] }), null);
});

Deno.test('étape de dictée : finie, à finir, non corrigée, échec, ancien flux', () => {
  const avec = (etape, classe = 'CM1') => etapeDictee({ etape, classe });
  assertEquals(avec('relecture'), { label: 'À finir', cls: 'is-info', note: 'étape : relecture' });
  assertEquals(avec('preparation').note, 'étape : préparation');
  assertEquals(avec('nouvelle_etape').note, 'étape : nouvelle_etape');
  assertEquals(avec('non_corrigee'), { label: 'Non corrigée', cls: 'is-fragile' });
  assertEquals(avec('echec'), { label: 'Échec', cls: 'is-failure' });
  assertEquals(avec('preparation', null), { label: 'Ancien flux', cls: 'is-muted' });
  assertEquals(resumeFautes({ nbFautes: 0, evenements: null }), 'Aucune faute comptée');
  assertEquals(resumeFautes({ nbFautes: 1, evenements: { reglee: 3 } }), '1 faute comptée · 3 réglées');
});

Deno.test('aperçu : rubrique Dictée et part des séances (exemple du contrat)', () => {
  const a = adapterApercu(APERCU);
  assertEquals(a.dictees, { lancees: 0, finies: 0, nonCorrigees: 0, echecsGeneration: 0, tauxEchecGeneration: null });
  assertEquals(partDictee(a.seances), { valeur: '0 %', note: '0 sur 2 séances' });
  assertEquals(partDictee({ total: 8, parMode: { dictee: 2 } }), { valeur: '25 %', note: '2 sur 8 séances' });
  assertEquals(partDictee({ total: 0, parMode: { dictee: 0 } }).valeur, '—');
  assertEquals(adapterApercuDictees({ lancees: 4, finies: 2, non_corrigees: 1, echecs_generation: 1, taux_echec_generation: 0.25 }),
    { lancees: 4, finies: 2, nonCorrigees: 1, echecsGeneration: 1, tauxEchecGeneration: 0.25 });
});

Deno.test('aperçu : Edge sans rubrique Dictée → rien, sans erreur', () => {
  const { dictees: _d, ...sansDictees } = APERCU;
  const a = adapterApercu({ ...sansDictees, seances: { total: 2, par_mode: { devoirs: 1, entrainement: 1 } } });
  assertEquals(a.dictees, null);
  assertEquals(partDictee(a.seances), null);
  assertEquals(adapterApercuDictees(undefined), null);
  assertEquals(adapterApercuDictees(null), null);
  assertEquals(adapterApercu({}).dictees, null);
});

Deno.test('journée et fiche enfant : dictées triées, champs absents tolérés', () => {
  const tard = { ...DICTEE_DICT12, id: 'tard', created_at: '2026-07-10T18:00:00Z' };
  const j = adapterJournee({ ...JOURNEE, enfants: [{ ...JOURNEE.enfants[0], dictees: [tard, DICTEE_ANCIENNE, DICTEE_DICT12] }] });
  assertEquals(j.enfants[0].dictees.map((d) => d.id), ['d-0', 'd-1', 'tard']);
  const e = adapterEnfant({ ...ENFANT, dictees: [DICTEE_ANCIENNE, tard, DICTEE_DICT12] });
  assertEquals(e.dictees.map((d) => d.id), ['tard', 'd-1', 'd-0']);
  assertEquals(adapterEnfant({ ...ENFANT, dictees: undefined }).dictees, []);
});

Deno.test('mock : dictées fictives sur les trois écrans', async () => {
  const api = creerApi({ transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }) });
  const hier = await api.journee('prod', hierParis());
  const dicteesHier = hier.enfants.flatMap((e) => e.dictees);
  assert(dicteesHier.some((d) => d.etape === 'fin' && d.nbFautes > 0 && d.reglesRevues.length));
  assert(dicteesHier.some((d) => d.etape === 'non_corrigee'));
  const to = decalerJour(hierParis(), 1);
  const a = await api.apercu('prod', decalerJour(to, -91), to);
  assert(a.dictees.lancees >= 5);
  assert(a.dictees.finies >= 2 && a.dictees.nonCorrigees >= 1 && a.dictees.echecsGeneration >= 1);
  assert(a.dictees.tauxEchecGeneration > 0);
  assert(a.seances.parMode.dictee >= 5);
  const enfant = await api.enfant('prod', 'c1', decalerJour(to, -91), to);
  assert(enfant.dictees.length >= 2);
});
