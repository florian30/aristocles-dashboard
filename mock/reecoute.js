/* ============================================================
   Mock des actions `reecoute_liste` et `reecoute_evaluer`
   (REECOUTE-VOIX lot 107-108, contrat-dashboard.md § 2.18-2.19 ;
   verdict `ecarter` et compteur `ecartees`, lot 116-117).
   Formes brutes de l'Edge. Comme retours.js, ce mock a un ÉTAT :
   une évaluation posée reste jusqu'au rechargement de la page.

   Douze prises fictives, de la plus ancienne à la plus récente :
   devoirs avec exercice (réponse attendue en objet), entraînement,
   dictée (`correction_dictee`), consigne de devoirs ajoutée au micro,
   « Pose-moi des questions » hors séance, une prise filtrée (silence,
   texte vide), une prise purgée (sans URL), une sans message d'Ari.
   Deux sont déjà notées (une OK, une Pas OK). Aucun prénom : `enfant`
   vaut « E-xxxxxx ». L'audio est le WAV muet factice de voix_seance.
   ============================================================ */

import { ApiError } from '../api.js';
import { SESSIONS } from './donnees.js';
import { AUDIO } from './voix_seance.js';

const VALIDITE_S = 3600;
const MODES = ['devoirs', 'entrainement', 'dictee', 'sans_seance'];
const FILTRES = ['aucun', 'silence', 'pattern', 'pattern_retire', 'court', 'amorce'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const id = (k, prefixe = '50000000') => prefixe + '-0000-4000-8000-' + String(k).padStart(12, '0');
const seanceDe = (mode) => SESSIONS.find((s) => s.mode === mode) || SESSIONS[0];

// [mode, contexte, filtre, transcription, ari avant, exercice, état, évaluation]
const GRAINES = [
  ['devoirs', null, 'aucun', 'cinquante-six', 'Combien font 7 × 8 ?', { code: 'ex-mult-7x8', enonce: 'Combien font 7 × 8 ?', reponse_attendue: { valeur: 56 } }, 'ok',
    { verdict: 'ok', bon_texte: null, commentaire: null }],
  ['devoirs', null, 'aucun', 'soixante trois', 'Bravo ! Et 7 × 9 ?', { code: 'ex-mult-7x9', enonce: 'Combien font 7 × 9 ?', reponse_attendue: { valeur: 63 } }, 'ok', null],
  ['devoirs', null, 'silence', '', 'Prends ton temps. Tu veux que je répète la question ?', null, 'ok', null],
  ['entrainement', null, 'aucun', 'la Seine elle passe à Paris', 'Quel fleuve traverse Paris ?', { code: 'ex-fleuves-paris', enonce: 'Quel fleuve traverse Paris ?', reponse_attendue: 'la Seine' }, 'ok',
    { verdict: 'pas_ok', bon_texte: 'la Seine, elle passe à Paris', commentaire: 'virgule perdue, sans gravité' }],
  ['entrainement', null, 'aucun', 'le rône', 'Et le fleuve qui va jusqu’à Marseille ?', { code: 'ex-fleuves-sud', enonce: 'Range les fleuves du nord au sud.', reponse_attendue: { 1: 'la Seine', 2: 'la Loire', 3: 'le Rhône' } }, 'ok', null],
  ['dictee', 'correction_dictee', 'aucun', 'non c’est avec deux l', 'Tu as écrit « bale ». Tu veux le corriger ?', null, 'ok', null],
  ['dictee', 'correction_dictee', 'court', '', 'Regarde le mot « château ».', null, 'ok', null],
  ['devoirs', 'consigne_devoirs', 'aucun', 'et aussi la poésie pour vendredi', 'Tu as d’autres devoirs ?', null, 'ok', null],
  ['sans_seance', 'questions_ari', 'aucun', 'tu as quel âge', null, null, 'ok', null],
  ['entrainement', null, 'aucun', 'je sais pas', 'Comment s’appelle le résultat d’une addition ?', { code: 'ex-vocab-somme', enonce: 'Le résultat d’une addition s’appelle…', reponse_attendue: null }, 'purgee', null],
  ['devoirs', null, 'aucun', 'bonjour Ari', null, null, 'ok', null],
  ['entrainement', null, 'pattern_retire', 'douze', 'Combien font 3 × 4 ?', { code: 'ex-mult-3x4', enonce: 'Combien font 3 × 4 ?', reponse_attendue: ['12', 'douze'] }, 'ok', null],
];

function graines(maintenant) {
  const base = maintenant - 3 * 86400000;
  return GRAINES.map(([mode, contexte, filtre, transcription, ari, exercice, etat, evaluation], k) => {
    const le = base + k * 47 * 60000;
    const hors = mode === 'sans_seance';
    const s = hors ? null : seanceDe(mode);
    return {
      prise_id: id(k + 1),
      prise_le: new Date(le).toISOString(),
      enfant: 'E-' + ['3f9a2c', 'b71e04', '0c5d8a'][k % 3],
      session_id: s ? s.id : null,
      mode: hors ? null : mode,
      _mode: mode,
      contexte,
      filtre,
      duree_s: filtre === 'silence' ? 0.6 : filtre === 'court' ? 0.3 : 1.4 + (k % 4) * 0.7,
      transcription,
      interaction_id: filtre === 'aucun' && !hors ? id(k + 1, '70000000') : null,
      message_ari_avant: ari && !hors ? { interaction_id: id(k + 100, '70000000'), texte: ari, le: new Date(le - 6000).toISOString() } : null,
      exercice,
      etat,
      evaluation: evaluation ? { ...evaluation, evalue_le: new Date(maintenant - 3600000).toISOString() } : null,
    };
  });
}

const booleen = (v) => typeof v === 'boolean';

export function creerReecouteMock({ maintenant = () => Date.now() } = {}) {
  const prises = graines(maintenant());

  return {
    reecoute_liste(params = {}) {
      const page = params.page ?? 1;
      const parPage = params.par_page ?? 50;
      if (!Number.isInteger(page) || page < 1) throw new ApiError("'page' must be an integer >= 1", 400);
      if (!Number.isInteger(parPage) || parPage < 1) throw new ApiError("'par_page' must be an integer >= 1", 400);
      if (params.non_evaluees != null && !booleen(params.non_evaluees)) throw new ApiError("'non_evaluees' must be a boolean", 400);
      if (params.mode != null && !MODES.includes(params.mode)) throw new ApiError("'mode' must be one of " + MODES.map((m) => "'" + m + "'").join(', '), 400);
      if (params.contexte != null && typeof params.contexte !== 'string') throw new ApiError("'contexte' must be a string", 400);
      if (params.filtre != null && !FILTRES.includes(params.filtre)) throw new ApiError("'filtre' must be one of " + FILTRES.join(', '), 400);
      const taille = Math.min(parPage, 100);
      const filtrees = prises.filter((p) => (params.non_evaluees !== true || !p.evaluation)
        && (!params.mode || p._mode === params.mode)
        && (params.contexte == null || p.contexte === params.contexte)
        && (!params.filtre || p.filtre === params.filtre));
      const nbPages = Math.ceil(filtrees.length / taille);
      const expire = maintenant() + VALIDITE_S * 1000;
      const debut = (page - 1) * taille;
      return {
        compteurs: {
          total: prises.length,
          evaluees: prises.filter((p) => p.evaluation).length,
          pas_ok: prises.filter((p) => p.evaluation?.verdict === 'pas_ok').length,
          ecartees: prises.filter((p) => p.evaluation?.verdict === 'ecarter').length,
        },
        nb_resultats: filtrees.length,
        page,
        par_page: taille,
        nb_pages: nbPages,
        validite_s: VALIDITE_S,
        expire_le: new Date(expire).toISOString(),
        prises: filtrees.slice(debut, debut + taille).map(({ _mode, ...p }, i) => ({
          ...p,
          rang: debut + i + 1,
          url: p.etat === 'ok' ? AUDIO : null,
        })),
      };
    },

    reecoute_evaluer(params = {}) {
      if (typeof params.prise_id !== 'string' || !UUID.test(params.prise_id)) throw new ApiError("'prise_id' is required and must be a uuid", 400);
      if (!['ok', 'pas_ok', 'ecarter'].includes(params.verdict)) throw new ApiError("'verdict' must be one of 'ok', 'pas_ok', 'ecarter'", 400);
      for (const champ of ['bon_texte', 'commentaire']) {
        const v = params[champ];
        if (v != null && (typeof v !== 'string' || v.length > 2000)) throw new ApiError("'" + champ + "' must be a string of at most 2000 characters", 400);
      }
      const p = prises.find((x) => x.prise_id === params.prise_id);
      if (!p) throw new ApiError('Unknown prise_id', 404);
      const net = (v) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null);
      p.evaluation = {
        verdict: params.verdict,
        bon_texte: params.verdict === 'pas_ok' ? net(params.bon_texte) : null,
        commentaire: typeof params.commentaire === 'string' && params.commentaire.trim() ? params.commentaire.trim() : null,
        evalue_le: new Date(maintenant()).toISOString(),
      };
      return { prise_id: p.prise_id, ...p.evaluation };
    },
  };
}
