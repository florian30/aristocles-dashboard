/* ============================================================
   La veille — page d'accueil (contenu au lot 4).
   Le socle pose la route datée et la navigation jour par jour.
   ============================================================ */

import { construireHash } from '../router.js';
import { el, etatAVenir, lien } from '../ui/dom.js';
import { fmtJourLong, isoJoursAvant } from '../ui/format.js';

export const titre = 'La veille';

function decaler(date, jours) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + jours);
  return isoJoursAvant(0, d);
}

export async function rendre({ route }) {
  const vue = el('div', 'vue vue-veille');
  const tete = el('div', 'page-head');
  tete.append(el('h1', 'page-title', titre), el('span', 'page-count', fmtJourLong(route.date)));

  const jours = el('div', 'day-nav');
  jours.append(lien(construireHash({ ...route, date: decaler(route.date, -1) }), 'day-nav-link', '← Jour précédent'));
  if (route.date < isoJoursAvant(1)) {
    jours.append(lien(construireHash({ ...route, date: decaler(route.date, 1) }), 'day-nav-link', 'Jour suivant →'));
  }
  tete.append(jours);

  vue.append(tete, etatAVenir('Le résumé de la journée',
    'Ce qui s’est passé ce jour-là : séances, familles actives, signaux à regarder, santé et coûts. ' +
    'En attendant, la Vue d’ensemble et les Séances sont disponibles.', 'lot 4'));
  return vue;
}
