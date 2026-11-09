/* Outils communs aux actions mock. */

import { CHILDREN } from './donnees.js';

// params.from / params.to : bornes ISO (voir api.js paramsPlage).
export function dansPlage(session, params = {}) {
  if (params.from && session.startedAt < params.from) return false;
  if (params.to && session.startedAt > params.to) return false;
  return true;
}

export function nbExercices(session) {
  return session.ecrans.reduce((acc, e) => acc + e.exercices.length, 0);
}

// Lot SÉANCES (contrat § 1.9) : les séances sans échange sont écartées
// sauf `avec_sans_echange: true` ; le compte vaut dans les deux cas.
export function ecarteSansEchange(liste, params = {}, seance = (x) => x) {
  const nb = liste.filter((x) => seance(x).sansEchange === true).length;
  const seances = params.avec_sans_echange === true ? liste : liste.filter((x) => seance(x).sansEchange !== true);
  return { seances, nb };
}

// Lot DASH-TRIS-INTERNES : ce qui appartient à un compte de test interne
// est écarté sauf `avec_internes: true`.
const INTERNES = new Set(CHILDREN.filter((c) => c.interne).map((c) => c.id));
export const estInterne = (childId) => INTERNES.has(childId);
export function ecarteInternes(liste, params = {}, childId = (x) => x.childId) {
  return params.avec_internes === true ? liste : liste.filter((x) => !estInterne(childId(x)));
}
