/* ============================================================
   Aristocles — Plage de dates des écrans de liste (pure)
   Portée par la query du hash : `periode=hier|7j|30j|tout`, ou
   `from` / `to` explicites ('AAAA-MM-JJ'). Défaut : 7 jours.
   ============================================================ */

import { isoJoursAvant } from './format.js';

export const RACCOURCIS = [
  { cle: 'hier', libelle: 'Hier' },
  { cle: '7j', libelle: '7 jours' },
  { cle: '30j', libelle: '30 jours' },
  { cle: 'tout', libelle: 'Tout' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// → { cle, from, to } ; cle = 'perso' pour des dates explicites.
export function plageDepuisQuery(query = {}, maintenant = new Date()) {
  const from = DATE_RE.test(query.from || '') ? query.from : null;
  const to = DATE_RE.test(query.to || '') ? query.to : null;
  if (from || to) return { cle: 'perso', from, to };
  switch (query.periode) {
    case 'hier': return { cle: 'hier', from: isoJoursAvant(1, maintenant), to: isoJoursAvant(1, maintenant) };
    case '30j': return { cle: '30j', from: isoJoursAvant(29, maintenant), to: isoJoursAvant(0, maintenant) };
    case 'tout': return { cle: 'tout', from: null, to: null };
    default: return { cle: '7j', from: isoJoursAvant(6, maintenant), to: isoJoursAvant(0, maintenant) };
  }
}

// Query sans les clés de plage (pour en poser de nouvelles).
export function sansPlage(query = {}) {
  const { periode: _p, from: _f, to: _t, ...reste } = query;
  return reste;
}
