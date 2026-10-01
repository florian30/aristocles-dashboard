/* ============================================================
   La veille — page d'accueil (action `journee`).
   Ce qui s'est passé un jour civil de Paris : résumé en tuiles,
   une carte par enfant actif (séances, devoirs, dictées, écrans
   consultés, erreurs), puis la technique du jour.
   ============================================================ */

import { construireHash, naviguer } from '../router.js';
import { blocIncidents, carteCout, listeErreursClient, tableEchecsIa, tableIa, tableVersions } from '../ui/blocs.js';
import { listeDictees } from '../ui/dictee.js';
import { carteKpi, el, lien, tableau } from '../ui/dom.js';
import { fmtDureeSec, fmtEntier, pluriel } from '../ui/format.js';
import { LIBELLE_MODE, libelleCloture } from '../ui/libelles.js';
import { fmtJourCourt, fmtJourTitre, navigationJour } from '../ui/paris.js';

export const titre = 'La veille';

export async function rendre({ route, api, signal }) {
  const jour = await api.journee(route.env, route.date, { signal });

  const vue = el('div', 'vue vue-veille');
  vue.append(entete(route));

  if (jour.estVide) {
    const vide = el('section', 'etat etat-vide');
    vide.append(
      el('p', 'etat-titre-neutre', 'Aucune activité ce jour-là'),
      el('p', 'etat-detail', 'Ni séance, ni ouverture d’app, ni appel IA le ' + fmtJourTitre(route.date) + '. Les flèches mènent aux jours voisins.'),
    );
    vue.append(vide);
    return vue;
  }

  vue.append(tuilesResume(jour));

  vue.append(el('h2', 'section-title', jour.enfants.length > 1 ? 'Les enfants' : 'L’enfant'));
  const cartes = el('div', 'cartes-enfants');
  for (const enfant of jour.enfants) cartes.append(carteEnfant(enfant, route.env));
  if (!jour.enfants.length) cartes.append(el('p', 'reader-empty', 'Aucun enfant actif ce jour-là (activité technique seule).'));
  vue.append(cartes);

  vue.append(technique(jour.technique, route.env));
  return vue;
}

// ---------- En-tête : date, flèches, sélecteur ----------

function entete(route) {
  const nav = navigationJour(route.date);
  const tete = el('div', 'veille-head');

  const titres = el('div', 'veille-titres');
  const repere = route.date === nav.hier ? 'Hier' : route.date === nav.aujourdhui ? 'Aujourd’hui (en cours)' : nav.estFutur ? 'Jour à venir' : 'La veille';
  titres.append(el('span', 'eyebrow', repere), el('h1', 'page-title veille-date', majuscule(fmtJourTitre(route.date))));

  const commandes = el('div', 'day-nav');
  const precedent = lien(construireHash({ ...route, date: nav.precedent }), 'day-arrow', '‹');
  precedent.setAttribute('aria-label', 'Jour précédent (' + fmtJourCourt(nav.precedent) + ')');
  precedent.title = 'Jour précédent';
  let suivant;
  if (nav.suivant) {
    suivant = lien(construireHash({ ...route, date: nav.suivant }), 'day-arrow', '›');
    suivant.setAttribute('aria-label', 'Jour suivant (' + fmtJourCourt(nav.suivant) + ')');
    suivant.title = 'Jour suivant';
  } else {
    suivant = el('span', 'day-arrow is-disabled', '›');
    suivant.setAttribute('aria-disabled', 'true');
    suivant.title = 'Pas de jour suivant';
  }

  const choix = el('input', 'day-picker');
  choix.type = 'date';
  choix.value = route.date;
  choix.max = nav.aujourdhui;
  choix.setAttribute('aria-label', 'Choisir un jour');
  choix.addEventListener('change', () => {
    if (choix.value) naviguer({ ...route, date: choix.value });
  });

  commandes.append(precedent, suivant, choix);
  if (route.date !== nav.hier) commandes.append(lien(construireHash({ ...route, date: nav.hier }), 'day-hier', 'Revenir à hier'));
  tete.append(titres, commandes);
  return tete;
}

const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- Tuiles ----------

function tuilesResume(jour) {
  const r = jour.resume;
  const grille = el('div', 'kpi-grid kpi-grid-jour');
  grille.append(
    carteKpi('Enfants actifs', String(r.enfantsActifs)),
    carteKpi('Séances', String(r.seances), r.seancesEnCours ? 'dont ' + r.seancesEnCours + ' en cours' : null),
    carteKpi('Minutes', fmtEntier(r.minutes), 'séances terminées'),
    carteKpi('Exercices', r.exercicesReussis + ' / ' + r.exercices, 'réussis / total'),
    carteKpi('Ouvertures d’app', String(r.ouvertures)),
    tuileErreurs(r),
    carteCout(jour.technique.ia),
  );
  return grille;
}

function tuileErreurs(r) {
  const notes = [];
  if (r.incidents) notes.push(pluriel(r.incidents, 'incident'));
  if (r.echecsIa) notes.push(pluriel(r.echecsIa, 'échec IA', 'échecs IA'));
  const carte = carteKpi('Erreurs client', String(r.erreurs), notes.join(' · ') || null);
  if (r.erreurs || r.incidents || r.echecsIa) carte.classList.add('is-alerte');
  return carte;
}

// ---------- Carte enfant ----------

function carteEnfant(e, env) {
  const carte = el('article', 'carte-enfant');

  const tete = el('header', 'carte-enfant-tete');
  const nom = el('h3', 'carte-enfant-nom');
  nom.append(lien(construireHash({ env, vue: 'familles', childId: e.childId }), null, e.prenom));
  if (e.classe) nom.append(el('span', 'chip is-muted', e.classe));
  const minutes = Math.round(e.seances.reduce((a, s) => a + (s.status === 'archivee' ? s.dureeSec || 0 : 0), 0) / 60);
  const resume = [
    e.seances.length ? pluriel(e.seances.length, 'séance') : 'Aucune séance',
    e.seances.length ? minutes + ' min' : null,
    e.dictees.length ? pluriel(e.dictees.length, 'dictée') : null,
    pluriel(e.ouvertures, 'ouverture') + ' d’app',
    e.erreursClient.length ? pluriel(e.erreursClient.reduce((a, x) => a + x.nb, 0), 'erreur') : null,
  ].filter(Boolean).join(' · ');
  tete.append(nom, el('span', 'carte-enfant-resume', resume));
  carte.append(tete);

  const corps = el('div', 'carte-enfant-corps');
  if (e.seances.length) corps.append(tableSeances(e.seances, env));

  if (e.devoirs.length) corps.append(sousBloc('Devoirs', listeDevoirs(e.devoirs, env)));
  if (e.dictees.length) corps.append(sousBloc('Dictées', listeDictees(e.dictees, { env })));
  if (e.ecrans.length) corps.append(sousBloc('Écrans consultés hors séance', tableEcrans(e.ecrans)));
  if (e.erreursClient.length) corps.append(sousBloc('Erreurs client', listeErreursClient(e.erreursClient)));
  carte.append(corps);
  return carte;
}

function sousBloc(titreBloc, contenu) {
  const bloc = el('section', 'sous-bloc');
  bloc.append(el('h4', 'eyebrow', titreBloc), contenu);
  return bloc;
}

function tableSeances(seances, env) {
  return tableau({
    classe: 'seances-jour',
    colonnes: [
      { titre: 'Heure', largeur: '96px' },
      { titre: 'Séance', largeur: 'minmax(150px, 1.6fr)' },
      { titre: 'Durée', classe: 'cell-right', largeur: '76px' },
      { titre: 'Écrans', classe: 'cell-right', largeur: '56px' },
      { titre: 'Exercices', largeur: 'minmax(130px, 1.2fr)' },
      { titre: 'Pouces', largeur: '84px' },
      { titre: 'Clôture', largeur: '112px' },
    ],
    lignes: seances.map((s) => {
      const seance = el('span', 'row-name');
      const mode = el('span', 'row-mode');
      mode.append(el('span', 'mode-dot is-' + s.mode), document.createTextNode(LIBELLE_MODE[s.mode] || s.mode));
      seance.append(mode, el('span', 'cell-note', s.theme || 'Sans thème'));
      const cloture = libelleCloture(s.status, s.cloture);
      return {
        href: construireHash({ env, vue: 'seances', sessionId: s.id }),
        cellules: [
          el('span', 'row-date', s.heure + (s.heureFin ? '–' + s.heureFin : '')),
          seance,
          el('span', s.dureeSec == null ? 'row-open' : '', s.dureeSec == null ? 'En cours' : fmtDureeSec(s.dureeSec)),
          String(s.nbEcrans),
          celluleExercices(s.exercices),
          celluleSeancePouces(s.pouces),
          el('span', 'chip ' + cloture.cls, cloture.label),
        ],
      };
    }),
  });
}

function celluleExercices(x) {
  if (!x.nb) return el('span', 'row-muted', 'Aucun');
  const c = el('span', 'exercices-resultats');
  const parties = [];
  if (x.succes) parties.push(el('span', 'is-success', x.succes + ' réussi' + (x.succes > 1 ? 's' : '')));
  if (x.fragile) parties.push(el('span', 'is-fragile', x.fragile + ' fragile' + (x.fragile > 1 ? 's' : '')));
  if (x.autres) parties.push(el('span', 'row-muted', x.autres + ' autre' + (x.autres > 1 ? 's' : '')));
  parties.forEach((p, i) => c.append(...(i ? [el('span', 'row-muted', '·'), p] : [p])));
  c.append(el('span', 'row-muted', 'sur ' + x.nb));
  return c;
}

function celluleSeancePouces(p) {
  if (!p.haut && !p.bas) return el('span', 'row-muted', '—');
  const c = el('span', 'pouces');
  c.setAttribute('aria-label', p.haut + ' pouce(s) levé(s), ' + p.bas + ' pouce(s) baissé(s)');
  c.append(el('span', null, '👍 ' + p.haut), el('span', null, '👎 ' + p.bas));
  return c;
}

function listeDevoirs(devoirs, env) {
  const liste = el('ul', 'liste-simple');
  for (const d of devoirs) {
    const li = el('li');
    li.append(
      lien(construireHash({ env, vue: 'seances', sessionId: d.sessionId }), 'row-name', d.titre || 'Devoir'),
      el('span', 'row-muted', [
        d.matiere,
        d.pourLe ? 'pour le ' + fmtJourCourt(d.pourLe) : null,
        d.nbConsignes != null ? pluriel(d.nbConsignes, 'consigne') : null,
      ].filter(Boolean).join(' · ')),
    );
    liste.append(li);
  }
  return liste;
}

function tableEcrans(ecrans) {
  return tableau({
    classe: 'ecrans-table',
    colonnes: [
      { titre: 'Écran', largeur: 'minmax(140px, 1fr)' },
      { titre: 'Vues', classe: 'cell-right', largeur: '64px' },
      { titre: 'Durée', classe: 'cell-right', largeur: '110px' },
    ],
    lignes: ecrans.map((x) => [el('span', 'mono', x.ecran), String(x.nb), x.dureeMs ? fmtDureeSec(x.dureeMs / 1000) : '—']),
  });
}

// ---------- Technique du jour ----------

function technique(t, env) {
  const section = el('section', 'technique');
  section.append(el('h2', 'section-title', 'Technique du jour'));

  const synthese = el('div', 'kpi-grid kpi-grid-compact');
  const appelsCarte = carteKpi('Appels IA', fmtEntier(t.ia.appels), t.ia.echecs ? pluriel(t.ia.echecs, 'échec') : 'aucun échec');
  if (t.ia.echecs) appelsCarte.classList.add('is-alerte');
  const coutCarte = carteCout(t.ia);
  synthese.append(
    appelsCarte,
    coutCarte,
    carteKpi('Ouvertures d’app', fmtEntier(t.ouvertures)),
    carteKpi('Incidents de séance', String(t.incidents.parType.reduce((a, i) => a + i.nb, 0))),
  );
  section.append(synthese);

  section.append(el('h3', 'sous-titre', 'Appels IA par rôle'), tableIa(t.ia, { vide: 'Aucun appel IA ce jour-là.' }));
  if (t.echecsIa.length) section.append(el('h3', 'sous-titre', 'Échecs IA'), tableEchecsIa(t.echecsIa, { avecDate: false }));
  section.append(el('h3', 'sous-titre', 'Incidents de séance'), blocIncidents(t.incidents, env, { avecDate: false }));
  section.append(el('h3', 'sous-titre', 'Versions d’app et plateformes'), tableVersions(t.versions, { vide: 'Aucun lancement ce jour-là.' }));
  return section;
}
