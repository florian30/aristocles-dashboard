/* ============================================================
   Aristocles — Rubrique Dictée (DICT-12), partagée par La veille,
   la fiche enfant et la relecture de séance.
   Les fonctions de libellé sont pures (testées sous Deno) ; un
   champ absent (Edge pas encore à jour) donne null et la partie
   correspondante n'est pas affichée. Le texte dicté et les codes
   de règle viennent du serveur : textContent uniquement, comme
   la liste de mots et les mots douteux (v2.6 : forme juste, lecture
   d'Ari, ce que l'enfant a retapé).
   ============================================================ */

import { construireHash } from '../router.js';
import { el, lien } from './dom.js';
import { fmtEntier, pluriel } from './format.js';
import { fmtInstantParis, heureParis } from './paris.js';

export const LIBELLE_ORIGINE_DICTEE = { devoir: 'Devoir', entrainement: 'Entraînement' };

// Étapes en cours de route (D20) : la dictée est « à finir ».
const ETAPES_EN_COURS = {
  preparation: 'préparation',
  ecoute: 'écoute',
  relecture: 'relecture',
  photo: 'photo',
  confirmation: 'confirmation',
  correction: 'correction',
};

// Pastille d'étape : { label, cls, note? } ou null si l'étape n'est pas rendue.
// `classe` null = ancien flux (avant la refonte) : son étape n'a pas de sens.
export function etapeDictee(d) {
  if (!d.etape) return null;
  if (!d.classe) return { label: 'Ancien flux', cls: 'is-muted' };
  if (d.etape === 'fin') return { label: 'Finie', cls: 'is-success' };
  if (d.etape === 'non_corrigee') return { label: 'Non corrigée', cls: 'is-fragile' };
  if (d.etape === 'echec') return { label: 'Échec', cls: 'is-failure' };
  const enCours = ETAPES_EN_COURS[d.etape];
  return { label: 'À finir', cls: 'is-info', note: 'étape : ' + (enCours || d.etape) };
}

// « 2 fautes comptées · 1 réglée · 1 contestée » ; null si le compte n'est pas rendu.
export function resumeFautes(d) {
  if (d.nbFautes == null) return null;
  const parties = [d.nbFautes ? pluriel(d.nbFautes, 'faute comptée', 'fautes comptées') : 'Aucune faute comptée'];
  const reglees = d.evenements?.reglee;
  if (reglees) parties.push(reglees + (reglees > 1 ? ' réglées' : ' réglée'));
  if (d.nbContestees) parties.push(d.nbContestees + (d.nbContestees > 1 ? ' contestées' : ' contestée'));
  return parties.join(' · ');
}

// ---- DASH-DICTEE-FRONT (contrat v2.6) : liste, caractéristiques, mots douteux.

export const LIBELLE_SOURCE_LISTE = {
  donne_en_devoir: 'donnée en devoir',
  photo_enfant: 'prise en photo par l’enfant',
  voix_enfant: 'dictée à la voix par l’enfant',
  clavier_enfant: 'tapée par l’enfant',
  ari_choisit: 'choisie par Ari',
};

export const LIBELLE_PROVENANCE_MOT = {
  devoir: 'du devoir',
  photo: 'pris en photo',
  voix: 'saisis à la voix',
  clavier: 'saisis au clavier',
  a_retravailler: 'à retravailler',
  dubois_buyse: 'Dubois-Buyse',
  complement_dubois_buyse: 'complément Dubois-Buyse',
};

// Liste de mots : { titre, groupes: [{ libelle, mots }], note } ou null si
// l'Edge ne la rend pas. Mots groupés par provenance, dans l'ordre de la
// liste ; une liste antérieure (provenance inconnue) n'a qu'un groupe.
export function resumeListe(d) {
  const l = d.liste;
  if (!l) return null;
  if (l.libre) return { titre: 'Mots saisis librement', groupes: [], note: null };
  const source = LIBELLE_SOURCE_LISTE[l.source] || l.source;
  const titre = [l.nom ? '« ' + l.nom + ' »' : 'Liste sans nom', source].filter(Boolean).join(' · ');
  const inconnue = l.provenance === 'inconnue' || l.mots.every((m) => !m.provenance);
  const groupes = [];
  if (inconnue) {
    if (l.mots.length) groupes.push({ libelle: null, mots: l.mots.map((m) => m.mot) });
  } else {
    const parLibelle = new Map();
    for (const m of l.mots) {
      const libelle = m.provenance ? LIBELLE_PROVENANCE_MOT[m.provenance] || m.provenance : 'provenance inconnue';
      if (!parLibelle.has(libelle)) parLibelle.set(libelle, []);
      parLibelle.get(libelle).push(m.mot);
    }
    for (const [libelle, mots] of parLibelle) groupes.push({ libelle, mots });
  }
  const note = !l.mots.length ? 'liste vide'
    : inconnue ? 'provenance des mots inconnue (liste antérieure)'
    : l.provenance === 'deduite' ? 'provenance déduite du devoir'
    : null;
  return { titre, groupes, note };
}

const LIBELLE_VALIDATION = { valide: 'texte validé', rejete: 'texte refusé à la génération' };

// « 2 phrases · 11 mots · texte validé · 1 essai · reprise d'une dictée » ;
// '' si rien n'est rendu.
export function caracteristiquesDictee(d) {
  return [
    d.nbPhrases != null ? pluriel(d.nbPhrases, 'phrase') : null,
    d.nbMots != null ? pluriel(d.nbMots, 'mot') : null,
    d.validation ? LIBELLE_VALIDATION[d.validation] || 'validation : ' + d.validation : null,
    d.tentatives != null ? pluriel(d.tentatives, 'essai') + ' de génération' : null,
    d.refaitDe ? 'reprise d’une dictée précédente' : null,
  ].filter(Boolean).join(' · ');
}

export const LIBELLE_ORIGINE_DOUTE = {
  doute: { label: 'Ari a douté', cls: 'is-info' },
  contestee: { label: 'L’enfant a contesté', cls: 'is-fragile' },
};

export const LIBELLE_VERDICT_DOUTE = {
  confirme: { label: 'Faute confirmée', cls: 'is-failure' },
  infirme: { label: 'Ce n’était pas une faute', cls: 'is-success' },
  non_verifie: { label: 'Sans réponse', cls: 'is-muted' },
  conteste: { label: 'Contestée : « Ari a mal lu ma copie »', cls: 'is-fragile' },
};

const LIBELLE_REGLEE = {
  trouvee_seule: 'retrouvée sans aide',
  avec_indice: 'retrouvée avec un indice',
  montree: 'correction montrée',
};

// Un mot douteux, libellés pour un adulte non technique. Champs null omis.
export function ligneDouteuse(f) {
  const origine = LIBELLE_ORIGINE_DOUTE[f.origine] || (f.origine ? { label: f.origine, cls: 'is-muted' } : null);
  const issue = f.verdict
    ? LIBELLE_VERDICT_DOUTE[f.verdict] || { label: f.verdict, cls: 'is-muted' }
    : { label: 'Pas encore vérifiée', cls: 'is-muted' };
  const lu = f.lectureProbable != null
    ? 'Ari a lu « ' + f.lectureProbable + ' »' + (f.confiance != null ? ' (sûr à ' + Math.round(f.confiance * 100) + ' %)' : '')
    : f.confiance != null ? 'lecture sûre à ' + Math.round(f.confiance * 100) + ' %' : null;
  const suite = [
    f.texteTape != null ? 'l’enfant a retapé « ' + f.texteTape + ' »'
      : f.verifiePar === 'photo_pres' ? 'vérifiée sur une photo de près' : null,
    f.regleePar ? LIBELLE_REGLEE[f.regleePar] || f.regleePar : null,
    f.essais ? pluriel(f.essais, 'essai') + ' de correction' : null,
    f.phraseIndex != null ? 'phrase ' + (f.phraseIndex + 1) : null,
  ].filter(Boolean);
  return { mot: f.mot, origine, lu, issue, suite: suite.join(' · '), regle: f.regleCode };
}

const TYPES_JOURNAL = [
  ['ouverture', 'ouverture'],
  ['etape', 'étape', 'étapes'],
  ['verdict', 'verdict'],
  ['reglee', 'règlement'],
  ['cloture', 'clôture'],
];

// Journal d'étapes (`dictation_event` compté par type) en une ligne ;
// null si le journal n'est pas rendu ou vide. Type inconnu gardé tel quel.
export function resumeJournal(d) {
  const ev = d.evenements;
  if (!ev) return null;
  const connus = new Set(TYPES_JOURNAL.map(([t]) => t));
  const parties = TYPES_JOURNAL.filter(([t]) => ev[t]).map(([t, mot, motPluriel]) => pluriel(ev[t], mot, motPluriel));
  for (const [t, n] of Object.entries(ev)) if (!connus.has(t) && n) parties.push(t + ' × ' + n);
  return parties.length ? parties.join(' · ') : null;
}

// Paramètres de génération (champs historiques) : niveau, validation, écarts.
export function descriptionDictee(d) {
  const ecarts = Array.isArray(d.ecarts) ? d.ecarts.length : typeof d.ecarts === 'number' ? d.ecarts : null;
  return [
    d.niveau != null ? 'niveau ' + d.niveau : null,
    d.validation === 'rejete' ? 'texte refusé à la génération' : d.validation ? 'validation : ' + d.validation : null,
    d.tentatives != null ? pluriel(d.tentatives, 'tentative') : null,
    ecarts != null ? pluriel(ecarts, 'écart') : null,
  ].filter(Boolean).join(' · ');
}

// Une dictée : en-tête (heure, origine, classe, étape), texte dicté,
// fautes, journal, paramètres. avecJour : date + heure (fiche enfant).
export function carteDictee(d, { env = null, avecJour = false, avecLien = true } = {}) {
  const carte = el('div', 'dictee-item');

  const tete = el('div', 'dictee-tete');
  const quand = avecJour ? (d.creeAt ? fmtInstantParis(d.creeAt) : null) : d.heure;
  if (quand) tete.append(el('span', 'row-date', quand));
  if (d.origine) tete.append(el('span', 'dictee-origine', LIBELLE_ORIGINE_DICTEE[d.origine] || d.origine));
  if (d.titre) tete.append(el('span', 'dictee-titre', d.titre));
  if (d.classe) tete.append(el('span', 'chip is-muted', d.classe));
  const etape = etapeDictee(d);
  if (etape) {
    tete.append(el('span', 'chip ' + etape.cls, etape.label));
    if (etape.note) tete.append(el('span', 'row-muted', etape.note));
  }
  if (d.finieAt && d.etape === 'fin') tete.append(el('span', 'row-muted', 'finie à ' + heureParis(d.finieAt)));
  if (avecLien && env && d.sessionId) {
    tete.append(lien(construireHash({ env, vue: 'seances', sessionId: d.sessionId }), 'dictee-lien', 'Voir la séance →'));
  }
  carte.append(tete);

  if (d.texte) carte.append(el('p', 'dictee-texte', '« ' + d.texte + ' »'));
  else if (d.classe && d.etape === 'preparation') carte.append(el('p', 'row-muted', 'Texte pas encore généré.'));
  else if (d.classe && d.etape === 'echec') carte.append(el('p', 'row-muted', 'Aucun texte : la génération a échoué.'));

  // Ancien flux : compteurs et journal toujours à zéro, sans intérêt.
  const fautes = d.classe ? resumeFautes(d) : null;
  if (fautes) {
    const ligne = el('p', 'dictee-ligne');
    ligne.append(el('span', 'eyebrow', 'Fautes'), el('span', null, fautes));
    if (d.reglesRevues && d.reglesRevues.length) ligne.append(el('span', 'row-muted', '· règles revues :'), el('span', 'mono', d.reglesRevues.join(', ')));
    carte.append(ligne);
  }
  const caracteristiques = d.classe ? caracteristiquesDictee(d) : '';
  if (caracteristiques) carte.append(ligneDictee('Texte', caracteristiques));
  const liste = resumeListe(d);
  if (liste) carte.append(blocListe(liste));
  const douteuses = blocDouteuses(d);
  if (douteuses) carte.append(douteuses);
  const journal = d.classe ? resumeJournal(d) : null;
  if (journal) {
    const ligne = el('p', 'dictee-ligne');
    ligne.append(el('span', 'eyebrow', 'Journal'), el('span', null, journal));
    carte.append(ligne);
  }

  // Validation et essais passent dans « Dictée » quand la ligne est rendue.
  const description = descriptionDictee(caracteristiques ? { ...d, validation: null, tentatives: null } : d);
  if (description) carte.append(el('p', 'row-muted', description));
  if (Array.isArray(d.motsCibles) && d.motsCibles.length) carte.append(el('p', 'row-muted', 'Mots cibles : ' + d.motsCibles.join(', ')));
  return carte;
}

function ligneDictee(eyebrow, texte) {
  const ligne = el('p', 'dictee-ligne');
  ligne.append(el('span', 'eyebrow', eyebrow), el('span', null, texte));
  return ligne;
}

function blocListe({ titre, groupes, note }) {
  const bloc = el('div', 'dictee-ligne dictee-liste');
  bloc.append(el('span', 'eyebrow', 'Mots'));
  const corps = el('div', 'dictee-liste-corps');
  const tete = el('p', null, titre);
  if (note) tete.append(' ', el('span', 'row-muted', '· ' + note));
  corps.append(tete);
  for (const g of groupes) {
    const p = el('p', 'dictee-mots');
    if (g.libelle) p.append(el('span', 'dictee-provenance', g.libelle + ' :'), ' ');
    p.append(el('span', null, g.mots.join(', ')));
    corps.append(p);
  }
  bloc.append(corps);
  return bloc;
}

// Mots douteux (`fautes_douteuses[]`) ; null si non rendus, ou s'il n'y
// en a aucun sur une dictée pas finie (rien à dire).
function blocDouteuses(d) {
  const fautes = d.fautesDouteuses;
  if (!fautes || !d.classe) return null;
  if (!fautes.length) return d.etape === 'fin' ? ligneDictee('Douteux', 'Aucun mot douteux.') : null;
  const bloc = el('div', 'dictee-ligne dictee-douteuses');
  bloc.append(el('span', 'eyebrow', 'Douteux'));
  const liste = el('ul', 'dictee-douteuses-liste');
  for (const f of fautes) {
    const l = ligneDouteuse(f);
    const li = el('li');
    const tete = el('p', 'dictee-douteuse-tete');
    tete.append(el('span', 'dictee-douteuse-mot', l.mot != null ? '« ' + l.mot + ' »' : 'mot inconnu'));
    if (l.origine) tete.append(el('span', 'chip ' + l.origine.cls, l.origine.label));
    tete.append(el('span', 'verdict ' + l.issue.cls, l.issue.label));
    li.append(tete);
    const detail = [l.lu, l.suite].filter(Boolean).join(' · ');
    if (detail || l.regle) {
      const p = el('p', 'row-muted');
      if (detail) p.append(el('span', null, detail));
      if (l.regle) p.append(detail ? ' · ' : '', el('span', 'mono', l.regle));
      li.append(p);
    }
    liste.append(li);
  }
  bloc.append(liste);
  return bloc;
}

// Part des séances commencées en mode Dictée ; null si le mode n'est pas rendu.
export function partDictee(seances) {
  const n = seances.parMode.dictee;
  if (typeof n !== 'number') return null;
  return {
    valeur: seances.total ? Math.round((n / seances.total) * 100) + ' %' : '—',
    note: fmtEntier(n) + ' sur ' + fmtEntier(seances.total) + ' séances',
  };
}

export function listeDictees(dictees, options) {
  const liste = el('ul', 'liste-simple liste-dictees');
  for (const d of dictees) {
    const li = el('li');
    li.append(carteDictee(d, options));
    liste.append(li);
  }
  return liste;
}
