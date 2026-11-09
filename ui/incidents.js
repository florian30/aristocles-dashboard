/* ============================================================
   Aristocles — Page Incidents (fonctions pures, testées sous Deno)
   Veille de la prod (action `veille`, veille-prod.md § 7) : fenêtre
   choisie, sélection famille / jour lue dans le hash, filtrage des
   lignes de la vue, libellés produit des codes fermés (§ 2).
   Un code inconnu (contrat additif) s'affiche brut.
   ============================================================ */

export const FAMILLES = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'];

export const FENETRES = [7, 14, 30, 92];
export const FENETRE_PAR_DEFAUT = 14;

// Libellés de secours : l'Edge envoie les siens (`familles[].libelle`).
export const LIBELLE_FAMILLE = {
  F1: 'Un enfant n’a pas eu ce qu’il demandait',
  F2: 'Un fournisseur refuse ou tombe',
  F3: 'Le filet de secours a aussi raté',
  F4: 'Un automate ne tourne plus',
  F5: 'Pic de latence',
  F6: 'Hausse de coût',
  F7: 'Silence anormal',
  F8: 'Plantages de l’app',
};

// Couleur (classe) + mot : le niveau ne repose jamais sur la seule couleur.
export const NIVEAU = {
  vert: { label: 'RAS', titre: 'Rien à signaler', cls: 'is-vert' },
  orange: { label: 'À surveiller', titre: 'À surveiller', cls: 'is-orange' },
  rouge: { label: 'À traiter', titre: 'À traiter', cls: 'is-rouge' },
};

// F5 / F6 / F7 comparent des jours entre eux : leur détail est dans les
// motifs et dans les lignes `mesure` du jour, pas dans des lignes à eux.
export const FAMILLES_PAR_MESURE = ['F5', 'F6', 'F7'];

// ?jours=7|14|30|92 (défaut 14) ; ?famille=F1…F8 ; ?jour=AAAA-MM-JJ
// (gardé seulement s'il est dans la série reçue).
export function selectionDepuisQuery(query = {}, joursDeLaSerie = null) {
  const n = Number(query.jours);
  const jours = FENETRES.includes(n) && String(n) === String(query.jours) ? n : FENETRE_PAR_DEFAUT;
  const famille = FAMILLES.includes(query.famille) ? query.famille : null;
  let jour = /^\d{4}-\d{2}-\d{2}$/.test(query.jour || '') ? query.jour : null;
  if (jour && joursDeLaSerie && !joursDeLaSerie.includes(jour)) jour = null;
  return { jours, famille, jour };
}

// Query du hash pour une sélection (valeurs vides retirées, défaut implicite).
export function queryDeSelection({ jours, famille, jour }) {
  const query = {};
  if (jours && jours !== FENETRE_PAR_DEFAUT) query.jours = String(jours);
  if (famille) query.famille = famille;
  if (jour) query.jour = jour;
  return query;
}

const ORDRE_GROUPE = (f) => (FAMILLES.includes(f) ? FAMILLES.indexOf(f) : f === 'info' ? 8 : 9);

// Lignes à montrer pour une sélection, réparties en deux tableaux :
// `signaux` (familles F1…F8) et `contexte` (info : vu sans voyant ;
// mesure : volumes, latences, coûts). Plus récentes d'abord.
export function filtrerLignes(lignes, { famille = null, jour = null } = {}) {
  if (!famille && !jour) return { signaux: [], contexte: [] };
  const duJour = lignes.filter((l) => !jour || l.jour === jour);
  let signaux;
  let contexte;
  if (famille) {
    signaux = duJour.filter((l) => l.famille === famille);
    contexte = FAMILLES_PAR_MESURE.includes(famille) ? duJour.filter((l) => l.famille === 'mesure') : [];
  } else {
    signaux = duJour.filter((l) => FAMILLES.includes(l.famille));
    contexte = duJour.filter((l) => !FAMILLES.includes(l.famille));
  }
  const tri = (a, b) => b.jour.localeCompare(a.jour) || ORDRE_GROUPE(a.famille) - ORDRE_GROUPE(b.famille) || b.nb - a.nb;
  return { signaux: signaux.sort(tri), contexte: contexte.sort(tri) };
}

// Codes fermés de la vue (veille-prod.md § 2), en langage produit.
const LIBELLE_CODE = {
  relance_echouee: 'Le second lecteur a raté aussi',
  repli_premiere_tentative: 'Texte de secours servi',
  texte_bloque_remplace: 'Texte bloqué, remplacé par un texte de secours',
  relance_reussie: 'Le second lecteur a sauvé la page',
  relance_abandonnee: '1re réponse écartée, relance faite',
  content_filter: 'Le fournisseur a refusé le contenu (filtre)',
  delai_depasse: 'Le fournisseur a mis trop longtemps',
  amont_5xx: 'Le fournisseur est tombé (erreur 5xx)',
  limite_debit: 'Trop d’appels d’un coup (limite du fournisseur)',
  amont_4xx: 'Le fournisseur a refusé la requête (erreur 4xx)',
  repli_servi: 'Texte de secours servi, l’enfant n’a rien vu',
  garde_pedagogique: 'Garde de la dictée : phrase remplacée (voulu)',
  recherche_notion_relance_4xx: 'Recherche de notion refusée, 1re réponse servie',
  troncature: 'Réponse coupée avant la fin',
  recherche_notion_relance: 'Recherche de notion relancée',
  forme_inattendue: 'Réponse de forme inattendue',
  autre: 'Autre signal',
  sans_cause: 'Appel en échec, sans cause lisible',
  appels: 'Appels IA (volume, échecs, temps de réponse, coût)',
  tour_erreur: 'Un tour de l’enfant n’a pas abouti',
  filet_echec_llm: 'Le filet de secours n’a pas pu répondre',
  'tour_anomalie:echec_llm': 'Tour sans réponse de l’IA',
  quota_atteint: 'Plafond du jour atteint, Ari « fatigué » (voulu)',
  'tour_erreur:doublon': 'Même tour sans réponse de l’IA (déjà compté)',
  'filet_echec_llm:doublon': 'Filet du même tour (déjà compté)',
  ecriture_echec: 'Échec d’enregistrement',
  tts_fallback_correction: 'Voix de secours pendant une correction',
  client_event: 'Événements du carnet de l’app',
  quiz_repli_simple: 'Un quiz servi sans validation',
  dictee_echec: 'Une dictée finie en échec',
  cron_echec: 'Une exécution de l’automate a échoué',
  cron_executions: 'Exécutions de l’automate (toutes réussies)',
  cron_en_retard: 'L’automate n’a pas tourné à temps',
  cron_jamais_execute: 'L’automate n’a jamais tourné',
  cron_http_echec: 'Un automate a appelé une fonction, qui a échoué ou n’a pas répondu',
  cron_http_reponses: 'Appels des automates vers les fonctions (tous réussis)',
  purge_echec: 'La purge des photos n’a pas tout effacé',
  purge_passages: 'Passages de la purge des photos (tous réussis)',
  extraction_echec: 'L’extraction des mémoires a échoué (écrans à rejouer)',
  extraction_bloquee: 'L’extraction des mémoires est restée bloquée (écrans figés)',
  // OBS-SERVEUR (15-10-2026) : appels amont, photos, dictée.
  amont_reseau: 'Le fournisseur était injoignable (réseau)',
  amont_corps_illisible: 'Le fournisseur a rendu une réponse illisible',
  carte_illisible: 'Photo de cahier illisible, l’enfant l’a reprise',
  copie_illisible: 'Copie de dictée illisible, l’enfant l’a reprise',
  dictee_bloquee: 'Une dictée restée en préparation (l’enfant a attendu)',
  dictee_repli_simple: 'Une dictée servie en mode secours',
  // OBS-SERVEUR : refus d'une fonction AVANT l'IA (table `edge_echec`).
  auth_refusee: 'Connexion refusée (jeton expiré, le parent se reconnecte)',
  auth_indisponible: 'Le service de connexion ne répondait pas',
  corps_illisible: 'Requête illisible reçue de l’app',
  requete_invalide: 'Requête incomplète ou mal formée',
  perimetre_refuse: 'Accès refusé (hors du compte du parent)',
  introuvable: 'Élément demandé introuvable',
  conflit: 'Élément déjà pris (conflit)',
  quota_indisponible: 'Le compteur du plafond ne répondait pas',
  photo_telechargement: 'La photo n’a pas pu être téléchargée',
  config_absente: 'Une clé de service manque au serveur',
  base_echec: 'La base de données a échoué',
  quiz_zero_question: 'Quiz non servi (aucune question utilisable)',
  exception: 'Plantage imprévu de la fonction',
  // OBS-SEANCE 5a (16-10-2026) : pannes de séance tracées par l'app.
  exercice_selection: 'Le choix de l’exercice a échoué',
  filet_sans_voix: 'Phrase de secours affichée, sans la voix d’Ari',
  outil_inconnu: 'Ari a demandé une action que l’app ne connaît pas',
  echec_stt: 'La transcription de la voix de l’enfant a échoué',
  photo_sans_page: 'Photo envoyée, aucune page reconnue en retour',
  echec_micro: 'Le micro a planté',
  micro_refuse: 'Micro refusé sur l’appareil',
  quiz_en_avance_echec: 'Le quiz préparé à l’avance a échoué',
  quiz_pas_pret: 'L’enfant a dit oui, le quiz n’était pas prêt',
  quiz_lecture_echec: 'La lecture des quiz du devoir a échoué',
};

// Cause d'une dictée en échec (`dictee_echec_<cause>`, liste fermée de
// `dictation.echec_cause`, OBS-SERVEUR).
const CAUSE_DICTEE = {
  generation: 'texte non fabriqué',
  generation_impossible: 'aucun texte possible avec ces mots',
  voix: 'voix non fabriquée',
  base: 'enregistrement raté',
  exception: 'plantage imprévu',
};

// OBS-APP-HORS-SEANCE (16-10-2026) : zones et types de `erreur_client`
// (veille-prod.md § 2). Ils se lisent DANS un code `erreur_client:<zone>/<type>`,
// d'où deux tables à part. Une zone ou un type inconnu reste brut (contrat additif).
// ⚠️ COPIE de supabase/functions/veille/_libelles.ts (dépôt principal) : un
// libellé changé d'un côté se recopie de l'autre.

// Zone de l'app où l'échec est survenu (`lib/usage/erreur_client.dart`).
const ZONE_ERREUR_CLIENT = {
  dictee_generer: 'préparation de la dictée',
  dictee_audio: 'téléchargement du son de la dictée',
  dictee_etape: 'enregistrement d’une étape de la dictée',
  dictee_correction: 'lecture de la copie de dictée',
  dictee_listes: 'listes de mots de la dictée',
  dictee_replique: 'réplique d’Ari pendant la dictée (repli servi)',
  dictee_lecture: 'voix d’Ari pendant la dictée',
  dictee_photo: 'photo de la copie de dictée',
  devoirs_lecture: 'lecture du devoir',
  devoirs_photo: 'photo du devoir',
  illustration: 'illustration d’une notion',
  exercice_chargement: 'chargement d’un exercice',
  stt_devoirs: 'micro des devoirs',
  stt_dictee: 'micro de la dictée',
  stt_onboarding: 'micro de la découverte',
  stt_parent: 'micro de l’espace parent',
  stt_recherche_notion: 'micro de la recherche de notion',
  pin_parent: 'code PIN du parent',
  parent_bilans: 'bilans de l’espace parent',
  parent_devoirs: 'bilans des devoirs (espace parent)',
  parent_dictees: 'bilans des dictées (espace parent)',
  parent_enfant: 'fiche de l’enfant (espace parent)',
  parent_compte: 'suppression du compte (espace parent)',
  parent_hub: 'accueil de l’espace parent',
  parent_ari: '« Parler à Ari » (espace parent)',
  parent_avis: 'avis du parent',
  parent_notifs: 'réglages des notifications',
  usage_flush: 'envoi des traces d’usage (lots perdus)',
};

// Nature de l'échec. `http_<statut>` est une famille à motif, traitée dans
// `libelleTypeErreurClient`.
const TYPE_ERREUR_CLIENT = {
  delai: 'délai dépassé',
  reseau: 'pas de réseau',
  quota_atteint: 'plafond du jour atteint (voulu)',
  forme: 'réponse de forme inattendue',
  json: 'réponse illisible',
  micro_refuse: 'micro refusé',
  micro_indisponible: 'micro impossible à lancer',
  camera: 'caméra refusée ou photo ratée',
  upload_echec: 'envoi du fichier raté',
  stockage: 'stockage des fichiers en échec',
  preparation_bloquee: 'dictée bloquée en préparation',
  generation_impossible: 'lecture ou fabrication impossible',
  base: 'la base de données a refusé',
  auth: 'connexion refusée',
  lecteur: 'lecture du son sur l’appareil ratée',
  autre: 'cause inconnue',
};

// Libellé d'un type d'`erreur_client`, `undefined` s'il est inconnu.
function libelleTypeErreurClient(type) {
  if (TYPE_ERREUR_CLIENT[type]) return TYPE_ERREUR_CLIENT[type];
  const statut = /^http_(.+)$/.exec(type);
  return statut ? 'refus du serveur (HTTP ' + statut[1] + ')' : undefined;
}

// → { libelle, brut } : `brut` (le code) reste visible en note pour creuser.
export function libelleCode(code) {
  const c = String(code || '');
  if (LIBELLE_CODE[c]) return { libelle: LIBELLE_CODE[c], brut: c };
  if (c.startsWith('erreur_client:')) {
    const [zone, type] = c.slice('erreur_client:'.length).split('/');
    const zoneLue = zone ? ZONE_ERREUR_CLIENT[zone] ?? zone : '';
    const typeLu = type ? libelleTypeErreurClient(type) ?? type : '';
    return { libelle: 'Plantage de l’app' + (zoneLue ? ' — ' + zoneLue : '') + (typeLu ? ' · ' + typeLu : ''), brut: c };
  }
  if (c.startsWith('tour_anomalie:')) return { libelle: 'Anomalie pendant un tour (' + c.slice('tour_anomalie:'.length) + ')', brut: c };
  if (c.startsWith('dictee_echec_')) {
    const cause = c.slice('dictee_echec_'.length);
    return { libelle: 'Une dictée finie en échec (' + (CAUSE_DICTEE[cause] ?? cause) + ')', brut: c };
  }
  return { libelle: c || '—', brut: null };
}

export function libelleFonction(fonction) {
  if (!fonction) return null;
  if (fonction.startsWith('cron:')) return 'Automate « ' + fonction.slice(5) + ' »';
  return { llm: 'IA', app: 'App', quiz: 'Quiz', dictee: 'Dictée' }[fonction] || fonction;
}

export function libelleGroupe(famille) {
  if (famille === 'info') return 'Vu, sans voyant';
  if (famille === 'mesure') return 'Mesure';
  return famille;
}

// Seules les lignes `appels` portent un coût : null y est un coût
// inconnu (« inconnu », jamais 0 €) ; les autres lignes n'en ont pas.
export function porteUnCout(ligne) {
  return ligne.code === 'appels';
}

// « 3 » ; « 2 sur 80 » quand un dénominateur existe.
export function fmtCompte(nb, nbTotal) {
  return nbTotal == null ? String(nb) : nb + ' sur ' + nbTotal;
}

// Résumé d'une famille sur la fenêtre : « 2 jours rouges · 1 jour orange ».
export function resumeJours(f) {
  const parts = [];
  if (f.joursRouges) parts.push(f.joursRouges + (f.joursRouges > 1 ? ' jours rouges' : ' jour rouge'));
  if (f.joursOrange) parts.push(f.joursOrange + (f.joursOrange > 1 ? ' jours orange' : ' jour orange'));
  return parts.join(' · ');
}

// Familles non vertes d'un point de la série, F1 → F8.
export function famillesSignalees(point) {
  return FAMILLES.filter((f) => point.familles[f] && point.familles[f].niveau !== 'vert')
    .map((f) => ({ famille: f, ...point.familles[f] }));
}
