/* ============================================================
   Aristocles — Rubrique Messages (fonctions pures, sans DOM)
   Libellés, règles des formulaires, dates de Paris avec fuseau,
   phrases des avertissements, lecture des refus de l'Edge
   `notifs_console`. Le serveur reste juge : ces règles ne font
   qu'éviter d'envoyer ce qu'il refuserait, et nommer le champ.
   Contrat : plan-n6.md § 3-5, plan-n7.md § 4 (dépôt de l'app),
   table `message_in_app` (migration 20261006120000).
   ============================================================ */

import { debutJourParisMs, fmtInstantParis, fmtJourCourt, heureParis, jourParis } from './paris.js';

// ---------- Listes fermées ----------

export const TYPES_CONSOLE = ['nouveautes', 'actualites'];

export const LIBELLE_TYPE_NOTIF = {
  bilan_semaine: 'Bilan de la semaine',
  bilan_jour: 'Bilan du jour',
  nouveautes: 'Les nouveautés de l’app',
  actualites: 'Actualités d’Aristocles',
  petits_rappels: 'Petits rappels',
};

// Spec § 3 : la liste des écrans est fixe, pas de lien tapé.
export const GROUPES_DESTINATION = [
  { libelle: 'Rien', destinations: [['aucune', 'Rien (ouvre l’app)']] },
  {
    libelle: 'Côté enfant',
    destinations: [
      ['accueil_enfant', 'Accueil enfant'], ['apprentissage', 'Apprentissage'],
      ['devoirs', 'Devoirs'], ['dictee', 'Dictée'],
    ],
  },
  {
    libelle: 'Côté parent (après le code PIN)',
    destinations: [
      ['espace_parent', 'Accueil de l’espace parent'], ['bilan_semaine', 'Bilan de la semaine'],
      ['bilan_jour', 'Bilan du jour'], ['notifications', 'Réglages des notifications'],
    ],
  },
  { libelle: 'Hors de l’app', destinations: [['url', 'Adresse web']] },
];

export const LIBELLE_DESTINATION = Object.fromEntries(GROUPES_DESTINATION.flatMap((g) => g.destinations));
export const DESTINATIONS = Object.keys(LIBELLE_DESTINATION);
export const DESTINATIONS_PARENT = ['espace_parent', 'bilan_semaine', 'bilan_jour', 'notifications'];

export const CLASSES = ['CE1', 'CE2', 'CM1', 'CM2'];
export const PLATEFORMES = [['ios', 'iOS'], ['android', 'Android']];

export const LIBELLE_ETAT_CAMPAGNE = {
  programmee: 'Programmée',
  en_cours: 'En cours',
  terminee: 'Envoyée',
  annulee: 'Annulée',
};

export const LIBELLE_FORMAT = { feuille: 'Feuille (Ari parle)', plein_ecran: 'Plein écran' };
export const LIBELLE_EMPLACEMENT = { accueil_enfant: 'Accueil de l’enfant', espace_parent: 'Espace parent (après le PIN)' };
export const LIBELLE_DECLENCHEUR = {
  prochaine_ouverture: 'À la prochaine ouverture',
  nieme_entree_parent: 'À la N-ième entrée dans l’espace parent',
  fin_de_seance: 'Après une fin de séance',
  ouverture_notif: 'Ouvert par une notification — pas encore servi',
};

export const LIMITES_NOTIF = { titre: 80, texte: 240, familles: 200, url: 500 };
export const LIMITES_IN_APP = {
  nom: 80, surtitre: 40, titre: 80, texte: 400, point: 120, points: 3,
  bouton_libelle: 30, image_chemin: 200, url: 500, priorite: 1000, max_affichages: 100,
};

const URL_RE = /^https:\/\/\S+$/;
const CHEMIN_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;

// ---------- Dates : heure de Paris ↔ ISO avec son fuseau ----------

const pad2 = (n) => String(n).padStart(2, '0');
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

// ISO → 'AAAA-MM-JJTHH:MM' à Paris (pour pré-remplir un datetime-local).
export function parisEnLocal(instant) {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return '';
  return jourParis(d) + 'T' + heureParis(d.toISOString());
}

// 'AAAA-MM-JJTHH:MM' (champ datetime-local, lu comme l'heure de PARIS,
// quel que soit le fuseau de la machine) → '…T09:00:00+02:00'. L'Edge
// refuse une date sans fuseau. null si la saisie est vide ou invalide.
export function parisVersIso(local) {
  const m = LOCAL_RE.exec(local || '');
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const mur = Date.UTC(y, mo - 1, d, h, mi);
  if (new Date(mur).getUTCDate() !== d) return null; // 31 avril…
  // Minuit de Paris donne le décalage du jour ; deux passes corrigent un
  // changement d'heure tombé dans la journée.
  let instant = mur - (Date.UTC(y, mo - 1, d) - debutJourParisMs(m[1] + '-' + m[2] + '-' + m[3]));
  for (let i = 0; i < 2; i++) {
    const [vy, vmo, vd, vh, vmi] = LOCAL_RE.exec(parisEnLocal(new Date(instant))).slice(1).map(Number);
    instant += mur - Date.UTC(vy, vmo - 1, vd, vh, vmi);
  }
  const decalageMin = Math.round((mur - instant) / 60000);
  const abs = Math.abs(decalageMin);
  return local + ':00' + (decalageMin >= 0 ? '+' : '-') + pad2(Math.floor(abs / 60)) + ':' + pad2(abs % 60);
}

export function estDansLeFutur(iso, maintenant = new Date()) {
  return Boolean(iso) && Date.parse(iso) > maintenant.getTime();
}

// « 12 oct. à 09:00 » (heure de Paris)
export function fmtQuand(iso) {
  if (!iso) return '—';
  return fmtJourCourt(jourParis(new Date(iso))) + ' à ' + heureParis(iso);
}

// ---------- Numéro d'envoi (garde contre le double envoi) ----------

// Un UUID tiré par l'écran à l'ouverture du formulaire, réutilisé pour
// tout nouvel essai du MÊME envoi (erreur réseau, double clic) : c'est la
// clé de la campagne, la base refuse la seconde écriture. On n'en tire un
// neuf qu'après un envoi abouti, pour écrire la notification suivante.
export function creerNumeroEnvoi(tirer = () => crypto.randomUUID()) {
  let courant = tirer();
  return {
    get id() { return courant; },
    renouveler() { courant = tirer(); return courant; },
  };
}

// ---------- Lecture des refus de l'Edge ----------

// "Invalid body: 'titre' must be …" → 'titre' ('cible.parent_ids' → 'parent_ids').
export function champRefuse(erreur) {
  const m = /^Invalid body: '([^']+)'/.exec(String(erreur || ''));
  return m ? m[1].split('.').pop() : null;
}

// Une ApiError (status + donnees) → ce que l'écran doit en faire.
export function issueErreur(e) {
  const corps = (e && e.donnees) || {};
  const code = corps.error;
  const status = e ? e.status : undefined;
  if (status === 409 && code === 'doublon_probable') return { cas: 'doublon', campagne: corps.campagne || null };
  if (status === 409 && code === 'en_cours') return { cas: 'en_cours', campagne: corps.campagne || null };
  if (status === 409 && code === 'deja_partie') return { cas: 'deja_partie', campagne: corps.campagne || null };
  if (status === 503) return { cas: 'indisponible' };
  if (status === 400) return { cas: 'refus', champ: champRefuse(code || e.message), detail: code || e.message };
  if (status === 404) return { cas: 'introuvable' };
  if (status === 0) return { cas: 'reseau' };
  if (status === 401 || status === 403) return { cas: 'acces', status };
  return { cas: 'erreur', detail: (e && e.message) || 'Erreur inconnue' };
}

export function phraseErreur(issue) {
  switch (issue.cas) {
    case 'indisponible':
      return 'Cette action n’est pas encore prête sur cet environnement (table ou secret Firebase absents). Rien n’est parti.';
    case 'reseau':
      return 'Le serveur n’a pas répondu. Si c’était un envoi, réessayez : le même numéro d’envoi est réutilisé, rien ne partira deux fois.';
    case 'acces':
      return issue.status === 401 ? 'Session expirée : reconnectez-vous.' : 'Ce compte n’est pas autorisé sur la console.';
    case 'introuvable':
      return 'Introuvable (supprimé, ou autre environnement).';
    case 'refus':
      return 'Refusé par le serveur' + (issue.champ ? ' (champ « ' + issue.champ + ' »)' : '') + ' : ' + issue.detail;
    case 'en_cours':
      return 'Cet envoi est déjà en train de partir. Attendez, puis consultez les résultats. S’il est bloqué depuis plus de dix minutes, vous pouvez le reprendre.';
    case 'deja_partie':
      return 'Trop tard : cette notification est déjà partie (ou en train de partir). Elle ne peut plus être annulée.';
    case 'doublon':
      return 'Le même message est déjà parti' + (issue.campagne?.created_at ? ' le ' + fmtQuand(issue.campagne.created_at) : '') + '.';
    default:
      return issue.detail || 'Erreur.';
  }
}

// ---------- Avertissements (plan-n6 § 5) : jamais bloquants ----------

export function phraseAvertissement(a) {
  switch (a && a.code) {
    case 'horaire_nuit':
      return 'Envoi à ' + a.heure_paris + ' (heure de Paris) : entre ' + a.debut + ' et ' + a.fin + ', la notification arrive la nuit.';
    case 'repere_hebdo':
      return a.parents + (a.parents > 1 ? ' parents ont' : ' parent a') + ' déjà reçu ' + a.repere +
        ' notifications ou plus ces 7 derniers jours (tous types).';
    case 'repere_mensuel':
      return 'Ce type est déjà parti ' + a.envois + ' fois en ' + a.jours + ' jours (repère : ' + a.repere + ').';
    case 'doublon_probable':
      return 'Le même message (type, titre, texte) est déjà parti le ' + fmtQuand(a.envoye_at) + '.';
    default:
      return 'Avertissement : ' + String(a && a.code);
  }
}

// ---------- Notification : formulaire → corps de l'Edge ----------

export function formulaireNotifVide() {
  return {
    type: 'nouveautes', titre: '', texte: '', destination: 'aucune', url: '',
    plateforme: '', classes: [], buildMin: '', buildMax: '', parentIds: [], envoyerA: '',
  };
}

const entierOuNull = (v) => (v === '' || v == null ? null : Number(v));
const estEntierPositif = (v) => Number.isInteger(v) && v >= 1;

export function messageNotif(f) {
  const m = { type: f.type, titre: f.titre, texte: f.texte, destination: f.destination };
  if (f.destination === 'url') m.url = f.url.trim();
  return m;
}

// Vide = tout le monde (le champ n'est pas envoyé).
export function cibleNotif(f) {
  const c = {};
  if (f.plateforme) c.plateforme = f.plateforme;
  if (f.classes.length) c.classes = [...f.classes];
  if (entierOuNull(f.buildMin) !== null) c.build_min = entierOuNull(f.buildMin);
  if (entierOuNull(f.buildMax) !== null) c.build_max = entierOuNull(f.buildMax);
  if (f.parentIds.length) c.parent_ids = [...f.parentIds];
  return Object.keys(c).length ? c : undefined;
}

// Les params de `apercu` / `envoyer` (sans campagne_id ni drapeaux).
export function paramsNotif(f) {
  const params = { message: messageNotif(f) };
  const cible = cibleNotif(f);
  if (cible) params.cible = cible;
  const quand = f.envoyerA ? parisVersIso(f.envoyerA) : null;
  if (quand) params.envoyer_a = quand;
  return params;
}

// Ce que l'Edge refuserait, champ par champ. [{ champ, message }]
export function verifierNotif(f, maintenant = new Date()) {
  const erreurs = [];
  const ajoute = (champ, message) => erreurs.push({ champ, message });
  if (!TYPES_CONSOLE.includes(f.type)) ajoute('type', 'Choisissez un type.');
  if (!f.titre.trim()) ajoute('titre', 'Le titre est obligatoire.');
  else if (f.titre.length > LIMITES_NOTIF.titre) ajoute('titre', LIMITES_NOTIF.titre + ' caractères au plus.');
  if (!f.texte.trim()) ajoute('texte', 'Le texte est obligatoire.');
  else if (f.texte.length > LIMITES_NOTIF.texte) ajoute('texte', LIMITES_NOTIF.texte + ' caractères au plus.');
  if (!DESTINATIONS.includes(f.destination)) ajoute('destination', 'Destination inconnue.');
  if (f.destination === 'url' && (!URL_RE.test(f.url.trim()) || f.url.trim().length > LIMITES_NOTIF.url)) {
    ajoute('url', 'Une adresse qui commence par https://');
  }
  verifierBuilds(f, ajoute, { maxExclu: false });
  if (f.parentIds.length > LIMITES_NOTIF.familles) ajoute('parent_ids', LIMITES_NOTIF.familles + ' familles au plus.');
  if (f.envoyerA) {
    const iso = parisVersIso(f.envoyerA);
    if (!iso) ajoute('envoyer_a', 'Date invalide.');
    else if (estDansLeFutur(iso, maintenant) && f.parentIds.length) {
      ajoute('parent_ids', 'Des familles choisies une à une ne peuvent pas être programmées : envoyez maintenant, ou visez tout le monde.');
    }
  }
  return erreurs;
}

function verifierBuilds(f, ajoute, { maxExclu }) {
  const min = entierOuNull(f.buildMin);
  const max = entierOuNull(f.buildMax);
  if (min !== null && !estEntierPositif(min)) ajoute('build_min', 'Un entier ≥ 1.');
  if (max !== null && !estEntierPositif(max)) ajoute('build_max', 'Un entier ≥ 1.');
  if (estEntierPositif(min) && estEntierPositif(max) && (maxExclu ? max <= min : max < min)) {
    ajoute('build_max', maxExclu ? 'Plus grand que le minimum (le maximum est exclu).' : 'Au moins égal au minimum.');
  }
}

// ---------- Message dans l'app : règles de la table ----------

export function messageInAppVide() {
  return {
    nom: '', format: 'feuille', emplacement: 'accueil_enfant', declencheur: 'prochaine_ouverture',
    declencheur_n: '', surtitre: '', titre: '', texte: '', points: [], image_chemin: '',
    bouton_libelle: '', destination: 'aucune', url: '',
    plateforme: '', classes: [], buildMin: '', buildMax: '',
    debut: '', fin: '', priorite: '0', max_affichages: '1',
    // 'inchangees' | 'toutes' | 'designees' (message_ecrire, plan-n7 § 4).
    // À la création, « toutes » = le message suit sa seule cible.
    familles: 'toutes', parentIds: [], famillesActuelles: null,
  };
}

// Un message rendu par `messages` → l'état du formulaire. Les familles
// ne sont jamais relues (le serveur n'en rend que le nombre) : par
// défaut, elles restent inchangées.
export function formulaireDepuisMessage(m) {
  const c = m.cible || {};
  return {
    nom: m.nom || '', format: m.format, emplacement: m.emplacement, declencheur: m.declencheur,
    declencheur_n: m.declencheur_n == null ? '' : String(m.declencheur_n),
    surtitre: m.surtitre || '', titre: m.titre || '', texte: m.texte || '',
    points: Array.isArray(m.points) ? [...m.points] : [], image_chemin: m.image_chemin || '',
    bouton_libelle: m.bouton_libelle || '', destination: m.destination || 'aucune', url: m.url || '',
    plateforme: c.plateforme || '', classes: Array.isArray(c.classes) ? [...c.classes] : [],
    buildMin: c.build_min == null ? '' : String(c.build_min), buildMax: c.build_max == null ? '' : String(c.build_max),
    debut: m.debut_at ? parisEnLocal(m.debut_at) : '', fin: m.fin_at ? parisEnLocal(m.fin_at) : '',
    priorite: String(m.priorite ?? 0), max_affichages: String(m.max_affichages ?? 1),
    familles: 'inchangees', parentIds: [], famillesActuelles: c.familles ?? null,
  };
}

// Ce que le formulaire propose, selon l'emplacement. `ouverture_notif`
// n'est JAMAIS proposé : aucune notification ne sait encore ouvrir un
// message. Un message existant qui le porte le garde (option grisée).
export function choixInApp(f) {
  const enfant = f.emplacement === 'accueil_enfant';
  const declencheurs = enfant ? ['prochaine_ouverture', 'fin_de_seance'] : ['prochaine_ouverture', 'nieme_entree_parent'];
  return {
    formats: enfant ? ['feuille'] : ['feuille', 'plein_ecran'],
    declencheurs: f.declencheur === 'ouverture_notif' ? [...declencheurs, 'ouverture_notif'] : declencheurs,
    destinations: enfant ? DESTINATIONS.filter((d) => d !== 'url') : DESTINATIONS,
  };
}

// Ramène le formulaire dans ce que l'emplacement permet (en place). Rend
// les changements faits, pour les dire à l'écran.
export function ajusterInApp(f) {
  const choix = choixInApp(f);
  const faits = [];
  if (!choix.formats.includes(f.format)) {
    f.format = choix.formats[0];
    faits.push('Sur l’accueil de l’enfant, c’est toujours Ari qui parle : format feuille.');
  }
  if (!choix.declencheurs.includes(f.declencheur)) {
    f.declencheur = 'prochaine_ouverture';
    faits.push('Déclencheur ramené à « à la prochaine ouverture » (le précédent ne vaut pas pour cet emplacement).');
  }
  if (!choix.destinations.includes(f.destination)) {
    f.destination = 'aucune';
    f.url = '';
    faits.push('Jamais d’adresse web côté enfant : destination retirée.');
  }
  return faits;
}

const texteOuNull = (v) => (v && v.trim() ? v : null);

// Formulaire → `params` de `message_ecrire` (sans message_id).
export function paramsMessageInApp(f) {
  const message = {
    nom: f.nom,
    format: f.format,
    emplacement: f.emplacement,
    declencheur: f.declencheur,
    declencheur_n: f.declencheur === 'nieme_entree_parent' ? entierOuNull(f.declencheur_n) : null,
    surtitre: texteOuNull(f.surtitre),
    titre: texteOuNull(f.titre),
    texte: texteOuNull(f.texte),
    points: f.points.filter((p) => p.trim()),
    image_chemin: texteOuNull(f.image_chemin),
    bouton_libelle: texteOuNull(f.bouton_libelle),
    destination: f.destination,
    priorite: entierOuNull(f.priorite) ?? 0,
    max_affichages: entierOuNull(f.max_affichages) ?? 1,
    debut_at: f.debut ? parisVersIso(f.debut) : null,
    fin_at: f.fin ? parisVersIso(f.fin) : null,
  };
  if (f.destination === 'url') message.url = f.url.trim();
  const cible = {};
  if (f.plateforme) cible.plateforme = f.plateforme;
  if (f.classes.length) cible.classes = [...f.classes];
  if (entierOuNull(f.buildMin) !== null) cible.build_min = entierOuNull(f.buildMin);
  if (entierOuNull(f.buildMax) !== null) cible.build_max = entierOuNull(f.buildMax);
  if (Object.keys(cible).length) message.cible = cible;

  const params = { message };
  // Une liste vide n'est jamais envoyée : elle serait refusée, et ne doit
  // pas ouvrir le message à tout le monde par erreur.
  if (f.familles === 'designees') params.parent_ids = [...f.parentIds];
  else if (f.familles === 'toutes') params.toutes_les_familles = true;
  return params;
}

// Les règles de `lireMessageInApp` et des contraintes SQL, une à une.
export function verifierMessageInApp(f) {
  const erreurs = [];
  const ajoute = (champ, message) => erreurs.push({ champ, message });
  const L = LIMITES_IN_APP;
  if (!f.nom.trim()) ajoute('nom', 'Le nom interne est obligatoire.');
  else if (f.nom.length > L.nom) ajoute('nom', L.nom + ' caractères au plus.');
  for (const champ of ['surtitre', 'titre', 'texte', 'bouton_libelle']) {
    if (f[champ] && f[champ].length > L[champ]) ajoute(champ, L[champ] + ' caractères au plus.');
  }
  const points = f.points.filter((p) => p.trim());
  if (points.length > L.points) ajoute('points', L.points + ' points au plus.');
  if (points.some((p) => p.length > L.point)) ajoute('points', L.point + ' caractères au plus par point.');
  if (f.image_chemin && (f.image_chemin.length > L.image_chemin || !CHEMIN_RE.test(f.image_chemin))) {
    ajoute('image_chemin', 'Un chemin dans le dossier d’images (ex. annonces/rentree.png), jamais une adresse.');
  }
  const enfant = f.emplacement === 'accueil_enfant';
  if (enfant && f.format !== 'feuille') ajoute('format', 'Sur l’accueil de l’enfant : feuille seulement.');
  if (f.destination === 'url') {
    if (enfant) ajoute('destination', 'Jamais d’adresse web côté enfant.');
    else if (!URL_RE.test(f.url.trim()) || f.url.trim().length > L.url) ajoute('url', 'Une adresse qui commence par https://');
  }
  if (f.destination !== 'aucune' && !texteOuNull(f.bouton_libelle)) {
    ajoute('bouton_libelle', 'Un libellé de bouton est obligatoire pour mener quelque part.');
  }
  if (f.declencheur === 'nieme_entree_parent') {
    if (!estEntierPositif(entierOuNull(f.declencheur_n))) ajoute('declencheur_n', 'Le rang de l’entrée : un entier ≥ 1.');
    if (f.emplacement !== 'espace_parent') ajoute('declencheur', 'La N-ième entrée ne vaut que dans l’espace parent.');
  }
  if (f.declencheur === 'fin_de_seance' && !enfant) ajoute('declencheur', 'La fin de séance ne vaut que sur l’accueil de l’enfant.');
  if (f.format === 'feuille' && !texteOuNull(f.texte)) ajoute('texte', 'Une feuille a besoin d’un texte.');
  if (f.format === 'plein_ecran' && !texteOuNull(f.titre)) ajoute('titre', 'Un plein écran a besoin d’un titre.');
  verifierBuilds(f, ajoute, { maxExclu: true });
  const debut = f.debut ? parisVersIso(f.debut) : null;
  const fin = f.fin ? parisVersIso(f.fin) : null;
  if (f.debut && !debut) ajoute('debut_at', 'Date invalide.');
  if (f.fin && !fin) ajoute('fin_at', 'Date invalide.');
  if (debut && fin && Date.parse(fin) <= Date.parse(debut)) ajoute('fin_at', 'Après le début.');
  const priorite = entierOuNull(f.priorite);
  if (priorite !== null && (!Number.isInteger(priorite) || Math.abs(priorite) > L.priorite)) {
    ajoute('priorite', 'Un entier entre -' + L.priorite + ' et ' + L.priorite + '.');
  }
  const max = entierOuNull(f.max_affichages);
  if (max !== null && (!estEntierPositif(max) || max > L.max_affichages)) {
    ajoute('max_affichages', 'Un entier entre 1 et ' + L.max_affichages + '.');
  }
  if (f.familles === 'designees') {
    if (f.parentIds.length === 0) ajoute('parent_ids', 'Choisissez au moins une famille (ou « toutes les familles »).');
    if (f.parentIds.length > LIMITES_NOTIF.familles) ajoute('parent_ids', LIMITES_NOTIF.familles + ' familles au plus.');
  }
  return erreurs;
}

// ---------- Résumés d'affichage ----------

// { plateforme, classes, build_min, build_max, familles } → « iOS · CM1, CM2 · build ≥ 40 · 3 familles choisies »
export function resumeCible(c, { maxExclu = false } = {}) {
  if (!c) return 'Tout le monde';
  const morceaux = [];
  if (c.plateforme) morceaux.push(c.plateforme === 'ios' ? 'iOS' : 'Android');
  if (Array.isArray(c.classes) && c.classes.length) morceaux.push(c.classes.join(', '));
  if (c.build_min != null && c.build_max != null) {
    morceaux.push('build ' + c.build_min + ' à ' + c.build_max + (maxExclu ? ' (exclu)' : ''));
  } else if (c.build_min != null) morceaux.push('build ≥ ' + c.build_min);
  else if (c.build_max != null) morceaux.push('build ' + (maxExclu ? '< ' : '≤ ') + c.build_max);
  if (c.familles != null) morceaux.push(c.familles + (c.familles > 1 ? ' familles choisies' : ' famille choisie'));
  return morceaux.length ? morceaux.join(' · ') : 'Tout le monde';
}

export function fmtFenetre(debut, fin) {
  if (!debut && !fin) return 'Sans limite de dates';
  if (debut && fin) return 'Du ' + fmtInstantParis(debut) + ' au ' + fmtInstantParis(fin);
  return debut ? 'À partir du ' + fmtInstantParis(debut) : 'Jusqu’au ' + fmtInstantParis(fin);
}

// Le libellé du téléphone d'essai (aucun jeton : l'Edge n'en rend pas).
export function libelleAppareil(a) {
  const plateforme = a.plateforme === 'ios' ? 'iPhone' : a.plateforme === 'android' ? 'Android' : (a.plateforme || 'Téléphone');
  const version = a.version_app ? ' · v' + a.version_app + (a.build != null ? ' (' + a.build + ')' : '') : '';
  const vu = a.dernier_vu_at ? ' · vu le ' + fmtInstantParis(a.dernier_vu_at) : '';
  return plateforme + version + vu;
}
