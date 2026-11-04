// DEROULE-COMPLET : le déroulé d'une séance, tour par tour (contrat v2.10).
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { adapterDetail } from '../api.js';
import { adapterTourDeroule, lignesDeroule, placerDeroule, resumeDeroule, tourParlant } from '../ui/deroule.js';
import { SESSION_DETAIL } from './contrat_v2_exemples.js';

const BRUT = {
  tour: 3,
  debut_at: '2026-07-10T17:06:00Z',
  origine: 'ptt',
  type_trigger: null,
  etape: { type: 'lecon', etape: 'apres_quiz' },
  boutons: [{ id: 'refaire_quiz', libelle: 'Refaire un quiz' }],
  outils: ['regarder_consigne', 'preparer_quizz_lecon'],
  outils_refuses: [{ outil: 'terminer_seance_devoir', raison: 'hors_regime', type: 'outil_ignore' }],
  interaction_ids: ['a1', 'a2'],
};

Deno.test('déroulé : adaptateur, forme du front', () => {
  assertEquals(adapterTourDeroule(BRUT), {
    tour: 3,
    debutAt: '2026-07-10T17:06:00Z',
    origine: 'ptt',
    typeTrigger: null,
    etape: { type: 'lecon', etape: 'apres_quiz' },
    boutons: [{ id: 'refaire_quiz', libelle: 'Refaire un quiz' }],
    outils: ['regarder_consigne', 'preparer_quizz_lecon'],
    outilsRefuses: [{ outil: 'terminer_seance_devoir', raison: 'hors_regime', type: 'outil_ignore' }],
    interactionIds: ['a1', 'a2'],
  });
});

Deno.test('déroulé : outils absents → « non tracé », liste vide → « aucun »', () => {
  const nonTrace = adapterTourDeroule({ ...BRUT, outils: null, outils_refuses: [] });
  const aucun = adapterTourDeroule({ ...BRUT, outils: [], outils_refuses: [] });
  const ligne = (t) => lignesDeroule(t).find(([l]) => l === 'Outils appelés')[1];
  assertEquals(nonTrace.outils, null);
  assertEquals(ligne(nonTrace), 'non tracé');
  assertEquals(ligne(aucun), 'aucun');
});

Deno.test('déroulé : lignes et résumé', () => {
  const t = adapterTourDeroule(BRUT);
  assertEquals(lignesDeroule(t), [
    ['Étape', 'apres_quiz (lecon)'],
    ['Bouton touché', '« Refaire un quiz »'],
    ['Outils appelés', 'regarder_consigne, preparer_quizz_lecon'],
    ['Outil refusé', 'terminer_seance_devoir — hors du mode Devoirs'],
  ]);
  assertEquals(resumeDeroule(t), 'Déroulé · tour 3 · apres_quiz · 1 bouton · 2 outils · 1 refusé');
  // Bouton sans libellé : son id ; déclencheur nommé sur un tour trigger.
  const t2 = adapterTourDeroule({ ...BRUT, origine: 'trigger', type_trigger: 'correction', boutons: [{ id: 'x', libelle: null }] });
  assert(lignesDeroule(t2).some(([l, v]) => l === 'Bouton touché' && v === 'x'));
  assert(lignesDeroule(t2).some(([l, v]) => l === 'Déclencheur' && v === 'correction'));
  assertEquals(resumeDeroule(adapterTourDeroule({ ...BRUT, tour: null })).startsWith('Déroulé · hors tour'), true);
});

Deno.test('déroulé : placement dans le fil', () => {
  const avecMessage = adapterTourDeroule(BRUT);
  const sansMessage = adapterTourDeroule({ ...BRUT, tour: 4, interaction_ids: [], debut_at: '2026-07-10T17:07:00Z' });
  const muet = adapterTourDeroule({ tour: 5, debut_at: '2026-07-10T17:08:00Z', boutons: [], outils: [], outils_refuses: [], interaction_ids: [] });
  assertEquals(tourParlant(muet), false);
  const { parInteraction, extras } = placerDeroule([avecMessage, sansMessage, muet]);
  assertEquals([...parInteraction.keys()], ['a1']);
  assertEquals(parInteraction.get('a1').tour, 3);
  assertEquals(extras, [{ createdAt: '2026-07-10T17:07:00Z', deroule: sansMessage }]);
});

Deno.test('déroulé : exemple du contrat, et tolérance sans bloc', () => {
  const d = adapterDetail(structuredClone(SESSION_DETAIL));
  assertEquals(d.deroule.map((t) => [t.tour, t.outils, t.interactionIds]), [[1, [], ['1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a']]]);
  const v = structuredClone(SESSION_DETAIL);
  delete v.deroule;
  assertEquals(adapterDetail(v).deroule, []);
});
