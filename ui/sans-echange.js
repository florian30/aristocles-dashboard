/* ============================================================
   Aristocles — Séances sans échange (lot SÉANCES)
   L'Edge les écarte par défaut et renvoie leur nombre
   (`seances_sans_echange`). La query `sans_echange=1` du hash les
   fait afficher : le choix suit les liens et survit au rechargement.
   Un nombre null (Edge pas à jour) n'affiche rien.
   ============================================================ */

import { construireHash } from '../router.js';
import { el, lien } from './dom.js';

export const avecSansEchange = (route) => route.query?.sans_echange === '1';

const nSeances = (nb) => nb + ' séance' + (nb > 1 ? 's' : '') + ' sans échange';

// Bandeau « N séances sans échange masquées · Afficher » (ou « · Masquer »).
export function bandeauSansEchange(route, nb) {
  if (typeof nb !== 'number' || nb === 0) return null;
  const affichees = avecSansEchange(route);
  const query = { ...route.query };
  if (affichees) delete query.sans_echange;
  else query.sans_echange = '1';
  const bandeau = el('p', 'bandeau-sans-echange');
  bandeau.append(
    el('span', null, nSeances(nb) + (affichees ? (nb > 1 ? ' affichées' : ' affichée') : (nb > 1 ? ' masquées' : ' masquée')) + ' · '),
    lien(construireHash({ ...route, query }), 'lien-sans-echange', affichees ? 'Masquer' : 'Afficher'),
  );
  return bandeau;
}

// Simple mention (Vue d'ensemble, Familles) : elles ne sont pas comptées.
export function mentionSansEchange(nb) {
  if (typeof nb !== 'number' || nb === 0) return null;
  return el('p', 'mention-sans-echange', nSeances(nb) + ' non comptée' + (nb > 1 ? 's' : '') + ' (aucun échange avec Ari).');
}

export const puceSansEchange = () => el('span', 'chip is-muted chip-sans-echange', 'sans échange');
