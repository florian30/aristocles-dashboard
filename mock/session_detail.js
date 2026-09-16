/* Mock de l'action `session_detail` — forme brute de l'Edge.
   Renvoie undefined pour une séance inconnue (→ 404 côté transport). */

import { ACQUISITIONS, CHILDREN, SESSIONS } from './donnees.js';

export function session_detail(params) {
  const s = SESSIONS.find((x) => x.id === params.session_id);
  if (!s) return undefined;
  const enfant = CHILDREN.find((c) => c.id === s.childId);
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
    },
    resume_seance: s.resume,
    ecrans: s.ecrans.map((e) => ({
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
    })),
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
  };
}
