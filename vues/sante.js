/* ============================================================
   Santé & coûts (action `sante`) : erreurs client groupées,
   versions d'app, IA par rôle (unité réelle, latences, échecs,
   coût inconnu signalé), échecs IA récents, incidents de séance,
   quotas au plafond, photos de devoir non lues (PHOTO-ECHEC-2).
   Période ≤ 92 jours civils de Paris.
   ============================================================ */

import { barrePeriode } from '../ui/filtres.js';
import { avecInternes, interrupteurInternes } from '../ui/internes.js';
import { blocIncidents, carteCout, lienSeance, listeErreursClient, tableEchecsIa, tableIa, tableVersions } from '../ui/blocs.js';
import { carteKpi, el, tableau } from '../ui/dom.js';
import { fmtEntier } from '../ui/format.js';
import { fmtJourCourt } from '../ui/paris.js';
import { periodeDepuisQuery } from '../ui/periode.js';
import { fmtEchecs, fmtPhotosNonLues, fmtSuiteTelephone, totalErreurs, totalIncidents } from '../ui/sante.js';

export const titre = 'Santé & coûts';

export async function rendre({ route, api, signal }) {
  const periode = periodeDepuisQuery(route.query);
  const s = await api.sante(route.env, periode.from, periode.to, { signal, avecInternes: avecInternes(route) });

  const vue = el('div', 'vue vue-sante');
  const tete = el('div', 'page-head');
  tete.append(el('h1', 'page-title', titre), el('span', 'page-count', 'du ' + fmtJourCourt(periode.from) + ' au ' + fmtJourCourt(periode.to) + ' · ' + periode.jours + ' jours'));
  const barre = barrePeriode(route, periode);
  barre.append(interrupteurInternes(route));
  vue.append(tete, barre);

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

  if (s.lecturesPhoto) vue.append(sectionPhotosNonLues(s.lecturesPhoto, route.env));

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

// PHOTO-ECHEC-2 : les photos de devoir que le serveur n'a pas lues, par
// jour et par famille, avec ce qu'en a fait le téléphone ensuite.
function sectionPhotosNonLues(lp, env) {
  const section = el('section');
  const t = lp.totaux;
  section.append(el('h2', 'section-title', 'Photos de devoir non lues'), el('p', 'bloc-explication',
    'Photo non lue : aucun lecteur du serveur n’a rendu la photo, l’app a fait lire la page par le téléphone. ' +
    'Lue par le secours : la photo a été rattrapée en relisant les recopies page par page. ' +
    'Téléphone : ce que la lecture sur le téléphone a donné ensuite.'));
  if (t.nonLues || t.secours) {
    section.append(el('p', 'bloc-explication',
      'Sur la période : ' + fmtPhotosNonLues(t.nonLues, t.nbPhotos) + ' non lue' + (t.nonLues > 1 ? 's' : '') +
      ' · ' + fmtEntier(t.secours) + ' lue' + (t.secours > 1 ? 's' : '') + ' par le secours' +
      ' · téléphone : ' + fmtSuiteTelephone(t) + '.'));
  }
  section.append(tableau({
    classe: 'photos-non-lues-table',
    colonnes: [
      { titre: 'Jour', largeur: '120px' },
      { titre: 'Famille (parent)' },
      { titre: 'Photo non lue', classe: 'cell-right', largeur: '130px' },
      { titre: 'Lue par le secours', classe: 'cell-right', largeur: '140px' },
      { titre: 'Téléphone' },
      { titre: 'Séances' },
    ],
    lignes: lp.parJour.map((j) => {
      const seances = el('span');
      j.seances.forEach((id, i) => {
        if (i) seances.append(' ');
        seances.append(lienSeance(env, id, id.slice(0, 8), 'mono'));
      });
      return {
        classe: j.nonLues ? 'is-alerte' : '',
        cellules: [
          fmtJourCourt(j.jour),
          el('span', 'mono', j.parentId || 'inconnu'),
          fmtPhotosNonLues(j.nonLues, j.nbPhotos),
          fmtEntier(j.secours),
          fmtSuiteTelephone(j),
          j.seances.length ? seances : '—',
        ],
      };
    }),
    vide: 'Aucune photo non lue sur la période.',
  }));
  return section;
}
