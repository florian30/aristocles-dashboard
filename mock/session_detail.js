/* Mock de l'action `session_detail` — forme brute de l'Edge (§ 2.3),
   mot à mot, devoir et dictée compris (mock/fil.js).
   Renvoie undefined pour une séance inconnue (→ 404 côté transport).
   Comme l'Edge (DASH-3), les écrans arrivent dans l'ordre de leur
   1re activité (`premiere_activite_at`, null en dernier, puis position). */

import { ACQUISITIONS, CHILDREN, SESSIONS } from './donnees.js';
import { devoirBrut, dicteeBrute, ecranId, interactionsEcran } from './fil.js';

export function session_detail(params) {
  const s = SESSIONS.find((x) => x.id === params.session_id);
  if (!s) return undefined;
  const enfant = CHILDREN.find((c) => c.id === s.childId);
  const fin = s.durationMin == null ? null : new Date(Date.parse(s.startedAt) + s.durationMin * 60000).toISOString();
  const dictee = dicteeBrute(s);
  const ecrans = s.ecrans.map((e) => ({ e, interactions: interactionsEcran(s, e.position) }));
  const deroule = derouleFactice(s, ecrans);
  return {
    session: {
      id: s.id,
      child_id: s.childId,
      first_name: enfant.name,
      classe: enfant.classe,
      mode: s.mode,
      status: s.status,
      theme_libelle: s.theme,
      notion_principale: s.notion,
      started_at: s.startedAt,
      duration_seconds: s.durationMin == null ? null : s.durationMin * 60,
      ended_at: fin,
      cloture: { soldee_at: fin ? new Date(Date.parse(fin) + 5000).toISOString() : null, motif: fin ? 'menage_complet' : null },
    },
    resume_seance: s.resume,
    homework: devoirBrut(s),
    ecrans: ecrans.map(({ e, interactions }) => ({
      id: ecranId(s, e.position),
      position: e.position,
      type: e.type,
      synthese_redigee: e.synthese,
      statut_fermeture: e.statutFermeture,
      pouce_enfant: e.pouce,
      exercices: e.exercices.map((x) => ({
        id: x.id,
        enonce: x.enonce,
        resultat: x.resultat,
        origine: x.origine,
        duree_secondes: x.dureeSec,
        notions: [...x.notions],
      })),
      premiere_activite_at: interactions.reduce((min, i) => (min && min <= i.created_at ? min : i.created_at), null),
      interactions,
      dictee: dictee && dictee.ecran_id === ecranId(s, e.position)
        ? (({ session_id: _s, ...reste }) => reste)(dictee)
        : null,
    })).sort(parPremiereActivite),
    acquisitions: (ACQUISITIONS[s.childId] || []).map((a) => ({
      notion: a.notion,
      statut_maitrise: a.maitrise,
      statut_vu_en_classe: a.vuEnClasse,
      derniere_mise_a_jour: a.majDate + 'T12:00:00Z',
    })),
    evenements: s.evenements.map((e) => ({
      seq: e.seq,
      type: e.type,
      client_ts: e.ts,
      ecran_type: e.ecranType,
      exercise_id: e.exerciseId,
      detail: structuredClone(e.detail),
    })),
    deroule,
  };
}

// DEROULE-COMPLET : un tour par message d'Ari (appel IA), annoté sur
// l'interaction (`tour`) ; en Devoirs, une étape, un bouton au 1er tour et
// un outil refusé au 2e — de quoi voir chaque ligne en mode démo.
function derouleFactice(s, ecrans) {
  const tours = [];
  for (const { interactions } of ecrans) {
    for (const i of interactions) {
      if (!i.llm_generation_id) continue;
      const n = tours.length + 1;
      i.tour = n;
      const devoirs = s.mode === 'devoirs';
      tours.push({
        tour: n,
        passage: 1,
        debut_at: i.created_at,
        origine: 'ptt',
        type_trigger: null,
        etape: devoirs ? { type: 'exercice', etape: 'conversation' } : null,
        boutons: devoirs && n === 1 ? [{ id: 'je_commence', libelle: 'Je commence' }] : [],
        outils: devoirs && n === 1 ? ['regarder_consigne'] : [],
        outils_refuses: devoirs && n === 2
          ? [{ outil: 'terminer_seance_devoir', raison: 'hors_regime', type: 'outil_ignore' }]
          : [],
        interaction_ids: [i.id],
      });
    }
  }
  return tours;
}

function parPremiereActivite(a, b) {
  if (a.premiere_activite_at === b.premiere_activite_at) return a.position - b.position;
  if (a.premiere_activite_at === null) return 1;
  if (b.premiere_activite_at === null) return -1;
  return a.premiere_activite_at.localeCompare(b.premiere_activite_at);
}
