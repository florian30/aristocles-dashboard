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
};
