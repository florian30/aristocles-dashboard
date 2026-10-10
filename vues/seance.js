/* ============================================================
   Relecture de séance (action `session_detail`) : bilan, devoir et
   consignes vues par l'enfant, puis par écran (dans l'ordre de leur
   1re activité, tel que reçu) le fil tour par tour (enfant / Ari /
   système), avec lien vers la trace IA de chaque réplique d'Ari et
   miniatures des photos (`photos_seance`, chargé après le rendu ;
   à défaut, bouton de téléchargement) ; dictée de l'écran,
   chronologie technique repliée, acquisitions.
   Le mot à mot et les sorties IA sont du contenu non fiable :
   toujours en textContent.
   ============================================================ */

import { construireHash } from '../router.js';
import { detailEnTexte, serialiserDetail } from '../ui/detail.js';
import { carteDictee } from '../ui/dictee.js';
import { el, etatErreur, lien, repliable, tableau } from '../ui/dom.js';
import { estAnnulation } from '../api.js';
import { fmtDuree, fmtDureeSec, fmtHorodatagePrecis, fmtJour, fmtJourHeure, pluriel } from '../ui/format.js';
import {
  LIBELLE_FERMETURE,
  LIBELLE_INTERACTION,
  LIBELLE_MAITRISE,
  LIBELLE_MODE,
  LIBELLE_ORIGINE,
  LIBELLE_RESULTAT,
  LIBELLE_STATUT,
  LIBELLE_TYPE_ECRAN,
  LIBELLE_VU_EN_CLASSE,
} from '../ui/libelles.js';
import { fmtJourCourt, heureParis } from '../ui/paris.js';
import { boutonPhoto, creerLotPhotos, galeriePhotos } from '../ui/photo.js';

export const titre = 'Séance';

export async function rendre({ route, api, signal }) {
  const seance = await api.detail(route.env, route.sessionId, { signal });
  const retour = lien(construireHash({ env: route.env, vue: 'seances', query: route.query }), 'reader-back', '← Retour aux séances');

  const vue = el('div', 'vue reader');
  vue.append(retour);
  if (!seance) {
    vue.append(etatErreur('Séance introuvable', 'Aucune séance « ' + route.sessionId + ' » sur ' + route.env + '.'));
    return vue;
  }

  const tete = el('div', 'reader-head');
  const titres = el('div', 'reader-titles');
  titres.append(
    el('h1', 'page-title', seance.childName),
    el('div', 'reader-sub', 'Thème : ' + (seance.theme || '—') + ' · Notion principale : ' + (seance.notion || '—')),
  );
  tete.append(titres, el('div', 'reader-meta', [
    fmtJourHeure(seance.date, seance.time),
    LIBELLE_MODE[seance.mode] || seance.mode,
    seance.classe,
    LIBELLE_STATUT[seance.status] || seance.status,
    seance.durationMin == null ? null : fmtDuree(seance.durationMin),
    pluriel(seance.exerciseCount, 'exercice'),
  ].filter(Boolean).join(' · ')));
  vue.append(tete);

  const corps = el('div', 'reader-body');
  vue.append(corps);

  const bilan = el('section', 'resume-card');
  bilan.append(el('span', 'eyebrow', 'Bilan de séance'),
    el('p', 'resume-text' + (seance.resume ? '' : ' is-empty'), seance.resume || '—'));
  corps.append(bilan);
  if (seance.homework) corps.append(carteDevoir(seance.homework));
  if (seance.mode === 'devoirs' && seance.consignes.length) corps.append(carteConsignes(seance.consignes));

  // Photos : emplacements remplis quand `photos_seance` répond.
  const photos = { parInteraction: new Map(), parEcran: new Map(), tete: el('div', 'photos-seance') };
  corps.append(photos.tete);

  corps.append(el('h2', 'section-title', 'Fil de la séance'));
  if (seance.ecrans.length === 0) corps.append(el('p', 'reader-empty', 'Aucun écran pour cette séance.'));
  const contexte = { route, api, prenom: seance.childName, photos };
  for (const ecran of seance.ecrans) corps.append(carteEcran(ecran, contexte));
  chargerPhotos(seance, contexte, signal);

  // Chronologie technique : absente tant qu'aucun événement n'est journalisé.
  if (seance.evenements.length > 0) corps.append(carteChronologie(seance.evenements));

  corps.append(el('h2', 'section-title', 'Acquisitions'));
  corps.append(tableauAcquisitions(seance.acquisitions));
  return vue;
}

function carteDevoir(d) {
  const carte = el('section', 'devoir-card');
  carte.append(el('span', 'eyebrow', 'Devoir de la séance'), el('p', 'row-name', d.titre || 'Devoir'),
    el('p', 'row-muted', [
      d.matiere,
      d.pourLe ? 'pour le ' + fmtJourCourt(d.pourLe) : null,
      d.nbConsignes != null ? pluriel(d.nbConsignes, 'consigne') : null,
    ].filter(Boolean).join(' · ') || '—'));
  return carte;
}

// DASH-4 — les consignes telles que l'enfant les a vues.
function carteConsignes(consignes) {
  const carte = el('section', 'consignes-card');
  carte.append(el('span', 'eyebrow', 'Consignes'));
  const liste = el('ol', 'consignes');
  for (const c of consignes) {
    const item = el('li', 'consigne' + (c.retiree ? ' is-retiree' : ''));
    const texte = el('p', 'consigne-texte');
    if (c.origine) {
      texte.append(el('del', 'consigne-origine', c.origine), el('span', 'consigne-fleche', ' → '), el('ins', 'consigne-corrigee', c.texte || '—'));
    } else {
      texte.append(el(c.retiree ? 's' : 'span', null, c.texte || '(consigne sans texte)'));
    }
    const drapeaux = el('div', 'consigne-flags');
    drapeaux.append(el('span', 'cell-note', 'Écran ' + c.position + (c.matiere ? ' · ' + c.matiere : '')));
    if (c.retiree) drapeaux.append(el('span', 'chip is-failure', 'Retirée par l’enfant'));
    if (c.corrigee) drapeaux.append(el('span', 'chip is-info', c.origine ? 'Corrigée par l’enfant' : 'Matière corrigée par l’enfant'));
    if (c.ajoutee) drapeaux.append(el('span', 'chip is-info', 'Ajoutée par l’enfant'));
    item.append(texte, drapeaux);
    liste.append(item);
  }
  carte.append(liste);
  return carte;
}

function carteEcran(ecran, contexte) {
  const carte = el('section', 'ecran-card');
  const tete = el('div', 'ecran-head');
  const titreEcran = el('span', 'ecran-title',
    'Écran ' + ecran.position + ' · ' + (LIBELLE_TYPE_ECRAN[ecran.type] || ecran.type));
  if (ecran.premiereActiviteAt) titreEcran.append(el('span', 'ecran-activite', ' · 1re activité ' + heureParis(ecran.premiereActiviteAt)));
  tete.append(titreEcran);
  const drapeaux = el('div', 'ecran-flags');
  const fermeture = LIBELLE_FERMETURE[ecran.statutFermeture];
  drapeaux.append(
    el('span', 'chip ' + (fermeture ? fermeture.cls : 'is-muted'), fermeture ? fermeture.label : (ecran.statutFermeture || '—')),
    // pouce_enfant : toujours null aujourd'hui, se remplira seul (lot F5).
    el('span', 'pouce', ecran.pouce === 'haut' ? '👍' : ecran.pouce === 'bas' ? '👎' : 'Pouce —'),
  );
  tete.append(drapeaux);

  const contenu = el('div', 'ecran-body');
  contenu.append(el('p', 'ecran-synthese' + (ecran.synthese ? '' : ' is-empty'), ecran.synthese || '—'));
  for (const x of ecran.exercices) contenu.append(carteExercice(x));
  if (ecran.dictee) contenu.append(blocDictee(ecran.dictee));
  const photosEcran = el('div', 'photos-ecran');
  contexte.photos.parEcran.set(ecran.id, photosEcran);
  contenu.append(photosEcran);
  contenu.append(filEcran(ecran, contexte));
  carte.append(tete, contenu);
  return carte;
}

// ---------- Fil tour par tour ----------

function filEcran(ecran, { route, prenom, photos }) {
  const bloc = el('div', 'fil-ecran');
  bloc.append(el('span', 'eyebrow', 'Mot à mot'));
  if (!ecran.interactions.length) {
    bloc.append(el('p', 'reader-empty', 'Pas de mot à mot enregistré pour cet écran.'));
    return bloc;
  }
  const fil = el('ol', 'bulles');
  for (const i of ecran.interactions) {
    if (i.locuteur === 'ari' || i.locuteur === 'enfant') fil.append(bulle(i, { route, prenom, photos }));
    else fil.append(ligneSysteme(i));
  }
  bloc.append(fil);
  return bloc;
}

function bulle(i, { route, prenom, photos }) {
  const ari = i.locuteur === 'ari';
  const item = el('li', 'bulle ' + (ari ? 'is-ari' : 'is-enfant'));
  const qui = el('span', 'bulle-qui', ari ? 'Ari' : prenom);
  if (!ari && LIBELLE_INTERACTION[i.type]) qui.append(el('span', 'bulle-type', ' · ' + LIBELLE_INTERACTION[i.type]));
  qui.append(el('span', 'bulle-heure', heureParis(i.createdAt) || ''));
  item.append(qui);

  if (i.texte) item.append(el('p', 'bulle-texte', i.texte));
  else if (!i.aPhoto) item.append(el('p', 'bulle-texte is-empty', '(sans texte)'));

  const actions = el('div', 'bulle-actions');
  if (i.aPhoto) {
    const emplacement = el('span', 'photo-emplacement', 'Photo…');
    photos.parInteraction.set(i.id, emplacement);
    actions.append(emplacement);
  }
  if (ari && i.generationId) {
    actions.append(lien(construireHash({ env: route.env, vue: 'seances', sessionId: route.sessionId, generationId: i.generationId, query: route.query }), 'lien-trace', 'Voir la trace IA'));
  }
  if (ari && i.modele) actions.append(el('span', 'cell-note mono', i.modele));
  if (actions.childNodes.length) item.append(actions);
  return item;
}

function ligneSysteme(i) {
  const item = el('li', 'fil-systeme');
  let texte = LIBELLE_INTERACTION[i.type] || i.type;
  if (i.type === 'pouce_haut_bas') {
    const valeur = i.metadata && i.metadata.valeur;
    texte += valeur === 'haut' ? ' 👍' : valeur === 'bas' ? ' 👎' : '';
  }
  if (i.type === 'exercice_resolu' && i.metadata && i.metadata.resultat) {
    const r = LIBELLE_RESULTAT[i.metadata.resultat];
    texte += ' — ' + (r ? r.label : i.metadata.resultat);
  }
  item.append(el('span', 'bulle-heure', heureParis(i.createdAt) || ''), el('span', null, texte));
  if (i.texte) item.append(el('span', 'fil-systeme-texte', i.texte));
  const meta = detailEnTexte(i.type === 'exercice_presente' ? sansChampsConsigne(i.metadata) : i.metadata);
  if (meta) item.append(el('span', 'fil-systeme-meta mono', meta));
  return item;
}

// Champs déjà rendus par le bloc Consignes : pas de JSON brut en double.
function sansChampsConsigne(m) {
  if (!m || typeof m !== 'object') return m;
  const { enonce_origine: _o, corrige_par_enfant: _c, ajoute_par_enfant: _a, matiere: _m, ...reste } = m;
  return Object.keys(reste).length ? reste : null;
}

// Miniatures : dans la bulle de la capture (interaction_id), sinon au
// niveau de l'écran (dictée), sinon en tête du fil. Si l'action manque
// (Edge pas à jour) ou échoue, retour au bouton de téléchargement.
async function chargerPhotos(seance, { route, api, photos }, signal) {
  if (!photos.parInteraction.size && !seance.ecrans.some((e) => e.dictee)) return;
  let lot = null;
  try {
    const r = await api.photosSeance(route.env, seance.id, { signal });
    if (r) lot = creerLotPhotos({ api, env: route.env, sessionId: seance.id, photos: r.photos });
  } catch (e) {
    if (estAnnulation(e)) return;
  }
  if (signal && signal.aborted) return;
  const servies = new Set();
  if (lot) {
    const groupes = new Map();
    for (const p of lot.photos) {
      const cible = (p.interactionId && photos.parInteraction.get(p.interactionId)) ||
        photos.parEcran.get(p.ecranId) || photos.tete;
      if (!groupes.has(cible)) groupes.set(cible, []);
      groupes.get(cible).push(p);
      if (p.interactionId) servies.add(p.interactionId);
    }
    for (const [cible, liste] of groupes) {
      if (cible === photos.tete) cible.append(el('span', 'eyebrow', 'Photos de la séance'));
      if (cible.classList.contains('photo-emplacement')) cible.textContent = '';
      cible.append(galeriePhotos(liste, lot));
    }
  }
  for (const [id, emplacement] of photos.parInteraction) {
    if (servies.has(id)) continue;
    emplacement.textContent = '';
    emplacement.append(boutonPhoto({ api, env: route.env, interactionId: id }));
  }
}

function blocDictee(d) {
  const bloc = el('div', 'exercise-detail-block dictee-bloc');
  bloc.append(el('span', 'eyebrow', 'Dictée'), carteDictee(d, { avecLien: false }));
  if (d.ecarts != null && (!Array.isArray(d.ecarts) || d.ecarts.length)) {
    bloc.append(el('pre', 'json-bloc', typeof d.ecarts === 'object' ? JSON.stringify(d.ecarts, null, 2) : String(d.ecarts)));
  }
  return bloc;
}

function carteExercice(x) {
  const identite = el('div', 'exercise-id');
  identite.append(
    el('span', 'exercise-notion', x.notions.length ? x.notions.join(' · ') : 'Exercice'),
    el('span', 'exercise-meta', [LIBELLE_ORIGINE[x.origine] || x.origine, fmtDureeSec(x.dureeSec)].filter(Boolean).join(' · ')),
  );
  const resultat = LIBELLE_RESULTAT[x.resultat];
  const verdict = el('span', 'verdict ' + (resultat ? resultat.cls : 'is-muted'), resultat ? resultat.label : x.resultat);

  if (!x.enonce) {
    const carte = el('div', 'exercise-card');
    const resume = el('div', 'repliable-resume');
    resume.append(identite, verdict);
    carte.append(resume);
    return carte;
  }
  const bloc = el('div', 'exercise-detail-block');
  bloc.append(el('span', 'eyebrow', 'Énoncé'), el('p', null, x.enonce));
  return repliable({ classe: 'exercise-card', entete: [identite, verdict], contenu: [bloc] });
}

// Trace brute du pipeline voix (déclencheurs, tours, TTS). Les
// `detail` imbriqués sortent en JSON indenté.
function carteChronologie(evenements) {
  const liste = el('ol', 'chrono-events');
  for (const ev of evenements) {
    const item = el('li', 'chrono-event');
    const { ligne, blocs } = serialiserDetail(ev.detail);
    item.append(el('span', 'chrono-ligne',
      fmtHorodatagePrecis(ev.ts) + ' · ' + ev.type + (ligne ? ' · ' + ligne : '')));
    for (const b of blocs) item.append(el('pre', 'chrono-json', (b.cle ? b.cle + ' : ' : '') + b.json));
    liste.append(item);
  }
  return repliable({
    classe: 'chrono-card',
    entete: [el('span', 'chrono-title', 'Chronologie technique'), el('span', 'chrono-count', pluriel(evenements.length, 'événement'))],
    contenu: [liste],
  });
}

function tableauAcquisitions(acquisitions) {
  return tableau({
    classe: 'acq-table',
    colonnes: [
      { titre: 'Notion' },
      { titre: 'Maîtrise', largeur: '180px' },
      { titre: 'Vu en classe', largeur: '140px' },
      { titre: 'Mise à jour', classe: 'cell-right', largeur: '120px' },
    ],
    lignes: acquisitions.map((a) => {
      const m = LIBELLE_MAITRISE[a.maitrise];
      return [
        el('span', 'row-name', a.notion || '—'),
        el('span', 'acq-maitrise ' + (m ? m.cls : ''), m ? m.label : a.maitrise),
        LIBELLE_VU_EN_CLASSE[a.vuEnClasse] || a.vuEnClasse,
        a.majDate ? fmtJour(a.majDate) : '—',
      ];
    }),
    // Liste maigre attendue hors CM1 tant que le pont notions (F1) manque.
    vide: 'Aucune acquisition enregistrée pour cet enfant.',
  });
}
