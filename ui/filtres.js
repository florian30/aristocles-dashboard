/* ============================================================
   Aristocles — Barre de filtres (plage de dates, enfant)
   Tout l'état vit dans la query du hash : chaque changement
   produit une navigation, un rafraîchissement le conserve.
   ============================================================ */

import { construireHash, naviguer } from '../router.js';
import { el, lien } from './dom.js';
import { aujourdhuiParis, fmtJourCourt } from './paris.js';
import { RACCOURCIS_PERIODE } from './periode.js';
import { plageDepuisQuery, RACCOURCIS, sansPlage } from './plage.js';

// enfants : [{ childId, name }] ou null (pas de sélecteur).
export function barreFiltres(route, { enfants = null } = {}) {
  const plage = plageDepuisQuery(route.query);
  const barre = el('div', 'toolbar');

  const raccourcis = el('div', 'range-shortcuts');
  for (const r of RACCOURCIS) {
    const query = { ...sansPlage(route.query), periode: r.cle };
    const a = lien(construireHash({ ...route, query }), r.cle === plage.cle ? 'is-active' : '', r.libelle);
    if (r.cle === plage.cle) a.setAttribute('aria-current', 'true');
    raccourcis.append(a);
  }
  barre.append(raccourcis);

  const dates = el('div', 'range-dates');
  const champ = (nom, valeur, libelle) => {
    const input = el('input');
    input.type = 'date';
    input.value = valeur || '';
    input.setAttribute('aria-label', libelle);
    input.addEventListener('change', () => {
      const query = { ...sansPlage(route.query), from: plage.from, to: plage.to, [nom]: input.value || null };
      // Plage vidée des deux côtés : « Tout ».
      if (!query.from && !query.to) query.periode = 'tout';
      naviguer({ ...route, query });
    });
    return input;
  };
  dates.append(champ('from', plage.from, 'Date de début'), el('span', null, '→'), champ('to', plage.to, 'Date de fin'));
  barre.append(dates);

  if (enfants) {
    const select = el('select');
    select.setAttribute('aria-label', 'Filtrer par enfant');
    const tous = el('option', null, 'Tous les enfants');
    tous.value = '';
    select.append(tous);
    for (const e of enfants) {
      const option = el('option', null, e.name);
      option.value = e.childId;
      select.append(option);
    }
    select.value = route.query.child || '';
    select.addEventListener('change', () => {
      naviguer({ ...route, query: { ...route.query, child: select.value || null } });
    });
    barre.append(select);
  }
  return barre;
}

// Barre de période des écrans `apercu` / `sante` : 7 j, 30 j, 92 j ou
// dates choisies (plafonnées à 92 jours, avec un message si c'est le cas).
// periode : résultat de periodeDepuisQuery.
export function barrePeriode(route, periode) {
  const barre = el('div', 'toolbar');

  const raccourcis = el('div', 'range-shortcuts');
  for (const r of RACCOURCIS_PERIODE) {
    const actif = r.cle === periode.cle;
    const a = lien(construireHash({ ...route, query: { ...sansPlage(route.query), periode: r.cle } }), actif ? 'is-active' : '', r.libelle);
    if (actif) a.setAttribute('aria-current', 'true');
    raccourcis.append(a);
  }
  const perso = el('span', 'range-perso' + (periode.cle === 'perso' ? ' is-active' : ''), 'Personnalisé');
  raccourcis.append(perso);
  barre.append(raccourcis);

  const dates = el('div', 'range-dates');
  const champ = (nom, valeur, libelle) => {
    const input = el('input');
    input.type = 'date';
    input.value = valeur;
    input.max = aujourdhuiParis();
    input.setAttribute('aria-label', libelle);
    input.addEventListener('change', () => {
      if (!input.value) return;
      naviguer({ ...route, query: { ...sansPlage(route.query), from: periode.from, to: periode.to, [nom]: input.value } });
    });
    return input;
  };
  dates.append(champ('from', periode.from, 'Date de début'), el('span', null, '→'), champ('to', periode.to, 'Date de fin'));
  barre.append(dates);

  if (periode.plafonnee) {
    const note = el('p', 'range-note', 'Période ramenée à 92 jours, la limite du serveur : du ' + fmtJourCourt(periode.from) + ' au ' + fmtJourCourt(periode.to));
    note.setAttribute('role', 'status');
    barre.append(note);
  }
  return barre;
}
