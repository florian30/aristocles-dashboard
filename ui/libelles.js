/* ============================================================
   Aristocles — Libellés d'affichage des valeurs socle
   api.js transmet les valeurs brutes ; une valeur inconnue est
   affichée telle quelle (contrat additif côté Edge).
   ============================================================ */

export const LIBELLE_MODE = { devoirs: 'Devoirs', entrainement: 'Entraînement' };

export const LIBELLE_STATUT = { active: 'En cours', archivee: 'Archivée' };

export const LIBELLE_TYPE_ECRAN = {
  captation: 'Captation des devoirs',
  vue_ensemble: "Vue d'ensemble",
  exercice: 'Exercice',
  pont_entrainement: 'Pont entraînement',
  bilan_session: 'Bilan de session',
};

// label + classe de couleur de la pastille.
export const LIBELLE_FERMETURE = {
  en_cours: { label: 'En cours', cls: 'is-info' },
  resolu_succes: { label: 'Résolu', cls: 'is-success' },
  resolu_fragile: { label: 'Résolu — fragile', cls: 'is-fragile' },
  interrompu_pause_explicite: { label: 'Interrompu (pause)', cls: 'is-muted' },
  interrompu_timeout_serveur: { label: 'Interrompu (timeout)', cls: 'is-muted' },
  interrompu_navigation: { label: 'Interrompu (navigation)', cls: 'is-muted' },
  abandon: { label: 'Abandonné', cls: 'is-failure' },
};

export const LIBELLE_RESULTAT = {
  succes: { label: 'Réussi', cls: 'is-success' },
  fragile: { label: 'Fragile', cls: 'is-fragile' },
  interrompu_pause: { label: 'Interrompu (pause)', cls: 'is-muted' },
  interrompu_timeout: { label: 'Interrompu (timeout)', cls: 'is-muted' },
  abandon: { label: 'Abandonné', cls: 'is-failure' },
};

export const LIBELLE_ORIGINE = {
  devoir_scolaire: 'Devoir scolaire',
  entrainement_complementaire: 'Entraînement complémentaire',
  entrainement_libre: 'Entraînement libre',
};

export const LIBELLE_MAITRISE = {
  jamais_vue: { label: 'Jamais vue', cls: 'is-muted' },
  fragile: { label: 'Fragile', cls: 'is-fragile' },
  en_cours: { label: 'En cours', cls: 'is-info' },
  acquise: { label: 'Acquise', cls: 'is-success' },
  parfaitement_acquise: { label: 'Parfaitement acquise', cls: 'is-success' },
};

export const LIBELLE_VU_EN_CLASSE = {
  presume_vu: 'Présumé vu',
  presume_non_vu: 'Présumé non vu',
  non_determine: '—',
};

// Rôles d'appel IA : libellé humain, rôle brut conservé en second.
export const LIBELLE_ROLE = {
  tutor: 'Tuteur',
  stt: 'Transcription voix (stt)',
  tts: 'Synthèse vocale (tts)',
  synthese_ecran: "Synthèse d'écran",
  bilan_session: 'Bilan de séance',
  vision_devoirs: 'Lecture des devoirs',
  'vision-parser': 'Lecture des devoirs (vision)',
};

// Clôture d'une séance (`cloture.motif`, § 1.4 du contrat).
export function libelleCloture(status, cloture) {
  const motif = cloture && cloture.motif;
  if (motif === 'menage_complet') return { label: 'Clôturée', cls: 'is-success' };
  if (motif === 'fermeture_a_froid') return { label: 'Fermée à froid', cls: 'is-fragile' };
  if (motif) return { label: motif, cls: 'is-muted' };
  if (status === 'active') return { label: 'En cours', cls: 'is-info' };
  return { label: 'Non soldée', cls: 'is-muted' };
}

// Entrées par mode (journal d'usage) : la dictée n'est pas un mode de séance.
export const LIBELLE_ENTREE = {
  apprentissage: 'Apprentissage',
  devoirs: 'Devoirs',
  dictee: 'Dictée',
  autre: 'Autre',
};

export const LIBELLE_INCIDENT = {
  tour_erreur: 'Erreur de tour',
  tour_anomalie: 'Anomalie de tour',
  filet_echec_llm: 'Filet : échec IA',
  ecriture_echec: 'Échec d’écriture',
};

export const LIBELLE_PLATEFORME = { ios: 'iOS', android: 'Android', web: 'Web' };

// Types d'interaction du mot à mot (§ 2.3).
export const LIBELLE_INTERACTION = {
  message_tuteur: 'Ari',
  message_enfant_vocal: 'vocal',
  message_enfant_texte: 'écrit',
  capture_photo: 'photo des devoirs',
  capture_description_orale: 'description orale',
  exercice_presente: 'Exercice présenté',
  exercice_resolu: 'Exercice résolu',
  pouce_haut_bas: 'Pouce',
};

export const LIBELLE_GENRE = { fille: 'fille', garcon: 'garçon', autre: 'autre', non_precise: 'genre non précisé' };

export const LIBELLE_BILAN = { quotidien: 'Bilan quotidien', hebdomadaire: 'Bilan hebdomadaire' };

export const LIBELLE_STATUT_BILAN = {
  genere: { label: 'Généré', cls: 'is-success' },
  matiere_insuffisante: { label: 'Matière insuffisante', cls: 'is-muted' },
};

export const LIBELLE_MEMOIRE = {
  intelligencesEmergentes: 'Intelligences émergentes',
  preferencesPedagogiques: 'Préférences pédagogiques',
  interetsPersonnels: 'Intérêts personnels',
  contextePersonnel: 'Contexte personnel',
  niveauDictee: 'Niveau de dictée',
};
