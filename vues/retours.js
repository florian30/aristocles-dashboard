/* ============================================================
   Retours parents « Votre avis » (AVIS-3, contrat-dashboard.md
   § 2.13 à 2.15).
   · #/{env}/retours : la liste (action `retours`, 92 derniers jours),
     filtre de statut dans le hash (?statut=…), compteurs par statut ;
   · #/{env}/retours/{id} : le détail (action `retour`, JAMAIS mis en
     cache) — texte en entier, contexte, capture en miniature (URL
     signée d'1 h, « Recharger » la redemande), fil d'usage du même
     lancement, erreurs des 7 jours d'avant, lien vers la séance ;
     « Marquer lu », statut et référence registre (`retour_statut`,
     la seule écriture du dashboard), « Copier la fiche ».
   Le texte des parents et tout ce qui vient de l'app sont du contenu
   non fiable : toujours en textContent.
   ============================================================ */

import { estAnnulation } from '../api.js';
import { construireHash, naviguer } from '../router.js';
import { champsLibres, lienSeance } from '../ui/blocs.js';
import { boutonCopier, el, etatErreur, lien, tableau } from '../ui/dom.js';
import { pluriel } from '../ui/format.js';
import { LIBELLE_MODE, LIBELLE_PLATEFORME } from '../ui/libelles.js';
import { fmtInstantParis } from '../ui/paris.js';
import {
  auteurRetour,
  CLASSE_STATUT_RETOUR,
  detailCourt,
  LIBELLE_CATEGORIE,
  LIBELLE_OU,
  LIBELLE_SAISIE,
  LIBELLE_STATUT_RETOUR,
  libelleNouveaux,
  lireRefRegistre,
  resumeApp,
  statutDepuisQuery,
} from '../ui/retours.js';

export { libelleNouveaux };

export const titre = 'Retours';

export function rendre(contexte) {
  return contexte.route.retourId ? rendreDetail(contexte) : rendreListe(contexte);
}

const chipStatut = (statut) => el('span', 'chip ' + (CLASSE_STATUT_RETOUR[statut] || ''), LIBELLE_STATUT_RETOUR[statut] || statut);
const libelle = (table, v, defaut = '—') => (v ? table[v] || v : defaut);

// ---------- Liste ----------

async function rendreListe({ route, api, signal }) {
  const statut = statutDepuisQuery(route.query);
  const l = await api.retours(route.env, { statut }, { signal });

  const vue = el('div', 'vue vue-retours');
  const tete = el('div', 'page-head');
  const total = Object.values(l.compteurs).reduce((a, b) => a + b, 0);
  tete.append(el('h1', 'page-title', 'Retours des parents'), el('span', 'page-count', pluriel(total, 'retour') + ' sur 92 jours'));
  vue.append(tete, el('p', 'bloc-explication',
    'Ce que les parents écrivent depuis « Votre avis sur l’application ». Ouvrir un retour ne le marque pas lu ; « Copier la fiche » donne le bloc à coller dans Claude Code pour l’inscrire au registre.'));

  // Filtre : « Tous » puis un bouton par statut, avec son compteur.
  const filtres = el('div', 'chips-ligne');
  filtres.append(el('span', 'eyebrow', 'Statut'));
  const bouton = (valeur, texte) => {
    const a = lien(construireHash({ env: route.env, vue: 'retours', query: valeur ? { statut: valeur } : {} }),
      'bouton bouton-filtre' + (valeur === statut ? ' is-active' : ''), texte);
    if (valeur === statut) a.setAttribute('aria-current', 'true');
    return a;
  };
  filtres.append(bouton(null, 'Tous (' + total + ')'));
  for (const s of Object.keys(LIBELLE_STATUT_RETOUR)) filtres.append(bouton(s, LIBELLE_STATUT_RETOUR[s] + ' (' + l.compteurs[s] + ')'));
  vue.append(filtres);

  vue.append(tableau({
    classe: 'retours-table',
    colonnes: [
      { titre: 'Reçu', largeur: '130px' },
      { titre: 'De', largeur: '1.2fr' },
      { titre: 'Catégorie · où', largeur: '1fr' },
      { titre: 'Extrait', largeur: '2.4fr' },
      { titre: 'Statut', largeur: '150px' },
    ],
    lignes: l.retours.map((r) => {
      const qui = el('span', 'row-name', auteurRetour(r));
      if (r.parentEmail) qui.append(el('span', 'cell-note', r.parentEmail));
      const extrait = el('span', null, r.extrait || '—');
      if (r.aCapture) extrait.append(el('span', 'chip is-info chip-sans-echange', 'capture'));
      const etat = el('span');
      etat.append(chipStatut(r.statut));
      if (r.refRegistre) etat.append(el('span', 'cell-note mono', r.refRegistre));
      return {
        href: construireHash({ env: route.env, vue: 'retours', retourId: r.id, query: route.query }),
        classe: r.statut === 'nouveau' ? 'is-nouveau' : '',
        cellules: [
          fmtInstantParis(r.creeLe),
          qui,
          libelle(LIBELLE_CATEGORIE, r.categorie) + ' · ' + libelle(LIBELLE_OU, r.ou),
          extrait,
          etat,
        ],
      };
    }),
    vide: statut ? 'Aucun retour « ' + LIBELLE_STATUT_RETOUR[statut] + ' » sur 92 jours.' : 'Aucun retour de parent sur 92 jours.',
  }));
  return vue;
}

// ---------- Détail ----------

async function rendreDetail({ route, api, signal }) {
  const d = await api.retour(route.env, route.retourId, { signal });
  const vue = el('div', 'vue reader vue-retour');
  vue.append(lien(construireHash({ env: route.env, vue: 'retours', query: route.query }), 'reader-back', '← Retour à la liste'));
  if (!d) {
    vue.append(etatErreur('Retour introuvable', 'Aucun retour « ' + route.retourId + ' » sur ' + route.env + '.'));
    return vue;
  }
  const r = d.retour;

  const tete = el('div', 'reader-head');
  const titres = el('div', 'reader-titles');
  const sous = el('div', 'reader-sub', auteurRetour(r) + (r.parentEmail ? ' · ' + r.parentEmail : ''));
  titres.append(el('h1', 'page-title', 'Retour du ' + fmtInstantParis(r.creeLe)), sous);
  const meta = el('div', 'chips-ligne');
  meta.append(chipStatut(r.statut));
  if (r.refRegistre) meta.append(el('span', 'chip mono', r.refRegistre));
  meta.append(el('span', 'cell-note', [
    libelle(LIBELLE_CATEGORIE, r.categorie, 'catégorie non précisée'),
    libelle(LIBELLE_OU, r.ou, 'lieu non précisé'),
    r.saisie ? libelle(LIBELLE_SAISIE, r.saisie) + (r.prisesVoix ? ' (' + pluriel(r.prisesVoix, 'prise') + ' de voix)' : '') : null,
  ].filter(Boolean).join(' · ')));
  tete.append(titres, meta);
  vue.append(tete);

  const corps = el('div', 'reader-body');
  vue.append(corps);
  corps.append(blocActions(d, { route, api }));

  const texte = el('section', 'resume-card');
  texte.append(el('span', 'eyebrow', 'Ce que le parent a écrit'), el('p', 'champ-texte', r.texte || '—'));
  corps.append(texte);

  corps.append(el('h2', 'section-title', 'Contexte'), blocContexte(d, route));
  corps.append(el('h2', 'section-title', 'Capture d’écran'), blocCapture(d.capture, { route, api }));
  corps.append(el('h2', 'section-title', 'Fil d’usage du lancement'), blocFil(d));
  corps.append(el('h2', 'section-title', 'Erreurs client des 7 jours d’avant'), blocErreurs(d));
  return vue;
}

// « Marquer lu », statut + référence registre, « Copier la fiche ».
function blocActions(d, { route, api }) {
  const r = d.retour;
  const bloc = el('section', 'sous-bloc retour-actions');
  const ligne = el('div', 'messages-actions');

  const ecrire = async (statut, ref, boutonActif, message) => {
    boutonActif.disabled = true;
    message.textContent = 'Enregistrement…';
    try {
      await api.retourStatut(route.env, r.id, statut, ref);
      naviguer(route); // relit le détail (jamais en cache) ; liste et pastille sont vidées du cache
    } catch (e) {
      if (estAnnulation(e)) return;
      boutonActif.disabled = false;
      message.textContent = 'Échec : ' + e.message;
    }
  };

  const message = el('p', 'form-erreur');
  message.setAttribute('role', 'status');

  if (r.statut === 'nouveau') {
    const lu = el('button', 'bouton bouton-principal', 'Marquer lu');
    lu.type = 'button';
    lu.addEventListener('click', () => ecrire('lu', undefined, lu, message));
    ligne.append(lu);
  }
  ligne.append(boutonCopier(d.fiche, 'Copier la fiche'));

  // Statut + référence : la référence vide efface celle d'avant.
  const form = el('form', 'form-ligne retour-statut');
  const champStatut = el('label', 'form-champ');
  const select = el('select', 'form-input');
  for (const [valeur, texte] of Object.entries(LIBELLE_STATUT_RETOUR)) {
    const o = el('option', null, texte);
    o.value = valeur;
    if (valeur === r.statut) o.selected = true;
    select.append(o);
  }
  champStatut.append(el('span', 'form-label', 'Statut'), select);
  const champRef = el('label', 'form-champ');
  const ref = el('input', 'form-input mono');
  ref.type = 'text';
  ref.placeholder = 'R-JJMM-sujet';
  ref.maxLength = 60;
  ref.value = r.refRegistre || '';
  champRef.append(el('span', 'form-label', 'Référence registre'), ref);
  const enregistrer = el('button', 'bouton', 'Enregistrer');
  enregistrer.type = 'submit';
  const champBouton = el('div', 'form-champ');
  champBouton.append(el('span', 'form-label', ' '), enregistrer);
  form.append(champStatut, champRef, champBouton);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const lecture = lireRefRegistre(ref.value);
    champRef.classList.toggle('is-invalide', Boolean(lecture.erreur));
    if (lecture.erreur) {
      message.textContent = lecture.erreur;
      return;
    }
    ecrire(select.value, lecture.valeur, enregistrer, message);
  });

  bloc.append(ligne, form, message);
  return bloc;
}

function blocContexte(d, route) {
  const r = d.retour;
  const liste = el('dl', 'champs');
  const ajouter = (titre, valeur) => {
    liste.append(el('dt', 'eyebrow', titre));
    const dd = el('dd');
    dd.append(valeur instanceof Node ? valeur : el('p', 'champ-texte', valeur || '—'));
    liste.append(dd);
  };
  ajouter('Application', resumeApp(r.app, LIBELLE_PLATEFORME));
  ajouter('Heure sur l’appareil', r.clientTs ? fmtInstantParis(r.clientTs) : '—');
  if (d.seance) {
    const p = el('p', 'champ-texte');
    p.append(lienSeance(route.env, d.seance.sessionId, [
      libelle(LIBELLE_MODE, d.seance.mode, 'Séance'),
      d.seance.theme,
      d.seance.debut ? 'commencée ' + fmtInstantParis(d.seance.debut) : null,
    ].filter(Boolean).join(' · ')));
    ajouter('Séance en cours', p);
  } else {
    ajouter('Séance en cours', r.sessionId ? 'séance ' + r.sessionId + ' (introuvable)' : 'aucune');
  }
  ajouter('Appareil', r.appareil ? champsLibres(r.appareil) : 'non transmis');
  ajouter('Lancement', r.lancementId ? el('span', 'mono', r.lancementId) : 'non transmis');
  return liste;
}

// La capture : miniature (clic = ouvrir en grand dans un nouvel onglet
// n'est pas permis pour une URL data: — on agrandit dans un <dialog>).
// Une URL expirée (1 h) se redemande par « Recharger ».
function blocCapture(capture, { route, api }) {
  const zone = el('div', 'photo-galerie');
  if (capture.etat === 'absente') {
    zone.append(el('p', 'reader-empty', 'Aucune capture jointe.'));
    return zone;
  }
  const tuile = el('figure', 'photo-tuile');
  if (capture.etat === 'purgee' || !capture.url) {
    tuile.classList.add('is-purgee');
    tuile.append(el('span', 'photo-effacee', 'Capture effacée'));
    zone.append(tuile);
    return zone;
  }
  const bouton = el('button', 'photo-miniature');
  bouton.type = 'button';
  bouton.setAttribute('aria-label', 'Agrandir la capture');
  const img = el('img');
  img.alt = 'Capture d’écran jointe au retour';
  img.decoding = 'async';
  img.src = capture.url;
  bouton.append(img);
  bouton.addEventListener('click', () => agrandir(img.src));
  const legende = el('figcaption', 'photo-legende', 'lien valable 1 h');
  const recharger = el('button', 'bouton photo-recharger', 'Recharger');
  recharger.type = 'button';
  recharger.addEventListener('click', async () => {
    recharger.disabled = true;
    recharger.textContent = 'Rechargement…';
    try {
      const frais = await api.retour(route.env, route.retourId);
      const c = frais && frais.capture;
      if (!c || c.etat !== 'ok' || !c.url) {
        zone.replaceWith(blocCapture(c || { etat: 'absente' }, { route, api }));
        return;
      }
      img.src = c.url;
      tuile.classList.remove('is-expiree');
      recharger.textContent = 'Recharger';
    } catch (e) {
      if (estAnnulation(e)) return;
      recharger.textContent = 'Échec — réessayer';
    }
    recharger.disabled = false;
  });
  img.addEventListener('error', () => tuile.classList.add('is-expiree'));
  tuile.append(bouton, legende, recharger);
  zone.append(tuile);
  return zone;
}

function agrandir(url) {
  const dialogue = el('dialog', 'photo-dialogue');
  const img = el('img', 'photo-grande');
  img.alt = 'Capture d’écran jointe au retour';
  img.src = url;
  const actions = el('div', 'photo-dialogue-actions');
  const fermer = el('button', 'bouton', 'Fermer');
  fermer.type = 'button';
  fermer.addEventListener('click', () => dialogue.close());
  actions.append(fermer);
  dialogue.append(img, actions);
  dialogue.addEventListener('close', () => dialogue.remove());
  dialogue.addEventListener('click', (e) => { if (e.target === dialogue) dialogue.close(); });
  document.body.append(dialogue);
  dialogue.showModal();
}

function blocFil(d) {
  const bloc = el('div');
  if (!d.retour.lancementId) {
    bloc.append(el('p', 'reader-empty', 'L’app n’a pas transmis de lancement : pas de fil.'));
    return bloc;
  }
  bloc.append(tableau({
    classe: 'retour-fil',
    colonnes: [
      { titre: '#', classe: 'cell-right', largeur: '48px' },
      { titre: 'Heure', largeur: '130px' },
      { titre: 'Événement', largeur: '1fr' },
      { titre: 'Écran', largeur: '1fr' },
      { titre: 'Détail', largeur: '2fr' },
    ],
    lignes: d.fil.map((e) => ({
      classe: e.apresRetour ? 'is-inactive' : '',
      cellules: [
        e.seq == null ? '—' : String(e.seq),
        fmtInstantParis(e.clientTs),
        (e.type || '—') + (e.apresRetour ? ' (après l’envoi)' : ''),
        e.ecran || '—',
        el('span', 'mono', detailCourt(e.detail)),
      ],
    })),
    vide: 'Aucun événement pour ce lancement.',
  }));
  if (d.filTronque) bloc.append(el('p', 'bloc-note', 'Fil tronqué : seuls les 500 premiers événements sont montrés.'));
  return bloc;
}

function blocErreurs(d) {
  const bloc = el('div');
  bloc.append(tableau({
    classe: 'retour-erreurs',
    colonnes: [
      { titre: 'Heure', largeur: '130px' },
      { titre: 'Écran', largeur: '1fr' },
      { titre: 'Build', classe: 'cell-right', largeur: '70px' },
      { titre: 'Détail', largeur: '2fr' },
      { titre: 'Lancement', largeur: '150px' },
    ],
    lignes: d.erreurs7j.map((e) => {
      const lancement = el('span');
      if (e.memeLancement) lancement.append(el('span', 'chip is-fragile', 'même lancement'));
      else lancement.append(el('span', 'cell-note', 'autre lancement'));
      return [
        fmtInstantParis(e.clientTs),
        e.ecran || '—',
        e.build == null ? '—' : String(e.build),
        el('span', 'mono', detailCourt(e.detail)),
        lancement,
      ];
    }),
    vide: 'Aucune erreur client sur ce compte dans les 7 jours avant le retour.',
  }));
  if (d.erreursTronque) bloc.append(el('p', 'bloc-note', 'Liste tronquée : 200 erreurs au plus.'));
  return bloc;
}
