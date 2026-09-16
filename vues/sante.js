/* ============================================================
   Santé & coûts (action `sante`) : erreurs client groupées,
   versions d'app, IA par rôle (unité réelle, latences, échecs,
   coût inconnu signalé), échecs IA récents, incidents de séance,
   quotas au plafond. Période ≤ 92 jours civils de Paris.
   ============================================================ */

import { barrePeriode } from '../ui/filtres.js';
import { blocIncidents, carteCout, listeErreursClient, tableEchecsIa, tableIa, tableVersions } from '../ui/blocs.js';
import { carteKpi, el, tableau } from '../ui/dom.js';
import { fmtEntier } from '../ui/format.js';
import { fmtJourCourt } from '../ui/paris.js';
import { periodeDepuisQuery } from '../ui/periode.js';
import { fmtEchecs, totalErreurs, totalIncidents } from '../ui/sante.js';

export const titre = 'Santé & coûts';

export async function rendre({ route, api, signal }) {
  const periode = periodeDepuisQuery(route.query);
  const s = await api.sante(route.env, periode.from, periode.to, { signal });

  const vue = el('div', 'vue vue-sante');
  const tete = el('div', 'page-head');
  tete.append(el('h1', 'page-title', titre), el('span', 'page-count', 'du ' + fmtJourCourt(periode.from) + ' au ' + fmtJourCourt(periode.to) + ' · ' + periode.jours + ' jours'));
  vue.append(tete, barrePeriode(route, periode));

  const erreurs = totalErreurs(s.erreursClient);
  const incidents = totalIncidents(s.incidents);
  const kpis = el('div', 'kpi-grid');
  const alerte = (carte, condition) => { if (condition) carte.classList.add('is-alerte'); return carte; };
  kpis.append(
    alerte(carteKpi('Erreurs client', fmtEntier(erreurs), s.erreursClient.length + (s.erreursClient.length > 1 ? ' groupes' : ' groupe')), erreurs > 0),
    alerte(carteKpi('Échecs IA', fmtEchecs(s.ia.echecs, s.ia.appels), 'sur ' + fmtEntier(s.ia.appels) + ' appels'), s.ia.echecs > 0),
    alerte(carteKpi('Incidents de séance', fmtEntier(incidents)), incidents > 0),
    carteCout(s.ia),
  );
  vue.append(kpis);

  vue.append(el('h2', 'section-title', 'Erreurs client'),
    el('p', 'bloc-explication', 'Regroupées par type, zone, écran, version et plateforme ; la pile est celle de l’occurrence la plus récente.'),
    listeErreursClient(s.erreursClient, { vide: 'Aucune erreur client sur la période.' }));

  vue.append(el('h2', 'section-title', 'IA par rôle'),
    el('p', 'bloc-explication', 'Volumes dans l’unité de facturation du rôle : tokens, secondes d’audio (transcription) ou caractères (synthèse vocale). Latences p50 / p95 sur les appels réussis.'),
    tableIa(s.ia, { vide: 'Aucun appel IA sur la période.' }));

  vue.append(el('h2', 'section-title', 'Échecs IA récents'), tableEchecsIa(s.echecsIa, { vide: 'Aucun échec IA sur la période.' }));

  vue.append(el('h2', 'section-title', 'Incidents de séance'), blocIncidents(s.incidents, route.env));
  if (!s.incidents.recents.length) vue.append(el('p', 'reader-empty', 'Aucun incident récent.'));

  vue.append(el('h2', 'section-title', 'Versions d’app et plateformes'), tableVersions(s.versions, { vide: 'Aucun lancement sur la période.' }));

  if (s.quotas) vue.append(sectionQuotas(s.quotas));
  return vue;
}

function sectionQuotas(q) {
  const section = el('section');
  section.append(el('h2', 'section-title', 'Quotas'), el('p', 'bloc-explication',
    'Comptes parent ayant atteint le plafond d’appels' + (q.plafond != null ? ' (' + fmtEntier(q.plafond) + ' unités par jour)' : '') + '. Le jour du quota est un jour UTC.'));
  section.append(tableau({
    classe: 'quotas-table',
    colonnes: [
      { titre: 'Jour (UTC)', largeur: '140px' },
      { titre: 'Parent' },
      { titre: 'Unités', classe: 'cell-right', largeur: '100px' },
    ],
    lignes: q.auPlafond.map((x) => [fmtJourCourt(x.jour), el('span', 'mono', x.parentId), fmtEntier(x.unites)]),
    vide: 'Aucun compte au plafond sur la période.',
  }));
  return section;
}
