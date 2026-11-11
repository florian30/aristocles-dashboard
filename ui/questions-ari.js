/* ============================================================
   Aristocles — Section « Questions à Ari » de la fiche enfant
   (GAMIF-L15, action `questions_ari`, contrat v2.11 § 2.17).
   Le mot à mot de l'écran « Pose-moi des questions », un jour
   civil de Paris à la fois : question de l'enfant, réponse d'Ari,
   heure, et l'écoute de la question quand la prise de voix existe
   encore. Lecture testeurs seulement : jamais dans une vue parent.
   Le jour vit dans la query du hash (`qjour=AAAA-MM-JJ`, hier par
   défaut), mis à jour sans recharger la fiche. Les URLs signées
   valent 1 h : jamais affichées, jamais en cache ; si un lecteur ne
   charge plus, « Recharger » redemande le jour. Texte en textContent.
   ============================================================ */

import { estAnnulation } from '../api.js';
import { construireHash } from '../router.js';
import { el } from './dom.js';
import { pluriel } from './format.js';
import { estDateCivile, fmtJourCourt, fmtJourTitre, heureParis, hierParis, navigationJour } from './paris.js';

export const TEXTE_VOIX_EFFACEE = 'voix effacée après 30 jours';
export const TEXTE_SANS_REPONSE = 'Ari n’a pas pu répondre';
export const PARAM_JOUR = 'qjour';

// Jour demandé par le hash ; hier (Paris) si absent, mal formé ou futur.
export function jourQuestions(query = {}, maintenant = new Date()) {
  const j = query[PARAM_JOUR];
  if (!estDateCivile(j) || navigationJour(j, maintenant).estFutur) return hierParis(maintenant);
  return j;
}

// Échanges du jour, à plat, dans l'ordre chronologique (l'Edge les
// groupe par jour ; une réponse sur `date` n'a qu'un groupe ou aucun).
export function echangesDuJour(lot, jour) {
  return lot.jours.filter((j) => j.jour === jour).flatMap((j) => j.echanges);
}

// Ce que montre la bulle de la question : lecteur, mention, ou rien.
export function etatVoixQuestion(voix) {
  if (!voix) return 'aucune';
  return voix.etat === 'ok' && voix.url ? 'ok' : 'effacee';
}

// Message d'erreur de l'action → texte de la section. 400 : l'Edge de
// l'environnement ne connaît pas encore l'action.
export function messageErreurQuestions(e, env) {
  if (e && e.status === 400) return 'Pas encore disponible sur ' + env + ' (Edge à mettre à jour).';
  return 'Impossible de charger les questions' + (e && e.status ? ' (erreur ' + e.status + ')' : '') + '.';
}

function lecteur(voix, onPanne) {
  const audio = el('audio', 'voix-lecteur');
  audio.setAttribute('controls', '');
  audio.setAttribute('preload', 'none');
  audio.setAttribute('src', voix.url);
  audio.setAttribute('aria-label', 'Écouter la question' + (voix.priseLe ? ' de ' + heureParis(voix.priseLe) : ''));
  audio.addEventListener('error', () => onPanne(), { once: true });
  return audio;
}

export function carteEchange(e, prenom, surPanne) {
  const li = el('li', 'question-ari');
  const fil = el('ol', 'bulles');

  const question = el('li', 'bulle is-enfant');
  const qui = el('span', 'bulle-qui', prenom);
  qui.append(el('span', 'bulle-heure', heureParis(e.poseeLe) || '—'));
  question.append(qui, el('p', 'bulle-texte' + (e.question.trim() ? '' : ' is-empty'), e.question.trim() || '(question vide)'));
  const voix = etatVoixQuestion(e.voix);
  if (voix === 'ok') question.append(lecteur(e.voix, surPanne));
  if (voix === 'effacee') question.append(el('span', 'voix-effacee', TEXTE_VOIX_EFFACEE));

  const reponse = el('li', 'bulle is-ari');
  const ari = el('span', 'bulle-qui', 'Ari');
  if (e.promptVersion) ari.append(el('span', 'bulle-type', '· prompt v' + e.promptVersion));
  reponse.append(ari, el('p', 'bulle-texte' + (e.reponse ? '' : ' is-empty'), e.reponse || TEXTE_SANS_REPONSE));

  fil.append(question, reponse);
  li.append(fil);
  return li;
}

// La section entière. `route` : celle de la fiche (env, childId, query).
export function sectionQuestionsAri({ api, route, prenom, signal }) {
  let jour = jourQuestions(route.query);
  const bloc = el('div', 'questions-ari');
  const tete = el('div', 'questions-ari-tete');
  const titreJour = el('span', 'row-name');
  const nav = el('div', 'day-nav');
  const contenu = el('div', 'questions-ari-contenu');
  tete.append(titreJour, nav);
  bloc.append(tete, contenu);

  let appel = 0;
  const aller = (j) => {
    jour = j;
    const query = { ...route.query, [PARAM_JOUR]: j === hierParis() ? null : j };
    try {
      history.replaceState(null, '', construireHash({ ...route, query }));
    } catch { /* hors navigateur */ }
    charger();
  };

  const fleche = (cible, signe, libelle) => {
    const b = el('button', 'day-arrow', signe);
    b.type = 'button';
    if (cible) {
      b.setAttribute('aria-label', libelle + ' (' + fmtJourCourt(cible) + ')');
      b.title = libelle;
      b.addEventListener('click', () => aller(cible));
    } else {
      b.disabled = true;
      b.classList.add('is-disabled');
      b.title = 'Pas de jour suivant';
    }
    return b;
  };

  function dessinerNav() {
    const n = navigationJour(jour);
    const titre = jour === n.hier ? 'Hier' : jour === n.aujourdhui ? 'Aujourd’hui (en cours)' : null;
    titreJour.textContent = (titre ? titre + ' · ' : '') + fmtJourTitre(jour);
    const choix = el('input', 'day-picker');
    choix.type = 'date';
    choix.value = jour;
    choix.max = n.aujourdhui;
    choix.setAttribute('aria-label', 'Choisir le jour des questions');
    choix.addEventListener('change', () => {
      if (estDateCivile(choix.value) && choix.value <= n.aujourdhui) aller(choix.value);
    });
    nav.textContent = '';
    nav.append(fleche(n.precedent, '‹', 'Jour précédent'), fleche(n.suivant, '›', 'Jour suivant'), choix);
  }

  async function charger() {
    const moi = ++appel;
    dessinerNav();
    contenu.textContent = '';
    contenu.append(el('p', 'reader-empty', 'Chargement des questions…'));
    let lot;
    try {
      lot = await api.questionsAri(route.env, route.childId, jour, { signal });
    } catch (e) {
      if (estAnnulation(e) || moi !== appel) return;
      contenu.textContent = '';
      const reessayer = el('button', 'bouton', 'Réessayer');
      reessayer.type = 'button';
      reessayer.addEventListener('click', () => charger());
      contenu.append(el('p', 'reader-empty', messageErreurQuestions(e, route.env)), reessayer);
      return;
    }
    if (moi !== appel) return;
    contenu.textContent = '';
    const echanges = lot ? echangesDuJour(lot, jour) : [];
    if (!echanges.length) {
      contenu.append(el('p', 'reader-empty', 'Aucune question à Ari ce jour-là. Les flèches mènent aux jours voisins.'));
      return;
    }

    let recharge = false;
    const surPanne = () => {
      if (recharge || contenu.querySelector('.voix-recharger')) return;
      const bouton = el('button', 'bouton voix-recharger', 'Recharger les enregistrements');
      bouton.type = 'button';
      bouton.addEventListener('click', () => {
        recharge = true;
        charger();
      });
      contenu.prepend(bouton);
    };

    contenu.append(el('p', 'cell-note', pluriel(echanges.length, 'question')));
    const liste = el('ol', 'questions-ari-liste');
    for (const e of echanges) liste.append(carteEchange(e, prenom, surPanne));
    contenu.append(liste);
  }

  charger();
  return bloc;
}
