/* ============================================================
   Incidents (action `veille`) : la veille de la prod, en clair.
   Huit familles d'incidents (F1-F8) en voyants vert / orange /
   rouge sur la fenêtre choisie (7, 14, 30 ou 92 jours), la frise
   jour par jour (le jour en cours est partiel), puis le détail
   des lignes de la vue pour creuser, au clic sur une famille, un
   jour ou une case. Aucun identifiant, aucun texte d'enfant :
   l'Edge ne rend que des compteurs et des codes.

   La sélection (famille, jour) vit dans le hash ; la changer ne
   recharge pas l'écran (history.replaceState) : un rafraîchissement
   la garde, la fenêtre seule déclenche un appel.
   ============================================================ */

import { construireHash } from '../router.js';
import { el, lien, tableau } from '../ui/dom.js';
import { fmtEuros, fmtEntier } from '../ui/format.js';
import {
  FAMILLES, FAMILLES_PAR_MESURE, FENETRES, famillesSignalees, filtrerLignes, fmtCompte, LIBELLE_FAMILLE,
  libelleCode, libelleFonction, libelleGroupe, NIVEAU, porteUnCout, queryDeSelection, resumeJours, selectionDepuisQuery,
} from '../ui/incidents.js';
import { LIBELLE_ROLE } from '../ui/libelles.js';
import { fmtJourCourt, fmtJourTitre, heureParis } from '../ui/paris.js';
import { fmtLatence } from '../ui/sante.js';

export const titre = 'Incidents';

export async function rendre({ route, api, signal }) {
  const { jours } = selectionDepuisQuery(route.query);
  const v = await api.veille(route.env, jours, { signal });
  const joursSerie = v.serie.map((p) => p.jour);
  const etat = selectionDepuisQuery(route.query, joursSerie);
  const familles = new Map(v.familles.map((f) => [f.famille, f]));
  const libelle = (f) => familles.get(f)?.libelle || LIBELLE_FAMILLE[f] || f;

  const vue = el('div', 'vue vue-incidents');
  const tete = el('div', 'page-head');
  const calcul = v.genereLe ? ' · calculé à ' + heureParis(v.genereLe) : '';
  tete.append(el('h1', 'page-title', titre),
    el('span', 'page-count', (v.premierJour ? 'du ' + fmtJourCourt(v.premierJour) + ' au ' + fmtJourCourt(v.aujourdhui) + ' · ' : '') + jours + ' jours' + calcul));
  vue.append(tete);

  // Fenêtre : un vrai changement d'écran (nouvel appel) ; la sélection suit.
  const barre = el('div', 'toolbar');
  const raccourcis = el('div', 'range-shortcuts');
  const liensFenetre = FENETRES.map((n) => {
    const a = lien('#', n === jours ? 'is-active' : '', n + ' jours');
    if (n === jours) a.setAttribute('aria-current', 'true');
    raccourcis.append(a);
    return { n, a };
  });
  barre.append(raccourcis);
  vue.append(barre);

  vue.append(el('p', 'bloc-explication',
    'La veille de la prod compte chaque jour ce qui a raté, rangé en huit familles. Rouge : à traiter ; orange : à surveiller. ' +
    'Les mêmes voyants que l’e-mail du matin. Cliquez sur une famille, un jour ou une case de la frise pour voir le détail.'));

  vue.append(bilanGlobal(v));

  // ---------- Sélection ----------
  const boutonsFamille = new Map();
  const boutonsJour = new Map();
  const cases = [];
  const zoneDetail = el('section', 'incidents-detail');
  zoneDetail.setAttribute('aria-live', 'polite');

  function choisir(changement) {
    Object.assign(etat, changement);
    const hash = construireHash({ ...route, query: queryDeSelection(etat) });
    history.replaceState(null, '', hash);
    appliquer();
    const haut = zoneDetail.getBoundingClientRect().top;
    if (haut > window.innerHeight - 80) zoneDetail.scrollIntoView({ block: 'start', behavior: preferenceMouvement() });
  }

  function appliquer() {
    for (const { n, a } of liensFenetre) {
      a.href = construireHash({ ...route, query: queryDeSelection({ ...etat, jours: n }) });
    }
    for (const [f, b] of boutonsFamille) b.setAttribute('aria-pressed', String(etat.famille === f));
    for (const [j, b] of boutonsJour) b.setAttribute('aria-pressed', String(etat.jour === j));
    for (const c of cases) {
      const actif = (!etat.jour || c.jour === etat.jour) && (!etat.famille || c.famille === etat.famille) && (etat.jour || etat.famille);
      c.bouton.classList.toggle('is-selection', Boolean(actif));
    }
    zoneDetail.replaceChildren(...detail(v, etat, libelle, choisir));
  }

  // ---------- Voyants des huit familles ----------
  const grille = el('div', 'familles-voyants');
  for (const f of FAMILLES) {
    const fam = familles.get(f);
    if (!fam) continue;
    const b = voyantFamille(fam, libelle(f));
    b.addEventListener('click', () => choisir({ famille: etat.famille === f ? null : f }));
    boutonsFamille.set(f, b);
    grille.append(b);
  }
  vue.append(el('h2', 'section-title', 'Les huit familles'), grille);

  // ---------- Frise ----------
  vue.append(el('h2', 'section-title', 'Jour par jour'),
    el('p', 'bloc-explication', 'Une colonne par jour, du plus ancien au plus récent ; la première ligne est le bilan du jour, le pire de ses familles.'),
    frise(v, libelle, { boutonsJour, cases, choisir, etat }), legende());

  vue.append(el('h2', 'section-title', 'Détail'), zoneDetail);
  appliquer();
  return vue;
}

function preferenceMouvement() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function pastille(niveau, { court = false } = {}) {
  const n = NIVEAU[niveau];
  return el('span', 'voyant-pastille ' + n.cls, court ? n.label : n.titre);
}

function bilanGlobal(v) {
  const enAlerte = v.familles.filter((f) => f.niveau === 'rouge').length;
  const aSurveiller = v.familles.filter((f) => f.niveau === 'orange').length;
  const bloc = el('div', 'incidents-bilan ' + NIVEAU[v.niveau].cls);
  let phrase;
  if (v.niveau === 'vert') phrase = 'Rien à signaler sur les ' + v.jours + ' derniers jours.';
  else {
    const parts = [];
    if (enAlerte) parts.push(enAlerte + (enAlerte > 1 ? ' familles sont passées au rouge' : ' famille est passée au rouge'));
    if (aSurveiller) parts.push(aSurveiller + (aSurveiller > 1 ? ' familles à surveiller' : ' famille à surveiller'));
    phrase = parts.join(', ') + ' sur la période.';
  }
  const dernier = v.serie[v.serie.length - 1];
  bloc.append(pastille(v.niveau), el('span', 'incidents-bilan-texte', phrase));
  if (dernier && dernier.partiel) {
    bloc.append(el('span', 'incidents-bilan-note', 'Aujourd’hui : ' + NIVEAU[dernier.niveau].titre.toLowerCase() + ' pour l’instant (journée en cours).'));
  }
  return bloc;
}

function voyantFamille(f, libelle) {
  const b = el('button', 'famille-voyant ' + NIVEAU[f.niveau].cls);
  b.type = 'button';
  const haut = el('span', 'famille-voyant-haut');
  haut.append(pastille(f.niveau, { court: true }), el('span', 'famille-code', f.famille));
  b.append(haut, el('span', 'famille-libelle', libelle));

  const compte = el('span', 'famille-compte');
  if (f.niveau === 'vert' && !f.nb) compte.textContent = 'Rien de signalé sur la période';
  else {
    const resume = resumeJours(f);
    compte.textContent = (FAMILLES_PAR_MESURE.includes(f.famille) ? '' : fmtEntier(f.nb) + ' sur la période') +
      (resume ? (FAMILLES_PAR_MESURE.includes(f.famille) ? '' : ' · ') + resume : '');
  }
  b.append(compte);
  if (f.dernierJourSignale) b.append(el('span', 'famille-dernier', 'Dernier signalé le ' + fmtJourTitre(f.dernierJourSignale)));
  return b;
}

// ---------- Frise : bilan du jour + une ligne par famille ----------

function frise(v, libelle, { boutonsJour, cases, choisir, etat }) {
  const cadre = el('div', 'frise-cadre');
  const grille = el('div', 'frise');
  grille.style.setProperty('--nb-jours', String(v.serie.length));
  grille.setAttribute('role', 'group');
  grille.setAttribute('aria-label', 'Frise des jours');

  // En-tête : les jours (date courte, mois au premier du mois ou en tête).
  grille.append(el('span', 'frise-coin'));
  v.serie.forEach((p, i) => {
    const [, mois, jj] = p.jour.split('-');
    const tete = el('span', 'frise-date' + (p.partiel ? ' is-partiel' : ''), String(Number(jj)));
    if (i === 0 || jj === '01') tete.append(el('span', 'frise-mois', fmtJourCourt(p.jour).replace(/^\d+\s/, '')));
    tete.dataset.mois = mois;
    grille.append(tete);
  });

  // Bilan du jour (sélectionne le jour).
  grille.append(el('span', 'frise-libelle frise-libelle-bilan', 'Bilan du jour'));
  for (const p of v.serie) {
    const b = caseFrise(p.niveau, p.partiel, fmtJourTitre(p.jour) + (p.partiel ? ' (en cours)' : '') + ' — ' + NIVEAU[p.niveau].titre);
    b.classList.add('frise-case-bilan');
    b.addEventListener('click', () => choisir({ jour: etat.jour === p.jour ? null : p.jour }));
    boutonsJour.set(p.jour, b);
    grille.append(b);
  }

  for (const f of FAMILLES) {
    const etiquette = el('span', 'frise-libelle');
    etiquette.append(el('span', 'famille-code', f), el('span', 'frise-libelle-texte', libelle(f)));
    etiquette.title = libelle(f);
    grille.append(etiquette);
    for (const p of v.serie) {
      const x = p.familles[f] || { niveau: 'vert', nb: 0, motifs: [] };
      const b = caseFrise(x.niveau, p.partiel,
        fmtJourTitre(p.jour) + ' — ' + f + ' ' + libelle(f) + ' — ' + NIVEAU[x.niveau].titre + (x.nb ? ' (' + x.nb + ')' : ''));
      b.addEventListener('click', () => {
        const meme = etat.jour === p.jour && etat.famille === f;
        choisir(meme ? { jour: null, famille: null } : { jour: p.jour, famille: f });
      });
      cases.push({ jour: p.jour, famille: f, bouton: b });
      grille.append(b);
    }
  }
  cadre.append(grille);
  return cadre;
}

function caseFrise(niveau, partiel, etiquette) {
  const b = el('button', 'frise-case ' + NIVEAU[niveau].cls + (partiel ? ' is-partiel' : ''));
  b.type = 'button';
  b.setAttribute('aria-label', etiquette);
  b.title = etiquette;
  return b;
}

function legende() {
  const l = el('div', 'frise-legende');
  for (const n of ['vert', 'orange', 'rouge']) {
    const item = el('span', 'frise-legende-item');
    item.append(el('span', 'frise-case ' + NIVEAU[n].cls), el('span', null, NIVEAU[n].titre));
    l.append(item);
  }
  const partiel = el('span', 'frise-legende-item');
  partiel.append(el('span', 'frise-case is-vert is-partiel'), el('span', null, 'Aujourd’hui, journée en cours (partielle)'));
  l.append(partiel);
  return l;
}

// ---------- Détail de la sélection ----------

function detail(v, etat, libelle, choisir) {
  if (!etat.famille && !etat.jour) {
    return [el('p', 'reader-empty', 'Choisissez une famille, un jour ou une case de la frise pour voir ce qui s’est passé.')];
  }
  const noeuds = [];

  // Filtres actifs, chacun retirable.
  const filtres = el('div', 'chips-ligne incidents-filtres');
  filtres.append(el('span', 'eyebrow', 'Sélection'));
  const filtre = (texte, retirer) => {
    const b = el('button', 'bouton bouton-filtre', texte + ' ×');
    b.type = 'button';
    b.setAttribute('aria-label', 'Retirer : ' + texte);
    b.addEventListener('click', retirer);
    filtres.append(b);
  };
  if (etat.famille) filtre(etat.famille + ' · ' + libelle(etat.famille), () => choisir({ famille: null }));
  if (etat.jour) filtre(fmtJourTitre(etat.jour), () => choisir({ jour: null }));
  noeuds.push(filtres);

  const point = etat.jour ? v.serie.find((p) => p.jour === etat.jour) : null;
  const fam = etat.famille ? v.familles.find((f) => f.famille === etat.famille) : null;
  const cartes = el('div', 'incidents-cartes');
  if (point) cartes.append(carteJour(point, etat.famille, libelle));
  if (fam) cartes.append(carteFamille(fam, libelle(fam.famille), point ? null : v.serie, choisir));
  noeuds.push(cartes);

  const { signaux, contexte } = filtrerLignes(v.lignes, etat);
  noeuds.push(el('h3', 'sous-titre', 'Ce qui a été compté'));
  if (fam && FAMILLES_PAR_MESURE.includes(fam.famille)) {
    noeuds.push(el('p', 'bloc-explication', 'Cette famille compare les jours entre eux : la raison est dans le motif ci-dessus, et les mesures du jour sont plus bas.'));
  }
  noeuds.push(tableSignaux(signaux, !etat.jour));
  if (contexte.length) {
    noeuds.push(el('h3', 'sous-titre', 'Contexte : mesures et signaux sans voyant'),
      el('p', 'bloc-explication', 'Volumes d’appels IA (échecs sur appels), temps de réponse (médiane / 95 % des appels), coût, exécutions des automates, et ce qui a été vu sans allumer de voyant.'),
      tableContexte(contexte, !etat.jour));
  }
  return noeuds;
}

function carteJour(p, famille, libelle) {
  const carte = el('div', 'incidents-carte ' + NIVEAU[p.niveau].cls);
  const tete = el('div', 'incidents-carte-tete');
  tete.append(el('span', 'incidents-carte-titre', fmtJourTitre(p.jour)), pastille(p.niveau));
  if (p.partiel) tete.append(el('span', 'chip is-info', 'en cours, pas fini'));
  carte.append(tete);
  carte.append(el('p', 'incidents-carte-ligne', fmtEntier(p.appelsLlm) + ' appels IA · coût ' + fmtEuros(p.eur)));
  const signalees = famillesSignalees(p).filter((x) => !famille || x.famille === famille);
  if (!signalees.length) {
    carte.append(el('p', 'incidents-carte-ligne row-muted', famille ? famille + ' : rien à signaler ce jour.' : 'Aucune famille signalée ce jour.'));
  } else {
    const liste = el('ul', 'incidents-motifs');
    for (const x of signalees) {
      const li = el('li');
      li.append(pastille(x.niveau, { court: true }), el('span', 'famille-code', x.famille), el('span', null, libelle(x.famille)));
      if (x.motifs.length) li.append(el('span', 'row-muted', ' — ' + x.motifs.join(' ; ')));
      liste.append(li);
    }
    carte.append(liste);
  }
  return carte;
}

// serie : fournie quand aucun jour n'est choisi, pour lister les jours signalés.
function carteFamille(f, libelle, serie, choisir) {
  const carte = el('div', 'incidents-carte ' + NIVEAU[f.niveau].cls);
  const tete = el('div', 'incidents-carte-tete');
  tete.append(el('span', 'incidents-carte-titre', f.famille + ' · ' + libelle), pastille(f.niveau));
  carte.append(tete);
  const seuils = el('dl', 'incidents-seuils');
  if (f.seuil.orange) seuils.append(el('dt', 'eyebrow', 'Orange'), el('dd', null, f.seuil.orange));
  if (f.seuil.rouge) seuils.append(el('dt', 'eyebrow', 'Rouge'), el('dd', null, f.seuil.rouge));
  carte.append(seuils);
  const resume = resumeJours(f);
  carte.append(el('p', 'incidents-carte-ligne', resume
    ? resume + ' · dernier signalé le ' + fmtJourTitre(f.dernierJourSignale)
    : 'Rien de signalé sur la période.'));

  if (serie) {
    const jours = serie.filter((p) => p.familles[f.famille] && p.familles[f.famille].niveau !== 'vert').reverse();
    if (jours.length) {
      const liste = el('ul', 'incidents-motifs');
      for (const p of jours) {
        const x = p.familles[f.famille];
        const li = el('li');
        const b = el('button', 'lien-bouton', fmtJourTitre(p.jour));
        b.type = 'button';
        b.addEventListener('click', () => choisir({ jour: p.jour }));
        li.append(pastille(x.niveau, { court: true }), b);
        if (x.motifs.length) li.append(el('span', 'row-muted', ' — ' + x.motifs.join(' ; ')));
        liste.append(li);
      }
      carte.append(liste);
    }
  }
  return carte;
}

// ---------- Tableaux des lignes ----------

function celluleQuoi(l) {
  const { libelle, brut } = libelleCode(l.code);
  const c = el('span', 'row-name', libelle);
  if (brut) c.append(el('span', 'cell-note mono', brut));
  return c;
}

function celluleOu(l) {
  const c = el('span');
  const morceaux = [libelleFonction(l.fonction), l.role ? LIBELLE_ROLE[l.role] || l.role : null].filter(Boolean);
  c.append(el('span', null, morceaux.join(' · ') || '—'));
  if (l.modele) c.append(el('span', 'cell-note mono', l.modele));
  return c;
}

function fmtHeures(l) {
  const a = heureParis(l.premierAt);
  const b = heureParis(l.dernierAt);
  if (!a && !b) return '—';
  if (!a || !b || a === b) return 'à ' + (a || b);
  return 'de ' + a + ' à ' + b;
}

function fmtNombre(l) {
  if (l.code === 'appels') {
    return l.nb + (l.nb > 1 ? ' échecs' : ' échec') + ' sur ' + fmtEntier(l.nbTotal ?? 0) + ' appels';
  }
  return fmtCompte(l.nb, l.nbTotal);
}

function celluleCoutLigne(l) {
  if (!porteUnCout(l)) return el('span', 'row-muted', '—');
  return el('span', 'row-num' + (l.eur == null ? ' is-unknown' : ''), fmtEuros(l.eur));
}

function tableSignaux(lignes, avecJour) {
  const colonnes = [
    ...(avecJour ? [{ titre: 'Jour', largeur: '90px' }] : []),
    { titre: 'Famille', largeur: '64px' },
    { titre: 'Ce qui s’est passé', largeur: 'minmax(180px, 2fr)' },
    { titre: 'Où', largeur: 'minmax(140px, 1.4fr)' },
    { titre: 'Nombre', classe: 'cell-right', largeur: '80px' },
    { titre: 'Heures (Paris)', largeur: '120px' },
  ];
  return tableau({
    classe: 'incidents-table',
    colonnes,
    lignes: lignes.map((l) => [
      ...(avecJour ? [fmtJourCourt(l.jour)] : []),
      el('span', 'famille-code', l.famille),
      celluleQuoi(l),
      celluleOu(l),
      el('span', 'row-num', fmtNombre(l)),
      fmtHeures(l),
    ]),
    vide: 'Aucune ligne pour cette sélection.',
  });
}

function tableContexte(lignes, avecJour) {
  const colonnes = [
    ...(avecJour ? [{ titre: 'Jour', largeur: '90px' }] : []),
    { titre: 'Type', largeur: '90px' },
    { titre: 'Quoi', largeur: 'minmax(170px, 2fr)' },
    { titre: 'Où', largeur: 'minmax(140px, 1.4fr)' },
    { titre: 'Nombre', classe: 'cell-right', largeur: '130px' },
    { titre: 'Temps de réponse', classe: 'cell-right', largeur: '120px' },
    { titre: 'Coût', classe: 'cell-right', largeur: '90px' },
  ];
  return tableau({
    classe: 'incidents-table',
    colonnes,
    lignes: lignes.map((l) => [
      ...(avecJour ? [fmtJourCourt(l.jour)] : []),
      el('span', 'row-muted', libelleGroupe(l.famille)),
      celluleQuoi(l),
      celluleOu(l),
      el('span', 'row-num', fmtNombre(l)),
      el('span', 'row-num', l.p50 == null && l.p95 == null ? '—' : fmtLatence(l.p50) + ' / ' + fmtLatence(l.p95)),
      celluleCoutLigne(l),
    ]),
    vide: 'Aucune mesure pour cette sélection.',
  });
}
