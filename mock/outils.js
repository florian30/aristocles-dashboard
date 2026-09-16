/* Outils communs aux actions mock. */

// params.from / params.to : bornes ISO (voir api.js paramsPlage).
export function dansPlage(session, params = {}) {
  if (params.from && session.startedAt < params.from) return false;
  if (params.to && session.startedAt > params.to) return false;
  return true;
}

export function nbExercices(session) {
  return session.ecrans.reduce((acc, e) => acc + e.exercices.length, 0);
}
