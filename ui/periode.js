/* ============================================================
   Aristocles — Période des écrans Vue d'ensemble et Santé (pure)
   Actions `apercu` / `sante` : plage requise, plafonnée à 92 jours
   civils de Paris. Query du hash : `periode=7j|30j|92j`, ou
   `from` / `to` explicites. Défaut : 7 jours (aujourd'hui compris),
   ou le raccourci `defaut` choisi par l'écran (fiche enfant : 92 j).
   ============================================================ */

import { aujourdhuiParis, decalerJour, ecartJours, estDateCivile, PLAFOND_JOURS } from './paris.js';

export const RACCOURCIS_PERIODE = [
  { cle: '7j', libelle: '7 jours', jours: 7 },
  { cle: '30j', libelle: '30 jours', jours: 30 },
  { cle: '92j', libelle: '92 jours', jours: 92 },
];

// → { cle, from, to, jours, plafonnee }
export function periodeDepuisQuery(query = {}, maintenant = new Date(), { defaut = '7j' } = {}) {
  const aujourdhui = aujourdhuiParis(maintenant);
  let from = estDateCivile(query.from) ? query.from : null;
  let to = estDateCivile(query.to) ? query.to : null;

  if (from || to) {
    to = to || aujourdhui;
    from = from || decalerJour(to, -6);
    if (from > to) [from, to] = [to, from];
    let plafonnee = false;
    if (ecartJours(from, to) + 1 > PLAFOND_JOURS) {
      from = decalerJour(to, -(PLAFOND_JOURS - 1));
      plafonnee = true;
    }
    return { cle: 'perso', from, to, jours: ecartJours(from, to) + 1, plafonnee };
  }
  const r = RACCOURCIS_PERIODE.find((x) => x.cle === query.periode) ||
    RACCOURCIS_PERIODE.find((x) => x.cle === defaut) || RACCOURCIS_PERIODE[0];
  return { cle: r.cle, from: decalerJour(aujourdhui, -(r.jours - 1)), to: aujourdhui, jours: r.jours, plafonnee: false };
}
