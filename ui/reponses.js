/* ============================================================
   Aristocles — Ce que l'enfant a répondu (DASH-REPONSES-UI, lot 46)
   L'Edge rend `ecrans[].reponses_exercices[]` (contrat v2.14, § 2.3) :
   une entrée par exercice et par question de quizz, dans l'ordre du
   mot à mot, avec chaque tentative et son verdict.
   Dans le fil, l'encart d'un exercice se pose juste après sa ligne
   « exercice résolu » (même `exercise_id`) — à défaut après sa
   présentation —, celui d'une question de quizz après son verdict
   (`reponse_quizz`, même numéro). Une entrée sans repère se pose en
   bloc après le dernier tour de son écran.
   Champ absent (Edge d'avant, prod non déployée) ou vide : rien.
   Les réponses sont du contenu de l'enfant : toujours en textContent.
   ============================================================ */

import { el } from './dom.js';
import { heureParis } from './paris.js';

const tableau = (v) => (Array.isArray(v) ? v : []);
const entier = (v) => (Number.isInteger(v) ? v : null);
const booleen = (v) => (typeof v === 'boolean' ? v : null);
const texte = (v) => (typeof v === 'string' && v.trim() ? v : null);

// Une entrée brute de `reponses_exercices[]` → la forme du front.
export function adapterReponseExercice(r) {
  return {
    source: r?.source === 'quizz' ? 'quizz' : 'exercice',
    exerciseId: r?.exercise_id || null,
    numeroQuizz: entier(r?.numero_quizz),
    typeExercice: texte(r?.type_exercice),
    oral: booleen(r?.oral),
    enonce: texte(r?.enonce),
    presenteAt: r?.presente_at || null,
    resoluAt: r?.resolu_at || null,
    resultat: r?.resultat || null,
    correct: booleen(r?.correct),
    nbTentatives: entier(r?.nb_tentatives),
    reponsesEnregistrees: r?.reponses_enregistrees === true,
    tentatives: tableau(r?.tentatives).map((t, k) => ({
      numero: entier(t?.numero) ?? k + 1,
      at: t?.at || null,
      reponse: texte(t?.reponse),
      canal: t?.canal || null,
      correcte: booleen(t?.correcte),
    })),
    parolesEnfant: tableau(r?.paroles_enfant).map((p) => ({ at: p?.at || null, texte: texte(p?.texte), canal: p?.canal || null })),
  };
}

// `reponses_exercices` d'un écran brut → [] s'il est absent ou mal formé.
export const adapterReponsesExercices = (brut) => tableau(brut).map(adapterReponseExercice);

// Types d'exercice en clair (`metadata.type` d'exercice_presente).
export const LIBELLE_TYPE_EXERCICE = {
  qcm: 'choix multiple',
  saisie: 'réponse à taper',
  vrai_faux: 'vrai ou faux',
};

// Le résultat en français simple, avec sa couleur.
export function libelleResultat(r) {
  if (r.source === 'quizz') {
    if (r.resultat === 'juste') return { label: 'juste', cls: 'is-success' };
    if (r.resultat === 'pas_trouve') return { label: 'pas trouvé', cls: 'is-fragile' };
  } else {
    if (r.resultat === 'succes') return { label: 'juste du premier coup', cls: 'is-success' };
    if (r.resultat === 'fragile') {
      // Contrat : fragile = juste après plusieurs essais, ou passé ; un
      // seul essai, c'est forcément « passé ».
      return r.nbTentatives === 1
        ? { label: 'passé', cls: 'is-fragile' }
        : { label: 'juste après plusieurs essais, ou passé', cls: 'is-fragile' };
    }
  }
  if (r.resultat == null) return { label: 'pas terminé', cls: 'is-muted' };
  return { label: r.resultat, cls: 'is-muted' };
}

// Le titre de l'encart : « Exercice · choix multiple · à l'écran ».
export function titreReponse(r) {
  const morceaux = [r.source === 'quizz' ? 'Quiz · question ' + (r.numeroQuizz ?? '?') : 'Exercice'];
  if (r.typeExercice) morceaux.push(LIBELLE_TYPE_EXERCICE[r.typeExercice] || r.typeExercice);
  if (r.source !== 'quizz' && r.oral === true) morceaux.push('à l’oral');
  if (r.source !== 'quizz' && r.oral === false) morceaux.push('à l’écran');
  return morceaux.join(' · ');
}

export const NON_ENREGISTREE = 'vérifiée à l’écran, réponse non enregistrée';
const CANAL = { voix: 'dit', texte: 'tapé', ecran: 'à l’écran' };

// Une tentative en morceaux : { numero, heure, reponse, enregistree, verdict }.
export function ligneTentative(t, r) {
  const enregistree = r.reponsesEnregistrees && t.reponse != null;
  return {
    numero: 'Essai ' + t.numero,
    heure: heureParis(t.at) || null,
    reponse: enregistree ? '« ' + t.reponse + ' »' + (CANAL[t.canal] && t.canal !== 'ecran' ? ' (' + CANAL[t.canal] + ')' : '') : NON_ENREGISTREE,
    enregistree,
    verdict: t.correcte === true ? 'juste' : t.correcte === false ? 'faux' : null,
  };
}

// L'encart d'une entrée (élément <li> du fil).
export function encartReponse(r) {
  const item = el('li', 'fil-reponse');
  const carte = el('div', 'reponse-encart');
  const tete = el('div', 'reponse-tete');
  const resultat = libelleResultat(r);
  tete.append(el('span', 'reponse-titre', titreReponse(r)), el('span', 'reponse-resultat ' + resultat.cls, resultat.label));
  carte.append(tete);
  if (r.enonce) carte.append(el('p', 'reponse-enonce', r.enonce));

  if (!r.tentatives.length) {
    carte.append(el('p', 'reponse-vide', r.nbTentatives
      ? r.nbTentatives + (r.nbTentatives > 1 ? ' essais' : ' essai') + ', ' + NON_ENREGISTREE
      : 'Aucun essai enregistré.'));
  } else {
    const liste = el('ol', 'reponse-tentatives');
    for (const t of r.tentatives) {
      const l = ligneTentative(t, r);
      const ligne = el('li', 'reponse-tentative');
      ligne.append(el('span', 'reponse-numero', l.numero));
      if (l.heure) ligne.append(el('span', 'bulle-heure', l.heure));
      ligne.append(el('span', 'reponse-texte' + (l.enregistree ? '' : ' is-empty'), l.reponse));
      if (l.verdict) ligne.append(el('span', 'reponse-verdict ' + (l.verdict === 'juste' ? 'is-success' : 'is-fragile'), l.verdict));
      liste.append(ligne);
    }
    carte.append(liste);
  }
  item.append(carte);
  return item;
}

// Où poser chaque encart dans le fil.
// → { apres: Map(id d'interaction → [entrées]), finEcran: Map(écran → [entrées]) }.
export function placerReponses(ecrans) {
  const apres = new Map();
  const finEcran = new Map();
  const ajouter = (carte, cle, r) => {
    if (!carte.has(cle)) carte.set(cle, []);
    carte.get(cle).push(r);
  };
  for (const ecran of ecrans) {
    const pris = new Set();
    for (const r of tableau(ecran.reponses)) {
      const repere = repereDansLeFil(ecran.interactions, r, pris);
      if (repere) {
        pris.add(repere.id);
        ajouter(apres, repere.id, r);
      } else ajouter(finEcran, ecran, r);
    }
  }
  return { apres, finEcran };
}

// L'interaction du mot à mot qui clôt l'entrée (pas déjà prise par une
// entrée précédente : un même exercice peut revenir deux fois).
function repereDansLeFil(interactions, r, pris) {
  const libre = (i) => i.id && !pris.has(i.id);
  const m = (i) => i.metadata || {};
  if (r.source === 'quizz') {
    if (r.numeroQuizz == null) return null;
    return interactions.find((i) => libre(i) && i.type === 'reponse_quizz' && m(i).numero === r.numeroQuizz) || null;
  }
  if (!r.exerciseId) return null;
  const pour = (type) => interactions.find((i) => libre(i) && i.type === type && m(i).exercise_id === r.exerciseId);
  return pour('exercice_resolu') || pour('exercice_presente') || null;
}

// Les entrées « fin d'écran » vont après le dernier tour de l'écran dans
// le fil : → Set des index d'éléments du fil après lesquels les poser.
export function derniersToursParEcran(elements) {
  const dernier = new Map();
  elements.forEach((x, k) => {
    if (x.interaction && x.ecran) dernier.set(x.ecran, k);
  });
  return dernier;
}
