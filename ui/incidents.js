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
  content_filter: 'Le fournisseur a refusé le contenu (filtre)',
  delai_depasse: 'Le fournisseur a mis trop longtemps',
  amont_5xx: 'Le fournisseur est tombé (erreur 5xx)',
  limite_debit: 'Trop d’appels d’un coup (limite du fournisseur)',
  troncature: 'Réponse coupée avant la fin',
  recherche_notion_relance: 'Recherche de notion relancée',
  forme_inattendue: 'Réponse de forme inattendue',
  autre: 'Autre signal',
  sans_cause: 'Appel en échec, sans cause lisible',
  appels: 'Appels IA (volume, échecs, temps de réponse, coût)',
  tour_erreur: 'Un tour de l’enfant n’a pas abouti',
  filet_echec_llm: 'Le filet de secours n’a pas pu répondre',
  'tour_anomalie:echec_llm': 'Tour sans réponse de l’IA',
  ecriture_echec: 'Échec d’enregistrement',
  tts_fallback_correction: 'Voix de secours pendant une correction',
  client_event: 'Événements du carnet de l’app',
  quiz_repli_simple: 'Un quiz servi sans validation',
  dictee_echec: 'Une dictée finie en échec',
  cron_echec: 'Une exécution de l’automate a échoué',
  cron_executions: 'Exécutions de l’automate (toutes réussies)',
  cron_en_retard: 'L’automate n’a pas tourné à temps',
  cron_jamais_execute: 'L’automate n’a jamais tourné',
};

// → { libelle, brut } : `brut` (le code) reste visible en note pour creuser.
export function libelleCode(code) {
  const c = String(code || '');
  if (LIBELLE_CODE[c]) return { libelle: LIBELLE_CODE[c], brut: c };
  if (c.startsWith('erreur_client:')) {
    const [zone, type] = c.slice('erreur_client:'.length).split('/');
    return { libelle: 'Plantage de l’app' + (zone ? ' — ' + zone : '') + (type ? ' · ' + type : ''), brut: c };
  }
  if (c.startsWith('tour_anomalie:')) return { libelle: 'Anomalie pendant un tour (' + c.slice('tour_anomalie:'.length) + ')', brut: c };
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
