/* ============================================================
   Vue d'ensemble (action `apercu`) : indicateurs d'une période
   (≤ 92 jours civils de Paris), séances et entrées par mode,
   rétention J7 / J30, activité par jour en petits graphes, coûts
   IA avec unités réelles et coûts inconnus jamais comptés zéro.
   Le détail par enfant est dans Familles.
   ============================================================ */

import { barrePeriode } from '../ui/filtres.js';
import { carteCout, nomRole, celluleCout } from '../ui/blocs.js';
import { carteKpi, el, tableau } from '../ui/dom.js';
import { fmtDuree, fmtEntier } from '../ui/format.js';
import { grapheBarres } from '../ui/graphe.js';
import { LIBELLE_ENTREE, LIBELLE_MODE } from '../ui/libelles.js';
import { fmtJourCourt } from '../ui/paris.js';
import { periodeDepuisQuery } from '../ui/periode.js';
import { fmtVolume, volumesRole } from '../ui/unites.js';

export const titre = "Vue d'ensemble";

export async function rendre({ route, api, signal }) {
  const periode = periodeDepuisQuery(route.query);
  const a = await api.apercu(route.env, periode.from, periode.to, { signal });

  const vue = el('div', 'vue vue-apercu');
  const tete = el('div', 'page-head');
  tete.append(el('h1', 'page-title', titre), el('span', 'page-count', 'du ' + fmtJourCourt(periode.from) + ' au ' + fmtJourCourt(periode.to) + ' · ' + periode.jours + ' jours'));
  vue.append(tete, barrePeriode(route, periode));

  const kpis = el('div', 'kpi-grid kpi-grid-jour');
  kpis.append(
    carteKpi('Enfants actifs', String(a.enfantsActifs), a.famillesActives + (a.famillesActives > 1 ? ' familles actives' : ' famille active')),
    carteKpi('Séances', fmtEntier(a.seances.total)),
    carteKpi('Temps en séance', a.minutes ? fmtDuree(a.minutes) : '0 min', 'séances terminées'),
    carteKpi('Exercices', fmtEntier(a.exercices.succes) + ' / ' + fmtEntier(a.exercices.total),
      'réussis / total' + (a.exercices.fragile ? ' · ' + a.exercices.fragile + ' fragiles' : '')),
    carteKpi('Ouvertures d’app', fmtEntier(a.ouvertures)),
    a.couts ? carteCout(a.couts) : carteKpi('Coût IA', '—'),
  );
  vue.append(kpis);

  const modes = el('div', 'deux-colonnes');
  modes.append(
    blocRepartition('Séances par mode', 'Séances commencées sur la période.',
      Object.entries(a.seances.parMode).map(([cle, n]) => ({ libelle: LIBELLE_MODE[cle] || cle, n, cle }))),
    blocRepartition('Entrées par mode', 'Choix faits à l’ouverture (journal d’usage). La dictée n’est pas un mode de séance : elle est comptée ici à part.',
      Object.entries(a.entreesParMode).map(([cle, n]) => ({ libelle: LIBELLE_ENTREE[cle] || cle, n, cle }))),
  );
  vue.append(modes);

  vue.append(el('h2', 'section-title', 'Rétention'), blocRetention(a.retention));
  vue.append(el('h2', 'section-title', 'Activité par jour'), blocSerie(a.serie));
  if (a.couts) vue.append(sectionCouts(a.couts));
  return vue;
}

// ---------- Répartitions (barres horizontales proportionnelles) ----------

function blocRepartition(titreBloc, explication, lignes) {
  const bloc = el('section', 'repartition');
  bloc.append(el('h3', 'sous-titre', titreBloc), el('p', 'bloc-explication', explication));
  const max = Math.max(1, ...lignes.map((l) => l.n));
  const liste = el('div', 'repartition-lignes');
  for (const l of lignes) {
    const ligne = el('div', 'repartition-ligne' + (l.cle === 'dictee' ? ' is-dictee' : ''));
    const piste = el('span', 'repartition-piste');
    const barre = el('span', 'repartition-barre');
    barre.style.width = (l.n / max) * 100 + '%';
    piste.append(barre);
    ligne.append(el('span', 'repartition-libelle', l.libelle), piste, el('span', 'repartition-n', fmtEntier(l.n)));
    liste.append(ligne);
  }
  bloc.append(liste);
  return bloc;
}

// ---------- Rétention ----------

function blocRetention(retention) {
  const bloc = el('div', 'retention');
  const grille = el('div', 'kpi-grid kpi-grid-deux');
  for (const [cle, n] of [['j7', 7], ['j30', 30]]) {
    const r = retention[cle];
    const valeur = r.taux == null ? '—' : Math.round(r.taux * 100) + ' %';
    const note = r.eligibles
      ? r.revenus + (r.revenus > 1 ? ' revenus' : ' revenu') + ' sur ' + r.eligibles + (r.eligibles > 1 ? ' éligibles' : ' éligible')
      : 'aucun enfant éligible sur la période';
    grille.append(carteKpi('Rétention J' + n, valeur, note));
  }
  bloc.append(grille, el('p', 'bloc-explication',
    'Parmi les enfants ayant eu une séance sur la période : sont éligibles à J7 (ou J30) ceux dont le compte a été créé au moins 7 (ou 30) jours avant la fin de la période ; ' +
    'un enfant éligible est « revenu » s’il a commencé, sur la période, au moins une séance 7 (ou 30) jours ou plus après la création de son compte. Taux = revenus ÷ éligibles.'));
  return bloc;
}

// ---------- Série par jour : petits multiples + tableau ----------

function blocSerie(serie) {
  const bloc = el('section', 'serie');
  if (!serie.length) {
    bloc.append(el('p', 'reader-empty', 'Aucun jour sur la période.'));
    return bloc;
  }
  const infobulle = (p) => fmtJourCourt(p.jour) + ' — ' + p.seances + ' séance(s), ' + p.enfantsActifs + ' enfant(s), ' + p.minutes + ' min, ' + p.ouvertures + ' ouverture(s)';
  const series = [
    ['Séances', 'seances'],
    ['Enfants actifs', 'enfantsActifs'],
    ['Minutes de séance', 'minutes'],
    ['Ouvertures d’app', 'ouvertures'],
  ];
  const grille = el('div', 'graphes');
  for (const [libelle, cle] of series) {
    const carte = el('figure', 'graphe-carte');
    // Des enfants actifs ne s'additionnent pas d'un jour à l'autre : on donne le pic.
    const resume = cle === 'enfantsActifs'
      ? 'jusqu’à ' + Math.max(0, ...serie.map((p) => p[cle])) + ' par jour'
      : fmtEntier(serie.reduce((a, p) => a + p[cle], 0)) + ' au total';
    const legende = el('figcaption', 'graphe-legende');
    legende.append(el('span', 'eyebrow', libelle), el('span', 'graphe-total', resume));
    carte.append(legende, grapheBarres({
      serie: serie.map((p) => ({ jour: p.jour, valeur: p[cle], ...p })),
      libelle: libelle + ' par jour',
      formatValeur: fmtEntier,
      infobulle,
    }));
    grille.append(carte);
  }
  bloc.append(grille);

  const details = el('details', 'details-discret');
  details.append(el('summary', null, 'Voir les chiffres jour par jour'));
  details.append(tableau({
    classe: 'serie-table',
    colonnes: [
      { titre: 'Jour' },
      { titre: 'Séances', classe: 'cell-right', largeur: '90px' },
      { titre: 'Enfants', classe: 'cell-right', largeur: '90px' },
      { titre: 'Minutes', classe: 'cell-right', largeur: '90px' },
      { titre: 'Ouvertures', classe: 'cell-right', largeur: '100px' },
    ],
    lignes: [...serie].reverse().map((p) => [fmtJourCourt(p.jour), String(p.seances), String(p.enfantsActifs), String(p.minutes), String(p.ouvertures)]),
  }));
  bloc.append(details);
  return bloc;
}

// ---------- Coûts IA ----------

function sectionCouts(llm) {
  const section = el('section', 'llm-section');
  section.append(el('h2', 'section-title', 'Coûts IA'));

  const kpis = el('div', 'kpi-grid llm-kpis');
  kpis.append(
    carteCout(llm),
    carteKpi('Appels', fmtEntier(llm.appels)),
    carteKpi('Tokens entrée', fmtEntier(llm.tokensEntree), 'rôles facturés au token'),
    carteKpi('Tokens sortie', fmtEntier(llm.tokensSortie), 'rôles facturés au token'),
  );
  section.append(kpis);

  if (llm.volumesHorsTokens.length) {
    const volumes = el('div', 'volumes');
    for (const v of llm.volumesHorsTokens) {
      const bloc = el('div', 'volume');
      bloc.append(
        el('span', 'eyebrow', v.unite === 'seconde' ? 'Audio transcrit' : v.unite === 'caractere' ? 'Texte synthétisé' : v.unite),
        el('span', 'volume-valeur', fmtVolume(v.total, v.unite)),
        el('span', 'volume-note', fmtEntier(v.appels) + (v.appels > 1 ? ' appels' : ' appel')),
      );
      volumes.append(bloc);
    }
    section.append(volumes);
  }

  section.append(tableau({
    classe: 'llm-table',
    colonnes: [
      { titre: 'Rôle' },
      { titre: 'Coût', classe: 'cell-right', largeur: '220px' },
      { titre: 'Appels', classe: 'cell-right', largeur: '80px' },
      { titre: 'Entrée', classe: 'cell-right', largeur: '180px' },
      { titre: 'Sortie', classe: 'cell-right', largeur: '140px' },
    ],
    lignes: llm.parRole.map((r) => {
      const volumes = volumesRole(r);
      return [nomRole(r.role), celluleCout(r), fmtEntier(r.appels), volumes.entree, volumes.sortie];
    }),
    vide: 'Aucun appel sur cette période.',
  }));
  return section;
}
