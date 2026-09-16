/* Mock de l'action `session_detail` — forme brute de l'Edge (§ 2.3),
   mot à mot, devoir et dictée compris (mock/fil.js).
   Renvoie undefined pour une séance inconnue (→ 404 côté transport). */

import { ACQUISITIONS, CHILDREN, SESSIONS } from './donnees.js';
import { devoirBrut, dicteeBrute, ecranId, interactionsEcran } from './fil.js';

export function session_detail(params) {
  const s = SESSIONS.find((x) => x.id === params.session_id);
  if (!s) return undefined;
  const enfant = CHILDREN.find((c) => c.id === s.childId);
  const fin = s.durationMin == null ? null : new Date(Date.parse(s.startedAt) + s.durationMin * 60000).toISOString();
  const dictee = dicteeBrute(s);
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
    ecrans: s.ecrans.map((e) => ({
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
      interactions: interactionsEcran(s, e.position),
      dictee: dictee && dictee.ecran_id === ecranId(s, e.position)
        ? (({ session_id: _s, ...reste }) => reste)(dictee)
        : null,
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
