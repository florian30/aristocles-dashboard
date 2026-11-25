/* ============================================================
   Aristocles — Page « Réécoute » (REECOUTE-VOIX lot 108, actions
   `reecoute_liste` et `reecoute_evaluer`, contrat-dashboard.md
   § 2.18-2.19). Florian réécoute chaque prise de voix gardée et la
   note : OK / Pas OK, le bon texte si Pas OK, un commentaire ; ou
   « À écarter » (lot 117) avec une raison (adulte, bruit ou vide,
   autre + phrase libre) qui part dans `commentaire`.
   Ce module est PUR (testé sous Deno) : adaptateurs, filtres du
   hash, libellés, compteurs, raccourcis clavier. Le DOM est dans
   vues/reecoute.js.
   Jamais de prénom : l'Edge ne donne que `enfant` = « E-xxxxxx ».
   Les URLs signées (1 h) ne sont jamais en cache ni affichées.
   ============================================================ */

import { LIBELLE_MODE } from './libelles.js';

export const MODES_REECOUTE = ['devoirs', 'entrainement', 'dictee', 'sans_seance'];
export const LIBELLE_MODE_REECOUTE = { ...LIBELLE_MODE, sans_seance: 'Hors séance' };

// Contextes connus (`prise_voix.contexte`, Edge `stt`). La liste du
// filtre y ajoute ceux vus dans la page chargée.
export const LIBELLE_CONTEXTE = {
  correction_dictee: 'Correction de dictée',
  consigne_devoirs: 'Consigne de devoirs',
  questions_ari: 'Questions à Ari',
};

export const LIBELLE_FILTRE_STT = {
  aucun: null,
  silence: 'filtrée : silence',
  pattern: 'filtrée : phrase parasite',
  pattern_retire: 'phrase parasite retirée',
  court: 'filtrée : trop court',
  amorce: 'filtrée : amorce',
};

export const PAR_PAGE = 50;
export const VERDICTS = ['ok', 'pas_ok', 'ecarter'];
export const LIBELLE_VERDICT = { ok: 'OK', pas_ok: 'Pas OK', ecarter: 'Écartée' };

// Raisons de « À écarter » (lot 117). Le libellé part tel quel dans
// `commentaire` ; « autre » y ajoute la phrase libre : « autre : … ».
export const RAISONS_ECARTER = [
  { cle: 'adulte', libelle: 'adulte' },
  { cle: 'bruit', libelle: 'bruit ou vide' },
  { cle: 'autre', libelle: 'autre' },
];
export const LIMITE_TEXTE = 2000;

const tableau = (v) => (Array.isArray(v) ? v : []);
const texte = (v) => (typeof v === 'string' ? v : '');
const texteOuNull = (v) => (typeof v === 'string' && v ? v : null);
const entier = (v, defaut = 0) => (Number.isFinite(Number(v)) && v !== null ? Number(v) : defaut);
const nombreOuNull = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

export function adapterEvaluation(e) {
  if (!e || typeof e !== 'object' || !VERDICTS.includes(e.verdict)) return null;
  return {
    verdict: e.verdict,
    bonTexte: e.verdict === 'pas_ok' ? texteOuNull(e.bon_texte) : null, // ignoré en OK et en écartée
    commentaire: texteOuNull(e.commentaire),
    evalueLe: texteOuNull(e.evalue_le),
  };
}

function adapterPrise(p) {
  const purgee = p.etat === 'purgee' || !p.url;
  const ari = p.message_ari_avant && typeof p.message_ari_avant === 'object' ? p.message_ari_avant : null;
  const ex = p.exercice && typeof p.exercice === 'object' ? p.exercice : null;
  return {
    priseId: texte(p.prise_id),
    rang: nombreOuNull(p.rang),
    priseLe: texteOuNull(p.prise_le),
    enfant: texteOuNull(p.enfant),
    sessionId: texteOuNull(p.session_id),
    mode: texteOuNull(p.mode),
    contexte: texteOuNull(p.contexte),
    filtre: texteOuNull(p.filtre) || 'aucun',
    dureeS: nombreOuNull(p.duree_s),
    transcription: texte(p.transcription),
    interactionId: texteOuNull(p.interaction_id),
    messageAriAvant: ari ? { texte: texte(ari.texte), le: texteOuNull(ari.le) } : null,
    exercice: ex ? { code: texteOuNull(ex.code), enonce: texteOuNull(ex.enonce), reponseAttendue: ex.reponse_attendue ?? null } : null,
    purgee,
    url: purgee ? null : p.url,
    evaluation: adapterEvaluation(p.evaluation),
  };
}

export function adapterReecouteListe(data) {
  const c = data.compteurs || {};
  return {
    // `ecartees` (lot 116, additif) : absent d'une Edge d'avant → 0.
    compteurs: { total: entier(c.total), evaluees: entier(c.evaluees), pasOk: entier(c.pas_ok), ecartees: entier(c.ecartees) },
    nbResultats: entier(data.nb_resultats),
    page: entier(data.page, 1),
    parPage: entier(data.par_page, PAR_PAGE),
    nbPages: entier(data.nb_pages),
    validiteS: nombreOuNull(data.validite_s),
    expireLe: texteOuNull(data.expire_le),
    prises: tableau(data.prises).filter((p) => p && typeof p === 'object').map(adapterPrise),
  };
}

// ---------- Filtres du hash ----------
// `tout=1` : toutes les prises (par défaut : seulement les non évaluées).
// `mode=…` (liste fermée), `contexte=…` (texte libre, valeur exacte).
export function filtresDepuisQuery(query = {}) {
  return {
    nonEvaluees: query.tout !== '1',
    mode: MODES_REECOUTE.includes(query.mode) ? query.mode : null,
    contexte: typeof query.contexte === 'string' && /^[a-z0-9_]{1,60}$/.test(query.contexte) ? query.contexte : null,
  };
}

export function queryDepuisFiltres(f) {
  const q = {};
  if (!f.nonEvaluees) q.tout = '1';
  if (f.mode) q.mode = f.mode;
  if (f.contexte) q.contexte = f.contexte;
  return q;
}

export function paramsListe(f, page = 1) {
  const p = { page, par_page: PAR_PAGE, non_evaluees: f.nonEvaluees };
  if (f.mode) p.mode = f.mode;
  if (f.contexte) p.contexte = f.contexte;
  return p;
}

// Page suivante à demander. Filtre « non évaluées » : les prises notées
// sortent de la liste côté serveur, la suite est donc toujours en page 1
// (les prises déjà affichées sont écartées par `fusionnerPrises`).
export function pageSuivante(f, pageCourante) {
  return f.nonEvaluees ? 1 : pageCourante + 1;
}

// Ajoute à la liste affichée les prises pas encore vues.
export function fusionnerPrises(affichees, nouvelles) {
  const vues = new Set(affichees.map((p) => p.priseId));
  return [...affichees, ...nouvelles.filter((p) => !vues.has(p.priseId))];
}

// ---------- Grille ----------

// Ce qui part à `reecoute_evaluer`. Le bon texte n'a de sens qu'en
// Pas OK ; laissé égal à la transcription (pré-remplissage), il n'apporte
// rien : il part à null. Vide → null (le serveur fait pareil).
// « À écarter » : seul le commentaire part, fait de la raison.
export function paramsEvaluation(prise, { verdict, bonTexte, commentaire, raison, phraseAutre }) {
  const p = { prise_id: prise.priseId, verdict };
  if (verdict === 'ecarter') {
    const com = commentaireEcarter(raison, phraseAutre);
    if (com) p.commentaire = com;
    return p;
  }
  const bon = (bonTexte || '').trim().replace(/\s+/g, ' ');
  const trans = prise.transcription.trim().replace(/\s+/g, ' ');
  if (verdict === 'pas_ok' && bon && bon !== trans) p.bon_texte = bon.slice(0, LIMITE_TEXTE);
  const com = (commentaire || '').trim();
  if (com) p.commentaire = com.slice(0, LIMITE_TEXTE);
  return p;
}

// Texte de `commentaire` pour une prise écartée, ou null sans raison.
export function commentaireEcarter(raison, phraseAutre) {
  const r = RAISONS_ECARTER.find((x) => x.cle === raison);
  if (!r) return null;
  const phrase = r.cle === 'autre' ? (phraseAutre || '').trim().replace(/\s+/g, ' ') : '';
  return (phrase ? r.libelle + ' : ' + phrase : r.libelle).slice(0, LIMITE_TEXTE);
}

// Inverse : la raison et la phrase d'une prise déjà écartée. Un texte
// qui ne commence par aucune raison connue est lu comme « autre ».
export function raisonDepuisCommentaire(commentaire) {
  const c = (commentaire || '').trim();
  if (!c) return { raison: null, phraseAutre: '' };
  for (const r of RAISONS_ECARTER) {
    if (r.cle !== 'autre' && c === r.libelle) return { raison: r.cle, phraseAutre: '' };
  }
  const m = /^autre(?:\s*:\s*(.*))?$/s.exec(c);
  return { raison: 'autre', phraseAutre: m ? (m[1] || '') : c };
}

// Compteurs après une évaluation (sans recharger) : `avant` est
// l'évaluation d'avant (null = prise pas encore notée). Une prise
// écartée compte dans les évaluées (une ligne de grille) et à part.
export function compteursApres(c, avant, verdict) {
  const delta = (v) => (verdict === v ? 1 : 0) - (avant && avant.verdict === v ? 1 : 0);
  return {
    total: c.total,
    evaluees: c.evaluees + (avant ? 0 : 1),
    pasOk: c.pasOk + delta('pas_ok'),
    ecartees: (c.ecartees || 0) + delta('ecarter'),
  };
}

export function progression(c) {
  if (!c.total) return 0;
  return Math.min(100, Math.round((c.evaluees / c.total) * 1000) / 10);
}

// Prochaine carte à ouvrir après `index` : la 1re non évaluée qui suit,
// sinon la suivante tout court, sinon null (fin de la liste chargée).
export function indexSuivant(prises, index) {
  for (let k = index + 1; k < prises.length; k++) if (!prises[k].evaluation) return k;
  return index + 1 < prises.length ? index + 1 : null;
}

// Première carte à ouvrir : la 1re non évaluée, sinon la 1re.
export function indexInitial(prises) {
  const k = prises.findIndex((p) => !p.evaluation);
  return k >= 0 ? k : prises.length ? 0 : null;
}

// Raccourci clavier → action, ou null. Rien dans un champ de saisie,
// ni avec Ctrl / Cmd / Alt (raccourcis du navigateur).
export function raccourci(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const cible = e.target;
  const tag = cible && cible.tagName ? String(cible.tagName).toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || (cible && cible.isContentEditable)) return null;
  if (e.key === ' ' || e.code === 'Space') return tag === 'button' || tag === 'a' || tag === 'audio' ? null : 'ecouter';
  const k = String(e.key || '').toLowerCase();
  if (k === 'o') return 'ok';
  if (k === 'n') return 'pas_ok';
  if (k === 'e') return 'ecarter';
  return null;
}

// `reponse_attendue` est brut (forme selon le type d'exercice).
export function texteReponseAttendue(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(texteReponseAttendue).filter(Boolean).join(' · ') || null;
  if (typeof v === 'object') {
    const cles = Object.keys(v);
    if (!cles.length) return null;
    if (cles.length === 1) return texteReponseAttendue(v[cles[0]]);
    return cles.map((k) => k + ' : ' + (texteReponseAttendue(v[k]) ?? '—')).join(' · ');
  }
  return null;
}

export function libelleContexte(c) {
  return c ? LIBELLE_CONTEXTE[c] || c : null;
}

// Liste des contextes du filtre : les connus, puis ceux vus, puis le choisi.
export function optionsContexte(prises, choisi) {
  const liste = Object.keys(LIBELLE_CONTEXTE);
  for (const p of prises) if (p.contexte && !liste.includes(p.contexte)) liste.push(p.contexte);
  if (choisi && !liste.includes(choisi)) liste.push(choisi);
  return liste;
}

export function messageErreurReecoute(e, env) {
  if (e && e.status === 400) return 'Pas encore disponible sur ' + env + ' (Edge à mettre à jour), ou filtre refusé : ' + e.message;
  if (e && e.status === 404) return 'Cette prise n’existe plus (purgée). Rechargez la page.';
  return 'Échec' + (e && e.status ? ' (erreur ' + e.status + ')' : '') + (e && e.message ? ' : ' + e.message : '');
}
