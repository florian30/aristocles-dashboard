/* ============================================================
   Aristocles — page Retours (retours parents « Votre avis »,
   AVIS-3) : libellés et règles pures, testées sous Deno.
   Valeurs : docs/reference/contrat-retour-parent.md (dépôt app).
   ============================================================ */

export const LIBELLE_CATEGORIE = { bug: 'Bug', idee: 'Idée', exercice: 'Exercice', autre: 'Autre' };
export const LIBELLE_OU = {
  apprentissage: 'Apprentissage', devoirs: 'Devoirs', dictee: 'Dictée', espace_parent: 'Espace parent', ailleurs: 'Ailleurs',
};
export const LIBELLE_SAISIE = { texte: 'Texte', voix: 'Voix', mixte: 'Texte et voix' };
export const LIBELLE_STATUT_RETOUR = { nouveau: 'Nouveau', lu: 'Lu', inscrit: 'Inscrit au registre', clos: 'Clos' };
// Couleur de la pastille de statut (classes de styles.css).
export const CLASSE_STATUT_RETOUR = { nouveau: 'is-fragile', lu: 'is-info', inscrit: 'is-success', clos: 'is-muted' };

// Référence du registre : R-JJMM-sujet (même règle que l'Edge).
export const MOTIF_REF_REGISTRE = /^R-\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const REF_REGISTRE_MAX = 60;

// Saisie du champ « Référence registre » → valeur à envoyer :
// vide → null (effacer), sinon le texte nettoyé ; `erreur` si mal formé.
export function lireRefRegistre(saisie) {
  const t = String(saisie ?? '').trim();
  if (!t) return { valeur: null, erreur: null };
  if (t.length > REF_REGISTRE_MAX || !MOTIF_REF_REGISTRE.test(t)) {
    return { valeur: null, erreur: 'Forme attendue : R-JJMM-sujet (minuscules, chiffres, tirets), ex. R-1010-dictee-rotation.' };
  }
  return { valeur: t, erreur: null };
}

// Filtre de statut lu dans le hash (?statut=…) ; inconnu → aucun.
export function statutDepuisQuery(query) {
  const s = query && query.statut;
  return Object.hasOwn(LIBELLE_STATUT_RETOUR, s || '') ? s : null;
}

// « 1 nouveau », « 3 nouveaux » (pastille de l'onglet, page).
export function libelleNouveaux(n) {
  return n + (n > 1 ? ' nouveaux' : ' nouveau');
}

// Qui a écrit : « parent de Léa (CE2) », sinon « un parent ».
export function auteurRetour(r) {
  if (!r.enfant || !r.enfant.prenom) return 'un parent';
  return 'parent de ' + r.enfant.prenom + (r.enfant.classe ? ' (' + r.enfant.classe + ')' : '');
}

// « iOS · 1.4.0 (212) · prod » ; les champs absents sont omis.
export function resumeApp(app, libellesPlateforme = {}) {
  const a = app || {};
  const version = a.version ? a.version + (a.build != null ? ' (' + a.build + ')' : '') : a.build != null ? 'build ' + a.build : null;
  return [a.plateforme ? libellesPlateforme[a.plateforme] || a.plateforme : null, version, a.env].filter(Boolean).join(' · ') || '—';
}

// Détail d'un événement d'usage sur une ligne (affiché par textContent).
export function detailCourt(detail) {
  if (detail == null) return '';
  if (typeof detail !== 'object') return String(detail);
  return Object.entries(detail).map(([k, v]) => k + ' : ' + (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v))).join(' · ');
}
