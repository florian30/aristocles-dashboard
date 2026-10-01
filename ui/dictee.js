/* ============================================================
   Aristocles — Rubrique Dictée (DICT-12), partagée par La veille,
   la fiche enfant et la relecture de séance.
   Les fonctions de libellé sont pures (testées sous Deno) ; un
   champ absent (Edge pas encore à jour) donne null et la partie
   correspondante n'est pas affichée. Le texte dicté et les codes
   de règle viennent du serveur : textContent uniquement.
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

// « 2 fautes comptées · 1 réglée » ; null si le compte n'est pas rendu.
export function resumeFautes(d) {
  if (d.nbFautes == null) return null;
  const parties = [d.nbFautes ? pluriel(d.nbFautes, 'faute comptée', 'fautes comptées') : 'Aucune faute comptée'];
  const reglees = d.evenements?.reglee;
  if (reglees) parties.push(reglees + (reglees > 1 ? ' réglées' : ' réglée'));
  return parties.join(' · ');
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
  const journal = d.classe ? resumeJournal(d) : null;
  if (journal) {
    const ligne = el('p', 'dictee-ligne');
    ligne.append(el('span', 'eyebrow', 'Journal'), el('span', null, journal));
    carte.append(ligne);
  }

  const description = descriptionDictee(d);
  if (description) carte.append(el('p', 'row-muted', description));
  if (Array.isArray(d.motsCibles) && d.motsCibles.length) carte.append(el('p', 'row-muted', 'Mots cibles : ' + d.motsCibles.join(', ')));
  return carte;
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
