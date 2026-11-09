/* ============================================================
   Aristocles — Interrupteur « Comptes de test internes »
   (lot DASH-TRIS-INTERNES). Désactivé par défaut : l'Edge écarte
   les données des comptes parent marqués internes. Activé, la query
   `internes=1` du hash fait passer `avec_internes: true` aux actions
   d'usage. Le choix suit toute la navigation (main.js le reporte sur
   chaque route sans `internes`) ; le couper pose `internes=0`, que
   main.js retire aussitôt. Une Edge d'avant le paramètre l'ignore.
   ============================================================ */

import { construireHash } from '../router.js';
import { el, lien } from './dom.js';

export const avecInternes = (route) => route.query?.internes === '1';

// Route à afficher selon le hash et l'état d'avant (pur, testé) :
// { actif, reecrire } — `reecrire` est la route à substituer (replace),
// ou null si le hash est déjà le bon.
export function etatInternes(route, actifAvant) {
  const valeur = route.query?.internes;
  if (valeur === '1') return { actif: true, reecrire: null };
  if (valeur == null && !actifAvant) return { actif: false, reecrire: null };
  if (valeur == null) return { actif: true, reecrire: { ...route, query: { ...route.query, internes: '1' } } };
  // `internes=0` (coupure) ou valeur inconnue : retour au défaut, hash nettoyé.
  const { internes: _i, ...query } = route.query;
  return { actif: false, reecrire: { ...route, query } };
}

// Query d'un lien de section : seul l'interrupteur suit.
export const queryDeSection = (actif) => (actif ? { internes: '1' } : {});

export function interrupteurInternes(route) {
  const actif = avecInternes(route);
  const a = lien(construireHash({ ...route, query: { ...route.query, internes: actif ? '0' : '1' } }),
    'interrupteur' + (actif ? ' is-on' : ''));
  a.setAttribute('role', 'switch');
  a.setAttribute('aria-checked', String(actif));
  a.title = actif ? 'Données des comptes de test internes affichées' : 'Données des comptes de test internes masquées';
  a.append(el('span', 'interrupteur-piste'), el('span', 'interrupteur-libelle', 'Comptes de test internes'));
  return a;
}
