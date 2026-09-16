/* Mock de l'action `session` (liste) — forme brute de l'Edge. */

import { CHILDREN, SESSIONS } from './donnees.js';
import { dansPlage, nbExercices } from './outils.js';

export function session(params) {
  const prenom = Object.fromEntries(CHILDREN.map((c) => [c.id, c.name]));
  const sessions = SESSIONS
    .filter((s) => dansPlage(s, params))
    .filter((s) => !params.child_id || s.childId === params.child_id)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((s) => ({
      id: s.id,
      child_id: s.childId,
      first_name: prenom[s.childId],
      mode: s.mode,
      status: s.status,
      theme_libelle: s.theme,
      started_at: s.startedAt,
      duration_seconds: s.durationMin == null ? null : s.durationMin * 60,
      exercises: nbExercices(s),
    }));
  return { sessions };
}
