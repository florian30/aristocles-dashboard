/* ============================================================
   Messages (Edge `notifs_console`) : ce qu'on dit aux familles.
   Deux onglets (?onglet=app pour le second) :
   · Notifications : écrire, voir l'aperçu et l'audience, essayer
     sur UN téléphone, envoyer ou programmer, annuler, résultats ;
   · Messages dans l'app : liste, écrire (un message naît inactif),
     publier / retirer avec une confirmation dans la page.

   Le serveur est juge : l'écran reprend ses règles pour nommer le
   champ fautif avant l'envoi, et affiche ses refus tels quels. Les
   avertissements (nuit, rythme, doublon) ne bloquent jamais.
   Un envoi porte un numéro tiré une fois (creerNumeroEnvoi) et
   réutilisé à chaque nouvel essai : rien ne part deux fois.
   Tout le texte passe par textContent.
   ============================================================ */

import { construireHash } from '../router.js';
import { el, etatErreur, lien, tableau } from '../ui/dom.js';
import { fmtEntier, pluriel } from '../ui/format.js';
import {
  ajusterInApp, choixInApp, CLASSES, creerNumeroEnvoi, estDansLeFutur, fmtFenetre, fmtQuand, formulaireDepuisMessage,
  formulaireNotifVide, GROUPES_DESTINATION, issueErreur, LIBELLE_DECLENCHEUR, LIBELLE_DESTINATION, LIBELLE_EMPLACEMENT,
  LIBELLE_ETAT_CAMPAGNE, LIBELLE_FORMAT, LIBELLE_TYPE_NOTIF, libelleAppareil, LIMITES_IN_APP, LIMITES_NOTIF,
  messageInAppVide, messageNotif, paramsMessageInApp, paramsNotif, parisVersIso, phraseAvertissement, phraseErreur,
  PLATEFORMES, resumeCible, TYPES_CONSOLE, verifierMessageInApp, verifierNotif, DESTINATIONS_PARENT,
} from '../ui/messages.js';
import { fmtInstantParis } from '../ui/paris.js';

export const titre = 'Messages';

const ONGLETS = [['notifs', 'Notifications'], ['app', 'Messages dans l’app']];
const FENETRES_RESULTATS = [7, 30, 90];

export async function rendre({ route, api, signal }) {
  const onglet = route.query.onglet === 'app' ? 'app' : 'notifs';
  const ctx = { env: route.env, api, signal };

  const vue = el('div', 'vue vue-messages');
  const tete = el('div', 'page-head');
  tete.append(el('h1', 'page-title', titre), el('span', 'page-count', 'console ' + route.env));
  vue.append(tete);

  const barre = el('div', 'toolbar');
  const onglets = el('div', 'range-shortcuts');
  for (const [cle, libelle] of ONGLETS) {
    const a = lien(construireHash({ ...route, query: cle === 'app' ? { onglet: 'app' } : {} }), cle === onglet ? 'is-active' : '', libelle);
    if (cle === onglet) a.setAttribute('aria-current', 'true');
    onglets.append(a);
  }
  barre.append(onglets);
  vue.append(barre);

  // Les familles (pour cibler, et pour l'essai) viennent de l'Edge
  // `dashboard` ; leur absence n'empêche pas d'écrire.
  const familles = api.enfants(route.env, null, null, { signal }).then(listeFamilles, () => []);

  try {
    if (onglet === 'notifs') {
      const resultats = await api.console.resultats(route.env, 30, { signal });
      vue.append(...ongletNotifications(ctx, resultats, await familles));
    } else {
      const messages = await api.console.messages(route.env, { signal });
      vue.append(...ongletMessagesApp(ctx, messages, await familles));
    }
  } catch (e) {
    if (e.status === 401 || e.status === 403 || e.name === 'AbortError') throw e;
    const issue = issueErreur(e);
    if (issue.cas !== 'indisponible' && issue.cas !== 'introuvable') throw e;
    vue.append(etatErreur(
      'La console n’est pas disponible sur ' + route.env,
      issue.cas === 'indisponible'
        ? phraseErreur(issue) + (route.env === 'prod' ? ' En prod, elle s’ouvrira avec la release des notifications.' : '')
        : 'L’Edge notifs_console n’est pas déployée sur cet environnement.',
    ));
  }
  return vue;
}

// enfants → [{ parentId, libelle }] (un parent, ses enfants)
function listeFamilles({ enfants }) {
  const parParent = new Map();
  for (const e of enfants) {
    if (!e.parentId) continue;
    const f = parParent.get(e.parentId) || { parentId: e.parentId, email: e.parentEmail, enfants: [] };
    f.enfants.push(e.prenom + (e.classe ? ' (' + e.classe + ')' : ''));
    parParent.set(e.parentId, f);
  }
  return [...parParent.values()]
    .map((f) => ({ parentId: f.parentId, libelle: (f.email || 'compte sans e-mail') + ' — ' + f.enfants.join(', ') }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle));
}

// ---------- Briques de formulaire ----------

function champ(libelle, controle, { nom, aide, compteur } = {}) {
  const bloc = el('div', 'form-champ');
  const etiquette = el('label', 'form-label', libelle);
  if (controle.id) etiquette.htmlFor = controle.id;
  bloc.append(etiquette, controle);
  if (compteur) bloc.append(compteur);
  if (aide) bloc.append(el('p', 'form-aide', aide));
  const erreur = el('p', 'form-erreur');
  erreur.dataset.champ = nom || '';
  erreur.hidden = true;
  bloc.append(erreur);
  return bloc;
}

let compteurId = 0;
const nouvelId = (prefixe) => prefixe + '-' + (++compteurId);

function saisie(valeur, surSaisie, { type = 'text', max, placeholder, nom } = {}) {
  const input = el('input', 'form-input');
  input.type = type;
  input.id = nouvelId('champ');
  input.value = valeur ?? '';
  if (max) input.maxLength = max;
  if (placeholder) input.placeholder = placeholder;
  if (nom) input.name = nom;
  input.addEventListener('input', () => surSaisie(input.value));
  return input;
}

function zoneTexte(valeur, surSaisie, { max, lignes = 3, nom } = {}) {
  const t = el('textarea', 'form-input form-textarea');
  t.id = nouvelId('champ');
  t.rows = lignes;
  t.value = valeur ?? '';
  if (max) t.maxLength = max;
  if (nom) t.name = nom;
  t.addEventListener('input', () => surSaisie(t.value));
  return t;
}

// options : [[valeur, libelle, { desactive? }]] ou groupes [{ libelle, options }]
function liste(valeur, options, surChoix, { nom } = {}) {
  const s = el('select', 'form-input');
  s.id = nouvelId('champ');
  if (nom) s.name = nom;
  const ajouter = (parent, [v, libelle, opts = {}]) => {
    const o = el('option', null, libelle);
    o.value = v;
    if (opts.desactive) o.disabled = true;
    parent.append(o);
  };
  for (const opt of options) {
    if (Array.isArray(opt)) ajouter(s, opt);
    else {
      const g = el('optgroup');
      g.label = opt.libelle;
      opt.options.forEach((o) => ajouter(g, o));
      s.append(g);
    }
  }
  s.value = valeur;
  s.addEventListener('change', () => surChoix(s.value));
  return s;
}

function cases(valeurs, options, surChoix, { classe = '' } = {}) {
  const bloc = el('div', 'form-cases ' + classe);
  for (const [v, libelle] of options) {
    const l = el('label', 'form-case');
    const c = el('input');
    c.type = 'checkbox';
    c.value = v;
    c.checked = valeurs.includes(v);
    c.addEventListener('change', () => {
      const choisies = [...bloc.querySelectorAll('input:checked')].map((x) => x.value);
      surChoix(choisies);
    });
    l.append(c, el('span', null, libelle));
    bloc.append(l);
  }
  return bloc;
}

function radios(valeur, options, surChoix) {
  const nom = nouvelId('radio');
  const bloc = el('div', 'form-cases');
  for (const [v, libelle] of options) {
    const l = el('label', 'form-case');
    const r = el('input');
    r.type = 'radio';
    r.name = nom;
    r.value = v;
    r.checked = v === valeur;
    r.addEventListener('change', () => r.checked && surChoix(v));
    l.append(r, el('span', null, libelle));
    bloc.append(l);
  }
  return bloc;
}

function compteurCaracteres(max) {
  const c = el('span', 'form-compteur');
  c.maj = (texte) => {
    c.textContent = (texte || '').length + ' / ' + max;
    c.classList.toggle('is-failure', (texte || '').length > max);
  };
  return c;
}

function bouton(libelle, classe, surClic) {
  const b = el('button', 'bouton ' + (classe || ''), libelle);
  b.type = 'button';
  b.addEventListener('click', surClic);
  return b;
}

function afficherErreurs(racine, erreurs) {
  const parChamp = new Map();
  for (const e of erreurs) if (!parChamp.has(e.champ)) parChamp.set(e.champ, e.message);
  for (const p of racine.querySelectorAll('.form-erreur')) {
    const msg = parChamp.get(p.dataset.champ);
    p.hidden = !msg;
    p.textContent = msg || '';
    p.parentElement.classList.toggle('is-invalide', Boolean(msg));
  }
}

// Un refus du serveur (400) : le champ nommé s'allume s'il est à l'écran.
function erreurServeurSurChamp(racine, issue) {
  if (issue.cas !== 'refus' || !issue.champ) return;
  const nom = { classes: 'classes', plateforme: 'plateforme', parent_ids: 'parent_ids' }[issue.champ] || issue.champ;
  afficherErreurs(racine, [{ champ: nom, message: 'Refusé par le serveur : ' + issue.detail }]);
}

function bandeau(texte, ton = 'info') {
  const b = el('div', 'messages-bandeau is-' + ton);
  b.setAttribute('role', ton === 'erreur' ? 'alert' : 'status');
  if (texte) b.append(el('p', null, texte));
  return b;
}

// Choix de familles (cible, essai) : une liste filtrable.
function choixFamilles(familles, choisies, surChoix) {
  const bloc = el('div', 'familles-choix');
  if (!familles.length) {
    bloc.append(el('p', 'form-aide', 'Liste des familles indisponible.'));
    return bloc;
  }
  const filtre = el('input', 'form-input');
  filtre.type = 'search';
  filtre.placeholder = 'Filtrer (e-mail, prénom)…';
  const total = el('p', 'form-aide');
  const listeCases = el('div', 'familles-liste');
  const maj = () => {
    total.textContent = choisies.length ? pluriel(choisies.length, 'famille choisie', 'familles choisies') : 'Aucune famille choisie.';
  };
  for (const f of familles) {
    const l = el('label', 'form-case');
    const c = el('input');
    c.type = 'checkbox';
    c.checked = choisies.includes(f.parentId);
    c.addEventListener('change', () => {
      const i = choisies.indexOf(f.parentId);
      if (c.checked && i < 0) choisies.push(f.parentId);
      if (!c.checked && i >= 0) choisies.splice(i, 1);
      maj();
      surChoix(choisies);
    });
    l.append(c, el('span', null, f.libelle));
    l.dataset.texte = f.libelle.toLowerCase();
    listeCases.append(l);
  }
  filtre.addEventListener('input', () => {
    const q = filtre.value.trim().toLowerCase();
    for (const l of listeCases.children) l.hidden = Boolean(q) && !l.dataset.texte.includes(q);
  });
  maj();
  bloc.append(filtre, listeCases, total);
  return bloc;
}

function memoire(cle) {
  const k = 'aristocles.messages.' + cle;
  return {
    lire() { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (_) { return null; } },
    ecrire(v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* stockage indisponible */ } },
  };
}

// =====================================================================
// Onglet Notifications
// =====================================================================

function ongletNotifications(ctx, resultatsInitiaux, familles) {
  const { env, api, signal } = ctx;
  const numero = creerNumeroEnvoi();
  let f = formulaireNotifVide();
  let quand = 'maintenant';
  let minuteur = null;
  let apercuEnCours = null;

  const intro = el('p', 'bloc-explication',
    'Seuls « Les nouveautés de l’app » et « Actualités d’Aristocles » s’envoient à la main. Un parent qui a coupé un type ne le reçoit jamais, essai compris. ' +
    'Les avertissements ne bloquent pas l’envoi : ils disent ce qu’il faut savoir.');

  const formulaire = el('section', 'messages-formulaire');
  const colonneApercu = el('aside', 'messages-apercu');
  const grille = el('div', 'messages-grille');
  // La zone d'envoi vit hors du formulaire : redessiner l'un ne l'efface pas.
  const zoneEnvoi = el('div', 'messages-envoi');
  const colonne = el('div', 'messages-formulaire');
  colonne.append(formulaire, zoneEnvoi);
  grille.append(colonne, colonneApercu);
  const zoneResultats = el('section', 'messages-resultats');

  // ----- Formulaire -----
  const compteurTitre = compteurCaracteres(LIMITES_NOTIF.titre);
  const compteurTexte = compteurCaracteres(LIMITES_NOTIF.texte);

  function dessinerFormulaire() {
    const actif = document.activeElement?.name;
    formulaire.replaceChildren(el('h2', 'section-title', 'Écrire une notification'));

    formulaire.append(champ('Type', radios(f.type, TYPES_CONSOLE.map((t) => [t, LIBELLE_TYPE_NOTIF[t]]), (v) => {
      f.type = v;
      changer();
    }), { nom: 'type', aide: 'C’est aussi la catégorie que le parent peut couper dans ses réglages.' }));

    formulaire.append(champ('Titre', saisie(f.titre, (v) => { f.titre = v; compteurTitre.maj(v); changer(); },
      { max: LIMITES_NOTIF.titre, nom: 'titre' }), { nom: 'titre', compteur: compteurTitre }));
    formulaire.append(champ('Texte', zoneTexte(f.texte, (v) => { f.texte = v; compteurTexte.maj(v); changer(); },
      { max: LIMITES_NOTIF.texte, nom: 'texte' }), { nom: 'texte', compteur: compteurTexte }));
    compteurTitre.maj(f.titre);
    compteurTexte.maj(f.texte);

    const destinations = GROUPES_DESTINATION.map((g) => ({ libelle: g.libelle, options: g.destinations }));
    formulaire.append(champ('Au toucher, ouvre', liste(f.destination, destinations, (v) => {
      f.destination = v;
      if (v !== 'url') f.url = '';
      dessinerFormulaire();
      changer();
    }, { nom: 'destination' }), {
      nom: 'destination',
      aide: DESTINATIONS_PARENT.includes(f.destination) ? 'Côté parent : le code PIN est demandé avant l’écran.' : null,
    }));
    if (f.destination === 'url') {
      formulaire.append(champ('Adresse web', saisie(f.url, (v) => { f.url = v; changer(); },
        { type: 'url', placeholder: 'https://…', max: LIMITES_NOTIF.url, nom: 'url' }), { nom: 'url' }));
    }

    // Cible
    const cible = el('fieldset', 'form-groupe');
    cible.append(el('legend', 'form-legende', 'À qui'));
    cible.append(champ('Plateforme', liste(f.plateforme, [['', 'Toutes'], ...PLATEFORMES], (v) => { f.plateforme = v; changer(); },
      { nom: 'plateforme' }), { nom: 'plateforme' }));
    cible.append(champ('Classes', cases(f.classes, CLASSES.map((c) => [c, c]), (v) => { f.classes = v; changer(); }),
      { nom: 'classes', aide: 'Aucune case : toutes les classes.' }));
    const builds = el('div', 'form-ligne');
    builds.append(
      champ('Build minimum', saisie(f.buildMin, (v) => { f.buildMin = v; changer(); }, { type: 'number', nom: 'build_min' }), { nom: 'build_min' }),
      champ('Build maximum (inclus)', saisie(f.buildMax, (v) => { f.buildMax = v; changer(); }, { type: 'number', nom: 'build_max' }), { nom: 'build_max' }),
    );
    cible.append(builds);
    const details = el('details', 'form-details');
    if (f.parentIds.length) details.open = true;
    details.append(el('summary', null, 'Seulement certaines familles' + (f.parentIds.length ? ' (' + f.parentIds.length + ')' : '')));
    details.append(champ('Familles', choixFamilles(familles, f.parentIds, () => changer()),
      { nom: 'parent_ids', aide: 'Au plus ' + LIMITES_NOTIF.familles + '. Ne se programme pas : un envoi à des familles choisies part tout de suite.' }));
    cible.append(details);
    formulaire.append(cible);

    // Quand
    const moment = el('fieldset', 'form-groupe');
    moment.append(el('legend', 'form-legende', 'Quand'));
    moment.append(radios(quand, [['maintenant', 'Maintenant'], ['programmer', 'Programmer']], (v) => {
      quand = v;
      if (v === 'maintenant') f.envoyerA = '';
      dessinerFormulaire();
      changer();
    }));
    if (quand === 'programmer') {
      moment.append(champ('Date et heure (heure de Paris)', saisie(f.envoyerA, (v) => { f.envoyerA = v; changer(); },
        { type: 'datetime-local', nom: 'envoyer_a' }), { nom: 'envoyer_a' }));
    }
    formulaire.append(moment);

    if (actif) formulaire.querySelector('[name="' + actif + '"]')?.focus();
    afficherErreurs(formulaire, erreursVisibles());
  }

  // Les erreurs ne s'affichent que sur les champs déjà remplis, sauf
  // après une tentative d'envoi.
  let tenteEnvoi = false;
  function erreursVisibles() {
    const erreurs = verifierNotif(f);
    if (quand === 'programmer' && !f.envoyerA) erreurs.push({ champ: 'envoyer_a', message: 'Choisissez la date d’envoi.' });
    if (quand === 'programmer' && f.envoyerA && !estDansLeFutur(parisVersIso(f.envoyerA))) {
      erreurs.push({ champ: 'envoyer_a', message: 'Cette date est passée.' });
    }
    if (tenteEnvoi) return erreurs;
    return erreurs.filter((e) => !['titre', 'texte'].includes(e.champ) || f[e.champ]);
  }
  const estPret = () => {
    const sauvegarde = tenteEnvoi;
    tenteEnvoi = true;
    const ok = erreursVisibles().length === 0;
    tenteEnvoi = sauvegarde;
    return ok;
  };

  function changer() {
    afficherErreurs(formulaire, erreursVisibles());
    dessinerApercu();
    zoneEnvoi.replaceChildren(...boutonsEnvoi());
    clearTimeout(minuteur);
    minuteur = setTimeout(rafraichirAudience, 500);
  }

  // ----- Aperçu et audience -----
  const blocTelephone = el('div', 'telephone');
  const blocAudience = el('div', 'audience');
  const blocEssai = el('div', 'essai');
  colonneApercu.append(el('h2', 'section-title', 'Aperçu'), blocTelephone, el('h3', 'sous-titre', 'Audience estimée'), blocAudience,
    el('h3', 'sous-titre', 'Essai sur un téléphone'), blocEssai);

  function dessinerApercu() {
    const notif = el('div', 'telephone-notif');
    const ligne = el('div', 'telephone-app');
    ligne.append(el('span', 'telephone-icone', 'A'), el('span', null, 'Aristocles'), el('span', 'telephone-heure', 'maintenant'));
    notif.append(ligne, el('p', 'telephone-titre', f.titre || 'Titre de la notification'),
      el('p', 'telephone-texte', f.texte || 'Le texte apparaît ici.'));
    if (!f.titre) notif.querySelector('.telephone-titre').classList.add('is-vide');
    if (!f.texte) notif.querySelector('.telephone-texte').classList.add('is-vide');
    const destination = 'Au toucher : ' + (LIBELLE_DESTINATION[f.destination] || f.destination) +
      (f.destination === 'url' && f.url ? ' (' + f.url + ')' : '') +
      (DESTINATIONS_PARENT.includes(f.destination) ? ' — après le code PIN' : '');
    blocTelephone.replaceChildren(notif, el('p', 'form-aide', destination),
      el('p', 'form-aide', LIBELLE_TYPE_NOTIF[f.type] + ' · ' + resumeCible(cibleAffichee())));
  }
  const cibleAffichee = () => ({
    plateforme: f.plateforme || null, classes: f.classes, build_min: f.buildMin || null, build_max: f.buildMax || null,
    familles: f.parentIds.length || null,
  });

  async function rafraichirAudience() {
    if (!estPret()) {
      blocAudience.replaceChildren(el('p', 'form-aide', 'Remplissez le titre et le texte pour estimer l’audience.'));
      return;
    }
    apercuEnCours?.abort();
    const ctrl = new AbortController();
    apercuEnCours = ctrl;
    signal.addEventListener('abort', () => ctrl.abort(), { once: true });
    blocAudience.classList.add('is-loading');
    try {
      const a = await api.console.apercu(env, { ...paramsNotif(f), campagne_id: numero.id }, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      blocAudience.replaceChildren(...vueAudience(a));
    } catch (e) {
      if (e.name === 'AbortError') return;
      const issue = issueErreur(e);
      erreurServeurSurChamp(formulaire, issue);
      blocAudience.replaceChildren(bandeau(phraseErreur(issue), 'erreur'));
    } finally {
      if (apercuEnCours === ctrl) blocAudience.classList.remove('is-loading');
    }
  }

  // ----- Essai -----
  const memoireEssai = memoire('essai.' + env);
  const essai = { parentId: memoireEssai.lire()?.parentId || '', appareilId: memoireEssai.lire()?.appareilId || '', appareils: null };

  async function chargerAppareils() {
    essai.appareils = null;
    dessinerEssai();
    if (!essai.parentId) return;
    try {
      essai.appareils = await api.console.appareils(env, essai.parentId, { signal });
      if (!essai.appareils.some((a) => a.appareil_id === essai.appareilId)) essai.appareilId = essai.appareils[0]?.appareil_id || '';
    } catch (e) {
      if (e.name === 'AbortError') return;
      essai.appareils = [];
      essai.erreur = phraseErreur(issueErreur(e));
    }
    dessinerEssai();
  }

  function dessinerEssai(resultat) {
    const contenu = [];
    contenu.push(champ('Compte', liste(essai.parentId, [['', 'Choisir un compte…'], ...familles.map((x) => [x.parentId, x.libelle])], (v) => {
      essai.parentId = v;
      essai.appareilId = '';
      essai.erreur = null;
      chargerAppareils();
    }, { nom: 'essai_parent' }), { nom: 'essai_parent' }));
    if (essai.parentId && essai.appareils === null) contenu.push(el('p', 'form-aide', 'Recherche des téléphones…'));
    if (essai.erreur) contenu.push(bandeau(essai.erreur, 'erreur'));
    if (essai.appareils && essai.appareils.length === 0 && !essai.erreur) {
      contenu.push(el('p', 'form-aide', 'Aucun téléphone enregistré pour ce compte.'));
    }
    if (essai.appareils?.length) {
      contenu.push(champ('Téléphone', liste(essai.appareilId, essai.appareils.map((a) => [a.appareil_id, libelleAppareil(a)]), (v) => {
        essai.appareilId = v;
      }, { nom: 'essai_appareil' }), { nom: 'essai_appareil' }));
      const envoyer = bouton('Envoyer l’essai', '', async () => {
        if (!estPret()) {
          tenteEnvoi = true;
          afficherErreurs(formulaire, erreursVisibles());
          dessinerEssai(bandeau('Le message n’est pas complet : voir les champs signalés.', 'erreur'));
          return;
        }
        envoyer.disabled = true;
        envoyer.textContent = 'Envoi…';
        memoireEssai.ecrire({ parentId: essai.parentId, appareilId: essai.appareilId });
        try {
          const r = await api.console.envoyerTest(env, essai.appareilId, messageNotif(f), { signal });
          dessinerEssai(resultatEssai(r));
        } catch (e) {
          if (e.name === 'AbortError') return;
          dessinerEssai(bandeau(phraseErreur(issueErreur(e)), 'erreur'));
        }
      });
      contenu.push(el('p', 'form-aide', 'Le titre arrive préfixé « [Essai] ». L’essai ne compte ni dans les résultats, ni dans le rythme des envois.'), envoyer);
    }
    if (resultat) contenu.push(resultat);
    blocEssai.replaceChildren(...contenu);
  }

  // ----- Envoi -----
  function boutonsEnvoi() {
    const programmer = quand === 'programmer' && f.envoyerA && estDansLeFutur(parisVersIso(f.envoyerA));
    const libelle = programmer ? 'Programmer pour le ' + fmtQuand(parisVersIso(f.envoyerA)) + '…' : 'Envoyer maintenant…';
    return [bouton(libelle, 'bouton-principal', () => preparerEnvoi())];
  }

  async function preparerEnvoi() {
    tenteEnvoi = true;
    const erreurs = erreursVisibles();
    afficherErreurs(formulaire, erreurs);
    if (erreurs.length) {
      zoneEnvoi.replaceChildren(...boutonsEnvoi(), bandeau('Le message n’est pas complet : voir les champs signalés.', 'erreur'));
      return;
    }
    zoneEnvoi.replaceChildren(el('p', 'form-aide', 'Calcul de l’audience…'));
    let a;
    try {
      a = await api.console.apercu(env, { ...paramsNotif(f), campagne_id: numero.id }, { signal });
    } catch (e) {
      if (e.name === 'AbortError') return;
      const issue = issueErreur(e);
      erreurServeurSurChamp(formulaire, issue);
      zoneEnvoi.replaceChildren(...boutonsEnvoi(), bandeau(phraseErreur(issue), 'erreur'));
      return;
    }
    blocAudience.replaceChildren(...vueAudience(a));
    const params = paramsNotif(f);
    const programmee = params.envoyer_a && estDansLeFutur(params.envoyer_a);
    const confirmation = el('div', 'messages-confirmation');
    confirmation.setAttribute('role', 'alertdialog');
    confirmation.append(el('p', 'confirmation-titre', programmee
      ? 'Programmer « ' + f.titre + ' » pour le ' + fmtQuand(params.envoyer_a) + ' ?'
      : 'Envoyer « ' + f.titre + ' » maintenant ?'));
    confirmation.append(el('p', null, 'Aujourd’hui : ' + pluriel(a.audience.joignables, 'parent joignable', 'parents joignables') + ', ' +
      pluriel(a.audience.appareils, 'téléphone', 'téléphones') + '.' + (programmee ? ' L’audience sera recalculée au moment de l’envoi.' : '')));
    if (a.avertissements.length) confirmation.append(listeAvertissements(a.avertissements));
    if (!programmee && a.audience.joignables === 0) confirmation.append(bandeau('Personne ne recevra cette notification.', 'attention'));
    const actions = el('div', 'etat-actions');
    actions.append(
      bouton(programmee ? 'Confirmer la programmation' : 'Confirmer l’envoi', 'bouton-principal', () => envoyer({})),
      bouton('Ne pas envoyer', 'bouton-discret', () => zoneEnvoi.replaceChildren(...boutonsEnvoi())),
    );
    confirmation.append(actions);
    zoneEnvoi.replaceChildren(confirmation);
  }

  async function envoyer(drapeaux) {
    const attente = el('p', 'form-aide', 'Envoi en cours… (numéro ' + numero.id.slice(0, 8) + ')');
    zoneEnvoi.replaceChildren(attente);
    try {
      const r = await api.console.envoyer(env, { ...paramsNotif(f), campagne_id: numero.id, ...drapeaux }, { signal });
      const c = r.campagne;
      let texte;
      if (r.deja) {
        texte = 'Cet envoi était déjà enregistré (' + (LIBELLE_ETAT_CAMPAGNE[c.etat] || c.etat).toLowerCase() + ') : rien n’est reparti.';
      } else if (c.etat === 'programmee') {
        texte = 'Programmée pour le ' + fmtQuand(c.envoyer_a) + '. Elle reste annulable jusque-là, dans les résultats ci-dessous.';
      } else {
        texte = 'Envoyée : ' + pluriel(c.parents, 'parent', 'parents') + ', ' + pluriel(c.envoyes, 'téléphone atteint', 'téléphones atteints') +
          (c.perimes + c.echecs ? ', ' + pluriel(c.perimes + c.echecs, 'refus', 'refus') : '') + '.';
      }
      numero.renouveler();
      f = formulaireNotifVide();
      quand = 'maintenant';
      tenteEnvoi = false;
      dessinerFormulaire();
      dessinerApercu();
      blocAudience.replaceChildren(el('p', 'form-aide', 'Remplissez le titre et le texte pour estimer l’audience.'));
      zoneEnvoi.replaceChildren(...boutonsEnvoi(), bandeau(texte, 'succes'));
      chargerResultats(fenetreResultats);
    } catch (e) {
      if (e.name === 'AbortError') return;
      const issue = issueErreur(e);
      erreurServeurSurChamp(formulaire, issue);
      const bloc = bandeau(phraseErreur(issue), issue.cas === 'doublon' || issue.cas === 'en_cours' ? 'attention' : 'erreur');
      const actions = el('div', 'etat-actions');
      if (issue.cas === 'doublon') {
        if (issue.campagne) bloc.append(el('p', 'form-aide', '« ' + issue.campagne.titre + ' » — ' + (LIBELLE_ETAT_CAMPAGNE[issue.campagne.etat] || issue.campagne.etat)));
        actions.append(bouton('Envoyer quand même', 'bouton-principal', () => envoyer({ ...drapeaux, confirmer_doublon: true })),
          bouton('Ne pas envoyer', 'bouton-discret', () => zoneEnvoi.replaceChildren(...boutonsEnvoi())));
      } else if (issue.cas === 'en_cours') {
        actions.append(bouton('Reprendre l’envoi', '', () => envoyer({ ...drapeaux, reprendre: true })),
          bouton('Voir les résultats', 'bouton-discret', () => chargerResultats(fenetreResultats)));
      } else if (issue.cas === 'reseau' || issue.cas === 'erreur') {
        actions.append(bouton('Réessayer (même numéro)', '', () => envoyer(drapeaux)));
      } else {
        actions.append(bouton('Revenir au formulaire', 'bouton-discret', () => zoneEnvoi.replaceChildren(...boutonsEnvoi())));
      }
      bloc.append(actions);
      zoneEnvoi.replaceChildren(bloc);
    }
  }

  // ----- Résultats -----
  let fenetreResultats = 30;
  function dessinerResultats(r) {
    const barre = el('div', 'toolbar');
    const raccourcis = el('div', 'range-shortcuts');
    for (const n of FENETRES_RESULTATS) {
      const b = el('a', n === fenetreResultats ? 'is-active' : '', n + ' jours');
      b.href = '#';
      b.addEventListener('click', (e) => { e.preventDefault(); chargerResultats(n); });
      raccourcis.append(b);
    }
    barre.append(raccourcis, bouton('Actualiser', 'bouton-discret', () => chargerResultats(fenetreResultats)));
    zoneResultats.replaceChildren(el('h2', 'section-title', 'Résultats'), barre,
      el('p', 'bloc-explication', 'Envoyés : téléphones atteints. Refusés : jeton périmé ou échec Firebase. Ouverts : notifications touchées (journal de 90 jours).'),
      tableauCampagnes(r.campagnes, annuler),
      el('h3', 'sous-titre', 'Envois automatiques'),
      el('p', 'bloc-explication', 'Bilans et rappels envoyés par le serveur, sur la même période. En lecture seule.'),
      tableau({
        classe: 'messages-table',
        colonnes: [{ titre: 'Type', largeur: '2fr' }, { titre: 'Envoyés', classe: 'cell-right row-num' },
          { titre: 'Jetons périmés', classe: 'cell-right row-num' }, { titre: 'Échecs', classe: 'cell-right row-num' }],
        lignes: r.automatiques.map((a) => [LIBELLE_TYPE_NOTIF[a.type] || a.type, fmtEntier(a.envoyes), fmtEntier(a.perimes), fmtEntier(a.echecs)]),
        vide: 'Aucun envoi automatique sur la période.',
      }));
  }

  async function chargerResultats(n) {
    fenetreResultats = n;
    zoneResultats.classList.add('is-loading');
    try {
      dessinerResultats(await api.console.resultats(env, n, { signal }));
    } catch (e) {
      if (e.name === 'AbortError') return;
      zoneResultats.append(bandeau(phraseErreur(issueErreur(e)), 'erreur'));
    } finally {
      zoneResultats.classList.remove('is-loading');
    }
  }

  async function annuler(campagne, ligne) {
    try {
      const r = await api.console.annuler(env, campagne.id, { signal });
      await chargerResultats(fenetreResultats);
      if (r.deja) zoneResultats.prepend(bandeau('Elle était déjà annulée.', 'info'));
    } catch (e) {
      if (e.name === 'AbortError') return;
      const issue = issueErreur(e);
      ligne.replaceChildren(bandeau(phraseErreur(issue), issue.cas === 'deja_partie' ? 'attention' : 'erreur'));
      if (issue.cas === 'deja_partie') chargerResultats(fenetreResultats);
    }
  }

  dessinerFormulaire();
  dessinerApercu();
  dessinerEssai();
  if (essai.parentId) chargerAppareils();
  blocAudience.replaceChildren(el('p', 'form-aide', 'Remplissez le titre et le texte pour estimer l’audience.'));
  zoneEnvoi.replaceChildren(...boutonsEnvoi());
  dessinerResultats(resultatsInitiaux);

  return [intro, grille, zoneResultats];
}

function vueAudience(a) {
  const au = a.audience;
  const grille = el('div', 'audience-chiffres');
  const chiffre = (valeur, libelle, note) => {
    const b = el('div', 'audience-chiffre');
    b.append(el('span', 'audience-valeur', fmtEntier(valeur)), el('span', 'audience-libelle', libelle));
    if (note) b.append(el('span', 'cell-note', note));
    return b;
  };
  grille.append(
    chiffre(au.joignables, 'parents joignables', 'sur ' + pluriel(au.familles, 'famille visée', 'familles visées')),
    chiffre(au.appareils, 'téléphones', 'iOS ' + au.parPlateforme.ios + ' · Android ' + au.parPlateforme.android),
  );
  const notes = [];
  if (au.familles - au.avecAppareil > 0) notes.push(pluriel(au.familles - au.avecAppareil, 'famille sans téléphone enregistré', 'familles sans téléphone enregistré'));
  if (au.typeCoupe > 0) notes.push(pluriel(au.typeCoupe, 'parent a coupé ce type', 'parents ont coupé ce type'));
  const r = [grille];
  if (notes.length) r.push(el('p', 'form-aide', notes.join(' · ') + '.'));
  if (a.avertissements.length) r.push(listeAvertissements(a.avertissements));
  return r;
}

function listeAvertissements(liste) {
  const ul = el('ul', 'avertissements');
  for (const a of liste) ul.append(el('li', null, phraseAvertissement(a)));
  return ul;
}

function resultatEssai(r) {
  if (r.statut === 'envoye') return bandeau('Essai parti : regardez le téléphone.', 'succes');
  if (r.raison === 'type_coupe') return bandeau('Pas envoyé : ce parent a coupé ce type de notification (même pour un essai).', 'attention');
  if (r.statut === 'jeton_perime') return bandeau('Pas reçu : le jeton de ce téléphone est périmé (' + r.code + '). Rouvrir l’app le renouvelle.', 'attention');
  return bandeau('Échec de l’envoi' + (r.code ? ' (' + r.code + ')' : '') + '.', 'erreur');
}

const TON_ETAT = { programmee: 'is-info', en_cours: 'is-fragile', terminee: 'is-success', annulee: 'is-muted' };

function tableauCampagnes(campagnes, annuler) {
  const lignes = campagnes.map((c) => {
    const quand = el('span', null, fmtInstantParis(c.etat === 'programmee' ? c.envoyer_a : c.terminee_at || c.created_at));
    quand.append(el('span', 'cell-note', c.etat === 'programmee' ? 'prévue' : 'écrite le ' + fmtInstantParis(c.created_at)));
    const message = el('span', null);
    message.append(el('span', 'row-name', c.titre), el('span', 'cell-note', LIBELLE_TYPE_NOTIF[c.type] + ' · ' + resumeCible(c.cible)));
    const etat = el('span', 'messages-etat');
    etat.append(el('span', 'chip ' + (TON_ETAT[c.etat] || 'is-muted'), LIBELLE_ETAT_CAMPAGNE[c.etat] || c.etat));
    if (c.en_retard) etat.append(el('span', 'chip is-failure', 'en retard'));
    const chiffres = el('span', 'row-num');
    if (c.etat === 'terminee' || c.etat === 'en_cours') {
      chiffres.append(el('span', null, fmtEntier(c.envoyes) + ' envoyés · ' + fmtEntier(c.perimes + c.echecs) + ' refusés · ' + fmtEntier(c.ouverts) + ' ouverts'));
      const codes = Object.entries(c.codes_echec).map(([code, n]) => code + ' × ' + n).join(', ');
      if (codes) chiffres.append(el('span', 'cell-note', codes));
      if (c.etat === 'terminee') chiffres.append(el('span', 'cell-note', pluriel(c.parents, 'parent', 'parents') + ', ' + pluriel(c.appareils, 'téléphone', 'téléphones')));
    } else {
      chiffres.append(el('span', 'row-muted', c.etat === 'annulee' ? 'annulée le ' + fmtInstantParis(c.annulee_at) : '—'));
    }
    const action = el('span', 'cell-right messages-actions');
    // Confirmation dans la ligne : « Annuler… » → « Oui, annuler » / « Non ».
    const proposer = () => action.replaceChildren(bouton('Annuler…', 'bouton-discret', () => {
      action.replaceChildren(el('span', 'cell-note', c.en_retard ? 'Elle n’est pas partie à l’heure. L’annuler ?' : 'Annuler cet envoi ?'),
        bouton('Oui, annuler', '', (e) => { e.currentTarget.disabled = true; annuler(c, action); }),
        bouton('Non', 'bouton-discret', proposer));
    }));
    if (c.etat === 'programmee') proposer();
    return { cellules: [quand, message, etat, chiffres, action], classe: c.etat === 'annulee' ? 'is-inactive' : '' };
  });
  return tableau({
    classe: 'messages-table',
    colonnes: [
      { titre: 'Quand', largeur: '1.1fr' }, { titre: 'Notification', largeur: '2.4fr' }, { titre: 'État', largeur: '1fr' },
      { titre: 'Résultat', largeur: '2fr' }, { titre: '', largeur: '1.2fr', classe: 'cell-right' },
    ],
    lignes,
    vide: 'Aucune notification envoyée à la main sur la période.',
  });
}

// =====================================================================
// Onglet Messages dans l'app
// =====================================================================

function ongletMessagesApp(ctx, messagesInitiaux, familles) {
  const { env, api, signal } = ctx;
  let messages = messagesInitiaux;
  const zoneEditeur = el('section', 'messages-editeur');
  const zoneListe = el('section', 'messages-liste');
  const zoneBandeau = el('div');

  const intro = el('p', 'bloc-explication',
    'Un message dans l’app s’affiche dans l’application, au moment choisi. Il naît inactif : rien n’est visible avant « Publier ». ' +
    'Modifier un message publié change ce que voient les familles tout de suite.');

  function dessinerListe() {
    const lignes = messages.map((m) => {
      const nom = el('span', null);
      nom.append(el('span', 'row-name', m.nom), el('span', 'cell-note', m.titre || m.texte || ''));
      const ou = el('span', null);
      ou.append(el('span', null, LIBELLE_EMPLACEMENT[m.emplacement] || m.emplacement),
        el('span', 'cell-note', (LIBELLE_FORMAT[m.format] || m.format) + ' · ' + libelleDeclencheur(m)));
      const cible = el('span', null);
      cible.append(el('span', null, resumeCible(m.cible, { maxExclu: true })), el('span', 'cell-note', fmtFenetre(m.debut_at, m.fin_at)));
      const etat = el('span', 'messages-etat');
      etat.append(el('span', 'chip ' + (m.actif ? 'is-success' : 'is-muted'), m.actif ? 'Publié' : 'Inactif'));
      if (m.declencheur === 'ouverture_notif') etat.append(el('span', 'chip is-fragile', 'pas encore servi'));
      const actions = el('span', 'cell-right messages-actions');
      const enLecture = m.declencheur === 'ouverture_notif';
      actions.append(bouton(enLecture ? 'Voir' : 'Modifier', 'bouton-discret', () => ouvrirEditeur(m)));
      if (m.actif) actions.append(bouton('Retirer…', 'bouton-discret', () => confirmerActivation(m, false, actions)));
      else if (!enLecture) actions.append(bouton('Publier…', '', () => confirmerActivation(m, true, actions)));
      return { cellules: [nom, ou, cible, etat, actions], classe: m.actif ? '' : 'is-brouillon' };
    });
    const barre = el('div', 'toolbar');
    barre.append(bouton('Nouveau message', 'bouton-principal', () => ouvrirEditeur(null)),
      bouton('Actualiser', 'bouton-discret', recharger));
    zoneListe.replaceChildren(el('h2', 'section-title', 'Les messages'), barre, tableau({
      classe: 'messages-table',
      colonnes: [
        { titre: 'Nom', largeur: '2.2fr' }, { titre: 'Où, comment', largeur: '1.8fr' }, { titre: 'Pour qui, quand', largeur: '1.8fr' },
        { titre: 'État', largeur: '1fr' }, { titre: '', largeur: '1.4fr', classe: 'cell-right' },
      ],
      lignes,
      vide: 'Aucun message pour l’instant.',
    }));
  }

  async function recharger() {
    zoneListe.classList.add('is-loading');
    try {
      messages = await api.console.messages(env, { signal });
      dessinerListe();
    } catch (e) {
      if (e.name === 'AbortError') return;
      zoneBandeau.replaceChildren(bandeau(phraseErreur(issueErreur(e)), 'erreur'));
    } finally {
      zoneListe.classList.remove('is-loading');
    }
  }

  function confirmerActivation(m, actif, actions) {
    const garde = [...actions.childNodes];
    const question = actif
      ? 'Publier « ' + m.nom + ' » ? Il s’affichera dans l’app (' + resumeCible(m.cible, { maxExclu: true }) + ').'
      : 'Retirer « ' + m.nom + ' » ? Il ne s’affichera plus.';
    actions.replaceChildren(el('span', 'cell-note', question),
      bouton(actif ? 'Oui, publier' : 'Oui, retirer', actif ? 'bouton-principal' : '', async (e) => {
        e.currentTarget.disabled = true;
        try {
          const maj = await api.console.activerMessage(env, m.id, actif, { signal });
          messages = messages.map((x) => (x.id === maj.id ? { ...x, ...maj } : x));
          dessinerListe();
          zoneBandeau.replaceChildren(bandeau(actif ? '« ' + m.nom + ' » est publié.' : '« ' + m.nom + ' » est retiré.', 'succes'));
        } catch (err) {
          if (err.name === 'AbortError') return;
          actions.replaceChildren(...garde);
          zoneBandeau.replaceChildren(bandeau(phraseErreur(issueErreur(err)), 'erreur'));
          if (err.status === 404) recharger();
        }
      }),
      bouton('Non', 'bouton-discret', () => actions.replaceChildren(...garde)));
  }

  function ouvrirEditeur(m) {
    zoneBandeau.replaceChildren();
    if (m && m.declencheur === 'ouverture_notif') {
      zoneEditeur.replaceChildren(...lectureSeule(m, () => zoneEditeur.replaceChildren()));
    } else {
      zoneEditeur.replaceChildren(...editeur(m));
    }
    zoneEditeur.scrollIntoView?.({ block: 'start' });
  }

  function editeur(existant) {
    const messageId = existant ? existant.id : crypto.randomUUID();
    const f = existant ? formulaireDepuisMessage(existant) : messageInAppVide();
    let tente = false;
    let notes = [];
    const corps = el('div', 'messages-grille');
    const formulaire = el('div', 'messages-formulaire');
    const apercu = el('aside', 'messages-apercu');
    corps.append(formulaire, apercu);
    const zoneActions = el('div', 'messages-envoi');

    const erreurs = () => {
      const liste = verifierMessageInApp(f);
      return tente ? liste : liste.filter((e) => e.champ !== 'nom' || f.nom);
    };
    const changer = () => {
      afficherErreurs(formulaire, erreurs());
      dessinerApercuInApp();
    };
    const restructurer = () => {
      notes = ajusterInApp(f);
      dessiner();
      changer();
    };

    function dessiner() {
      const actif = document.activeElement?.name;
      const choix = choixInApp(f);
      formulaire.replaceChildren();
      if (notes.length) formulaire.append(bandeau(notes.join(' '), 'info'));

      formulaire.append(champ('Nom interne', saisie(f.nom, (v) => { f.nom = v; changer(); }, { max: LIMITES_IN_APP.nom, nom: 'nom' }),
        { nom: 'nom', aide: 'Pour s’y retrouver ici ; jamais montré aux familles.' }));

      const ou = el('div', 'form-ligne');
      ou.append(
        champ('Emplacement', liste(f.emplacement, Object.entries(LIBELLE_EMPLACEMENT), (v) => { f.emplacement = v; restructurer(); },
          { nom: 'emplacement' }), { nom: 'emplacement' }),
        champ('Format', liste(f.format, choix.formats.map((x) => [x, LIBELLE_FORMAT[x]]), (v) => { f.format = v; restructurer(); },
          { nom: 'format' }), { nom: 'format', aide: f.emplacement === 'accueil_enfant' ? 'Côté enfant, c’est toujours Ari qui parle.' : null }),
      );
      formulaire.append(ou);

      const quand = el('div', 'form-ligne');
      quand.append(champ('Déclencheur', liste(f.declencheur,
        choix.declencheurs.map((x) => [x, LIBELLE_DECLENCHEUR[x], { desactive: x === 'ouverture_notif' }]),
        (v) => { f.declencheur = v; if (v !== 'nieme_entree_parent') f.declencheur_n = ''; restructurer(); }, { nom: 'declencheur' }),
      { nom: 'declencheur' }));
      if (f.declencheur === 'nieme_entree_parent') {
        quand.append(champ('À l’entrée n°', saisie(f.declencheur_n, (v) => { f.declencheur_n = v; changer(); }, { type: 'number', nom: 'declencheur_n' }),
          { nom: 'declencheur_n' }));
      }
      formulaire.append(quand);

      const textes = el('fieldset', 'form-groupe');
      textes.append(el('legend', 'form-legende', 'Ce qui s’affiche'));
      const avecCompteur = (libelle, cle, max, opts = {}) => {
        const compteur = compteurCaracteres(max);
        compteur.maj(f[cle]);
        const controle = opts.zone
          ? zoneTexte(f[cle], (v) => { f[cle] = v; compteur.maj(v); changer(); }, { max, nom: cle, lignes: 4 })
          : saisie(f[cle], (v) => { f[cle] = v; compteur.maj(v); changer(); }, { max, nom: cle });
        return champ(libelle, controle, { nom: cle, compteur, aide: opts.aide });
      };
      textes.append(avecCompteur('Surtitre (facultatif)', 'surtitre', LIMITES_IN_APP.surtitre));
      textes.append(avecCompteur('Titre' + (f.format === 'plein_ecran' ? '' : ' (facultatif)'), 'titre', LIMITES_IN_APP.titre));
      textes.append(avecCompteur('Texte' + (f.format === 'feuille' ? '' : ' (facultatif)'), 'texte', LIMITES_IN_APP.texte, { zone: true }));
      const points = el('div', 'form-points');
      for (let i = 0; i < LIMITES_IN_APP.points; i++) {
        points.append(saisie(f.points[i] || '', (v) => {
          const p = Array.from({ length: Math.max(f.points.length, i + 1) }, (_, k) => f.points[k] || '');
          p[i] = v;
          f.points = p;
          changer();
        }, { max: LIMITES_IN_APP.point, placeholder: 'Point ' + (i + 1), nom: 'point' + i }));
      }
      textes.append(champ('Points (jusqu’à 3)', points, { nom: 'points' }));
      textes.append(champ('Image (facultatif)', saisie(f.image_chemin, (v) => { f.image_chemin = v.trim(); changer(); },
        { max: LIMITES_IN_APP.image_chemin, placeholder: 'annonces/rentree.png', nom: 'image_chemin' }),
      { nom: 'image_chemin', aide: 'Chemin dans le dossier d’images de l’app, jamais une adresse.' }));
      formulaire.append(textes);

      const bouton_ = el('fieldset', 'form-groupe');
      bouton_.append(el('legend', 'form-legende', 'Bouton'));
      const destinations = GROUPES_DESTINATION
        .map((g) => ({ libelle: g.libelle, options: g.destinations.filter(([d]) => choix.destinations.includes(d)) }))
        .filter((g) => g.options.length);
      bouton_.append(champ('Mène à', liste(f.destination, destinations, (v) => {
        f.destination = v;
        if (v !== 'url') f.url = '';
        restructurer();
      }, { nom: 'destination' }), {
        nom: 'destination',
        aide: f.emplacement === 'accueil_enfant' ? 'Jamais d’adresse web côté enfant.' : DESTINATIONS_PARENT.includes(f.destination) ? 'Côté parent : le code PIN est demandé.' : null,
      }));
      if (f.destination === 'url') {
        bouton_.append(champ('Adresse web', saisie(f.url, (v) => { f.url = v; changer(); }, { type: 'url', placeholder: 'https://…', nom: 'url' }), { nom: 'url' }));
      }
      if (f.destination !== 'aucune' || f.bouton_libelle) {
        const compteur = compteurCaracteres(LIMITES_IN_APP.bouton_libelle);
        compteur.maj(f.bouton_libelle);
        bouton_.append(champ('Libellé du bouton', saisie(f.bouton_libelle, (v) => { f.bouton_libelle = v; compteur.maj(v); changer(); },
          { max: LIMITES_IN_APP.bouton_libelle, nom: 'bouton_libelle' }), { nom: 'bouton_libelle', compteur }));
      }
      formulaire.append(bouton_);

      const cible = el('fieldset', 'form-groupe');
      cible.append(el('legend', 'form-legende', 'Pour qui'));
      cible.append(champ('Plateforme', liste(f.plateforme, [['', 'Toutes'], ...PLATEFORMES], (v) => { f.plateforme = v; changer(); }, { nom: 'plateforme' }),
        { nom: 'plateforme' }));
      cible.append(champ('Classes', cases(f.classes, CLASSES.map((c) => [c, c]), (v) => { f.classes = v; changer(); }),
        { nom: 'classes', aide: 'Aucune case : toutes les classes.' }));
      const builds = el('div', 'form-ligne');
      builds.append(
        champ('Build minimum', saisie(f.buildMin, (v) => { f.buildMin = v; changer(); }, { type: 'number', nom: 'build_min' }), { nom: 'build_min' }),
        champ('Build maximum (exclu)', saisie(f.buildMax, (v) => { f.buildMax = v; changer(); }, { type: 'number', nom: 'build_max' }), { nom: 'build_max' }),
      );
      cible.append(builds);
      const optionsFamilles = [['toutes', 'Toutes les familles (selon la cible)'], ['designees', 'Seulement certaines familles']];
      if (existant) {
        optionsFamilles.unshift(['inchangees', 'Garder les familles actuelles (' +
          (f.famillesActuelles == null ? 'toutes' : pluriel(f.famillesActuelles, 'famille choisie', 'familles choisies')) + ')']);
      }
      cible.append(champ('Familles', radios(f.familles, optionsFamilles, (v) => { f.familles = v; dessiner(); changer(); }), { nom: 'familles' }));
      if (f.familles === 'designees') {
        cible.append(champ('Familles choisies', choixFamilles(familles, f.parentIds, () => changer()),
          { nom: 'parent_ids', aide: 'La liste remplace celle d’avant.' }));
      }
      formulaire.append(cible);

      const fenetre = el('fieldset', 'form-groupe');
      fenetre.append(el('legend', 'form-legende', 'Quand et combien'));
      const dates = el('div', 'form-ligne');
      dates.append(
        champ('À partir du (heure de Paris)', saisie(f.debut, (v) => { f.debut = v; changer(); }, { type: 'datetime-local', nom: 'debut_at' }), { nom: 'debut_at' }),
        champ('Jusqu’au (heure de Paris)', saisie(f.fin, (v) => { f.fin = v; changer(); }, { type: 'datetime-local', nom: 'fin_at' }), { nom: 'fin_at' }),
      );
      fenetre.append(dates, el('p', 'form-aide', 'Sans date : dès la publication, sans fin.'));
      const nombres = el('div', 'form-ligne');
      nombres.append(
        champ('Priorité', saisie(f.priorite, (v) => { f.priorite = v; changer(); }, { type: 'number', nom: 'priorite' }),
          { nom: 'priorite', aide: 'Le plus grand passe d’abord (−1000 à 1000).' }),
        champ('Affichages au plus', saisie(f.max_affichages, (v) => { f.max_affichages = v; changer(); }, { type: 'number', nom: 'max_affichages' }),
          { nom: 'max_affichages', aide: 'Par famille (1 à 100).' }),
      );
      fenetre.append(nombres);
      formulaire.append(fenetre);

      if (actif) formulaire.querySelector('[name="' + actif + '"]')?.focus();
      afficherErreurs(formulaire, erreurs());
    }

    function dessinerApercuInApp() {
      const carte = el('div', 'inapp ' + (f.format === 'plein_ecran' ? 'is-plein-ecran' : 'is-feuille'));
      if (f.format === 'feuille' && f.emplacement === 'accueil_enfant') carte.append(el('span', 'inapp-ari', 'Ari'));
      if (f.image_chemin) carte.append(el('div', 'inapp-image', 'image : ' + f.image_chemin));
      if (f.surtitre) carte.append(el('p', 'inapp-surtitre', f.surtitre));
      if (f.titre) carte.append(el('p', 'inapp-titre', f.titre));
      if (f.texte) carte.append(el('p', 'inapp-texte', f.texte));
      const points = f.points.filter((p) => p && p.trim());
      if (points.length) {
        const ul = el('ul', 'inapp-points');
        points.forEach((p) => ul.append(el('li', null, p)));
        carte.append(ul);
      }
      if (f.destination !== 'aucune' || f.bouton_libelle) carte.append(el('span', 'inapp-bouton', f.bouton_libelle || 'Bouton'));
      if (!f.titre && !f.texte && !points.length) carte.append(el('p', 'inapp-texte is-vide', 'Le message apparaît ici.'));
      const quoi = (LIBELLE_EMPLACEMENT[f.emplacement] || '') + ' · ' + (LIBELLE_DECLENCHEUR[f.declencheur] || '') +
        (f.declencheur === 'nieme_entree_parent' && f.declencheur_n ? ' (n° ' + f.declencheur_n + ')' : '');
      const mene = f.destination !== 'aucune' ? 'Le bouton mène à : ' + (LIBELLE_DESTINATION[f.destination] || f.destination) : 'Le bouton ferme le message.';
      apercu.replaceChildren(el('h3', 'sous-titre', 'Aperçu'), carte, el('p', 'form-aide', quoi), el('p', 'form-aide', mene));
    }

    async function enregistrer(confirme) {
      tente = true;
      const liste = verifierMessageInApp(f);
      afficherErreurs(formulaire, liste);
      if (liste.length) {
        zoneActions.replaceChildren(...boutonsEditeur(), bandeau('Le message n’est pas complet : voir les champs signalés.', 'erreur'));
        return;
      }
      if (existant?.actif && !confirme) {
        const question = bandeau('Ce message est publié : la modification sera visible tout de suite par les familles.', 'attention');
        const actions = el('div', 'etat-actions');
        actions.append(bouton('Enregistrer quand même', 'bouton-principal', () => enregistrer(true)),
          bouton('Annuler', 'bouton-discret', () => zoneActions.replaceChildren(...boutonsEditeur())));
        question.append(actions);
        zoneActions.replaceChildren(question);
        return;
      }
      zoneActions.replaceChildren(el('p', 'form-aide', 'Enregistrement…'));
      try {
        const m = await api.console.ecrireMessage(env, messageId, paramsMessageInApp(f), { signal });
        await recharger();
        zoneEditeur.replaceChildren();
        zoneBandeau.replaceChildren(bandeau('« ' + m.nom + ' » est enregistré' + (m.actif ? ' (publié).' : ' — inactif : « Publier » le rendra visible.'), 'succes'));
      } catch (e) {
        if (e.name === 'AbortError') return;
        const issue = issueErreur(e);
        erreurServeurSurChamp(formulaire, issue);
        zoneActions.replaceChildren(...boutonsEditeur(), bandeau(phraseErreur(issue), 'erreur'));
      }
    }

    const boutonsEditeur = () => [
      bouton(existant ? 'Enregistrer les modifications' : 'Créer (inactif)', 'bouton-principal', () => enregistrer(false)),
      bouton('Fermer sans enregistrer', 'bouton-discret', () => zoneEditeur.replaceChildren()),
    ];

    dessiner();
    dessinerApercuInApp();
    zoneActions.replaceChildren(...boutonsEditeur());
    const titreEditeur = existant ? 'Modifier « ' + existant.nom + ' »' : 'Nouveau message';
    return [el('h2', 'section-title', titreEditeur), corps, zoneActions];
  }

  dessinerListe();
  return [intro, zoneBandeau, zoneEditeur, zoneListe];
}

function libelleDeclencheur(m) {
  const l = LIBELLE_DECLENCHEUR[m.declencheur] || m.declencheur;
  return m.declencheur === 'nieme_entree_parent' && m.declencheur_n ? l.replace('N-ième', m.declencheur_n + 'e') : l;
}

// Un message porté par `ouverture_notif` : aucune notification ne sait
// encore l'ouvrir. On le montre, on ne le modifie pas.
function lectureSeule(m, fermer) {
  const dl = el('dl', 'messages-lecture');
  const ligne = (dt, dd) => { if (dd) dl.append(el('dt', null, dt), el('dd', null, dd)); };
  ligne('Nom', m.nom);
  ligne('Emplacement', LIBELLE_EMPLACEMENT[m.emplacement] || m.emplacement);
  ligne('Format', LIBELLE_FORMAT[m.format] || m.format);
  ligne('Déclencheur', LIBELLE_DECLENCHEUR[m.declencheur]);
  ligne('Surtitre', m.surtitre);
  ligne('Titre', m.titre);
  ligne('Texte', m.texte);
  ligne('Points', m.points.join(' · '));
  ligne('Image', m.image_chemin);
  ligne('Bouton', m.bouton_libelle ? m.bouton_libelle + ' → ' + (LIBELLE_DESTINATION[m.destination] || m.destination) : null);
  ligne('Pour qui', resumeCible(m.cible, { maxExclu: true }));
  ligne('Quand', fmtFenetre(m.debut_at, m.fin_at));
  ligne('Priorité', String(m.priorite));
  ligne('Affichages au plus', String(m.max_affichages));
  return [
    el('h2', 'section-title', '« ' + m.nom + ' »'),
    bandeau('Déclencheur « ouvert par une notification » : pas encore servi. Aucune notification ne sait encore ouvrir un message, il ne serait jamais vu. En lecture seule.', 'attention'),
    dl,
    bouton('Fermer', 'bouton-discret', fermer),
  ];
}
