/* Mock de l'action `stats` — forme brute de l'Edge. */

import { CHILDREN, SESSIONS } from './donnees.js';
import { dansPlage, nbExercices } from './outils.js';

// Bloc coûts IA statique (non filtré par la plage), dans la forme du
// contrat v2 : stt en secondes, tts en caractères, un rôle au coût
// inconnu (cout_eur null) et le décompte des appels concernés.
const LLM = {
  cout_total_eur: 3.6021,
  appels: 1204,
  appels_cout_inconnu: 21,
  tokens_input: 1675500,
  tokens_output: 231300,
  volumes_hors_tokens: [
    { unite: 'caractere', total: 182400, appels: 402 },
    { unite: 'seconde', total: 3725, appels: 390 },
  ],
  par_role: [
    { role: 'tutor', unite: 'token', cout_eur: 2.1074, appels: 236, tokens_input: 1204500, tokens_output: 148200 },
    { role: 'synthese_ecran', unite: 'token', cout_eur: 0.7842, appels: 118, tokens_input: 402600, tokens_output: 61800 },
    { role: 'bilan_session', unite: 'token', cout_eur: 0.3411, appels: 37, tokens_input: 68400, tokens_output: 21300 },
    { role: 'tts', unite: 'caractere', cout_eur: 0.2736, appels: 402, tokens_input: 182400, tokens_output: 0 },
    { role: 'stt', unite: 'seconde', cout_eur: 0.0958, appels: 390, tokens_input: 3725, tokens_output: 0 },
    { role: 'vision_devoirs', unite: 'token', cout_eur: null, appels: 21, appels_cout_inconnu: 21, tokens_input: 0, tokens_output: 0 },
  ],
};

export function stats(params) {
  const retenues = SESSIONS.filter((s) => dansPlage(s, params));
  const children = CHILDREN.map((c) => {
    const miennes = retenues.filter((s) => s.childId === c.id);
    return {
      child_id: c.id,
      first_name: c.name,
      sessions: miennes.length,
      exercises: miennes.reduce((acc, s) => acc + nbExercices(s), 0),
      total_seconds: miennes.reduce((acc, s) => acc + (s.durationMin || 0) * 60, 0),
    };
  }).filter((c) => c.sessions > 0); // comme l'Edge : enfants actifs seulement
  return {
    active_children: children.length,
    sessions: retenues.length,
    exercises: retenues.reduce((acc, s) => acc + nbExercices(s), 0),
    total_seconds: retenues.reduce((acc, s) => acc + (s.durationMin || 0) * 60, 0),
    children,
    llm: structuredClone(LLM),
  };
}
