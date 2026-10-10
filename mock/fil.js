/* ============================================================
   Aristocles — Mot à mot factice (`?mock=1`), formes brutes de l'Edge
   Fils tour par tour des écrans (§ 2.3 `interactions[]`), devoir et
   dictée d'une séance, photos de devoirs (dont une purgée par
   séance), appels IA du tuteur (§ 2.9 `tour`, trace purgée pour les
   séances d'au moins 7 jours). Partagé par session_detail, enfant,
   tour, photo et journee pour que tout reste cohérent.
   Tout est fictif ; certains messages contiennent « < » ou « & »
   pour vérifier que l'affichage reste en texte brut.
   ============================================================ */

import { aujourdhuiParis, debutJourParisMs, decalerJour, ecartJours, hierParis, jourParis } from '../ui/paris.js';
import { CHILDREN, SESSIONS } from './donnees.js';

// Fils par scénario (voir SCENARIOS de donnees.js) puis par position
// d'écran : [secondes depuis le début, type, texte, options].
// options : { photo, purgee, meta }.
const FILS = {
  // 0 — Les fractions (entraînement)
  0: {
    2: [
      [95, 'exercice_presente', "Une tarte est partagée en 4 parts égales. J'en mange 3. Quelle fraction de la tarte reste-t-il ?", { meta: { exercise_id: 'xr-101' } }],
      [98, 'message_tuteur', "Imagine la tarte coupée en 4. Si tu en manges 3 parts, combien de parts restent dans le plat ?"],
      [112, 'message_enfant_vocal', "il en reste une"],
      [116, 'message_tuteur', "Oui ! Et une part sur quatre, comment tu l'écrirais en fraction ?"],
      [127, 'message_enfant_texte', "1/4"],
      [131, 'message_tuteur', "Exactement, il reste 1/4 de la tarte. Tu peux m'expliquer pourquoi le 4 est en bas ?"],
      [150, 'message_enfant_vocal', "parce que c'est le nombre de parts en tout"],
      [152, 'exercice_resolu', null, { meta: { exercise_id: 'xr-101', resultat: 'succes' } }],
    ],
    3: [
      [150, 'exercice_presente', "Range les fractions 2/3 et 3/4 de la plus petite à la plus grande.", { meta: { exercise_id: 'xr-102' } }],
      [152, 'message_tuteur', "Entre 2/3 et 3/4, laquelle est la plus grande d'après toi ?"],
      [158, 'message_enfant_vocal', "3/4 parce que 3 et 4 c'est plus grand que 2 et 3"],
      [161, 'message_tuteur', "C'est une idée. Mais est-ce que des parts de tiers et des parts de quarts ont la même taille ?"],
      [170, 'message_enfant_vocal', "euh non les tiers c'est plus gros"],
      [173, 'message_tuteur', "Bien vu. Comment pourrait-on couper les deux tartes en parts de la même taille ?"],
      [190, 'message_enfant_texte', "en 12 ! 2/3 = 8/12 et 3/4 = 9/12 donc 2/3 < 3/4"],
      [194, 'message_tuteur', "Bravo, tu as trouvé le même dénominateur tout seul. 8/12 < 9/12, donc 2/3 < 3/4."],
      [200, 'exercice_resolu', null, { meta: { exercise_id: 'xr-102', resultat: 'fragile' } }],
      [204, 'pouce_haut_bas', null, { meta: { valeur: 'haut' } }],
    ],
  },
  // 1 — L'accord du participe passé (devoirs)
  1: {
    1: [
      [20, 'capture_photo', null, { photo: true }],
      [28, 'capture_photo', null, { photo: true, purgee: true }],
      [41, 'message_tuteur', "Merci ! Je vois deux phrases à compléter sur le participe passé. Tu veux me dire ce que ta maîtresse demande ?"],
      [60, 'capture_description_orale', "il faut accorder le verbe entre parenthèses, c'est pour demain"],
      [66, 'message_tuteur', "Parfait, on les fait l'une après l'autre."],
    ],
    2: [
      // Consigne corrigée par l'enfant : le texte lu sur la photo reste dans
      // metadata.enonce_origine, contenu_texte porte la version corrigée.
      [90, 'exercice_presente', "Complète en accordant le participe passé si nécessaire : « Les lettres que j'ai (écrire) … sont sur la table. »", { meta: {
        exercise_id: 'xr-201', matiere: 'français', confiance: 'moyenne', corrige_par_enfant: true,
        enonce_origine: "Complète en acordant le participe passé : « Les lettres que j'ai (écrire) … sont sur la tabe. »" } }],
      [95, 'message_tuteur', "Dans cette phrase, qu'est-ce qui a été écrit ?"],
      [110, 'message_enfant_vocal', "les lettres"],
      [114, 'message_tuteur', "Oui ! Et « les lettres », tu les trouves avant ou après « ai écrit » ?"],
      [131, 'message_enfant_vocal', "avant… du coup on accorde ?"],
      [136, 'message_tuteur', "Qu'est-ce que tu en penses ? Rappelle-toi la règle avec avoir quand le COD est placé avant."],
      [152, 'message_enfant_texte', "écrites"],
      [156, 'message_tuteur', "Bravo : « écrites », avec -es, parce que « les lettres » est au féminin pluriel."],
      [160, 'exercice_resolu', null, { meta: { exercise_id: 'xr-201', resultat: 'succes' } }],
      [170, 'pouce_haut_bas', null, { meta: { valeur: 'haut' } }],
    ],
    3: [
      [200, 'exercice_presente', "Complète en accordant le participe passé si nécessaire : « Elles ont (manger) … une pomme. »", { meta: { exercise_id: 'xr-202', matiere: 'français', confiance: 'haute' } }],
      [204, 'message_tuteur', "À toi pour la deuxième phrase. Qu'est-ce qu'elles ont mangé ?"],
      [220, 'message_enfant_vocal', "une pomme… alors mangées"],
      [225, 'message_tuteur', "Regarde bien : « une pomme » est avant ou après le verbe ?"],
      [240, 'message_enfant_vocal', "après & donc on accorde pas, c'est mangé"],
      [244, 'message_tuteur', "Exactement. Le COD est après le verbe : on n'accorde pas."],
      [250, 'exercice_resolu', null, { meta: { exercise_id: 'xr-202', resultat: 'fragile' } }],
    ],
    5: [
      [72, 'exercice_presente', "Recopie la leçon sur le participe passé dans ton cahier.", { meta: { matiere: 'français', confiance: 'basse' } }],
    ],
    6: [
      [80, 'exercice_presente', "Conjugue « finir » au passé composé avec « nous ».", { meta: { matiere: 'français', notions_pressenties: [], confiance: 'haute', ajoute_par_enfant: true } }],
      [262, 'message_tuteur', "Il reste la consigne que tu as ajoutée : « finir » avec « nous », au passé composé ?"],
      [275, 'message_enfant_vocal', "nous avons fini"],
      [279, 'message_tuteur', "Exactement : « avons » et le participe « fini »."],
      [284, 'exercice_resolu', null, { meta: { exercise_id: 'xr-203', resultat: 'succes' } }],
    ],
    4: [
      [300, 'message_tuteur', "Tes devoirs sont prêts pour demain. Tu te souviens quand on accorde avec avoir ?"],
      [318, 'message_enfant_vocal', "quand le COD il est avant"],
      [322, 'message_tuteur', "C'est ça. À bientôt !"],
    ],
  },
};

const PROMPT_SYSTEME = [
  'Tu es Ari, un robot tuteur bienveillant pour des enfants du CE1 au CM2.',
  '',
  'Principes :',
  '- Tu ne donnes jamais la réponse : tu poses une question à la fois pour faire avancer le raisonnement.',
  '- Tes répliques sont courtes (deux phrases au plus) et lues à voix haute.',
  "- Tu t'appuies sur ce que l'enfant vient de dire, avec ses mots.",
  "- Quand l'enfant se trompe, tu cherches d'abord ce qui est juste dans sa proposition.",
  '',
  'Outils :',
  '- afficher_visuel : montre un schéma simple (parts de tarte, droite graduée, tableau).',
  '- conclure_exercice : pose le verdict succes | fragile | abandon quand la réponse est stabilisée.',
  '',
  'Contexte de séance : il suit ce message (prénom, classe, mode, écran, exercice en cours).',
].join('\n');

const enfantParId = Object.fromEntries(CHILDREN.map((c) => [c.id, c]));
const MATIERE = { 1: 'français', 4: 'français' };

const instant = (s, secondes) => new Date(Date.parse(s.startedAt) + secondes * 1000).toISOString();
const idInteraction = (s, position, rang) => 'int-' + s.id + '-' + position + '-' + rang;

export const ecranId = (s, position) => 'ecr-' + s.id + '-' + position;

// Interactions brutes d'un écran (§ 2.3), triées par position.
export function interactionsEcran(s, position) {
  const fil = FILS[s.scenarioIdx]?.[position] || [];
  return fil.map(([secondes, type, texte, options = {}], i) => {
    const locuteur = type === 'message_tuteur' ? 'ari'
      : type.startsWith('message_enfant') || type.startsWith('capture_') ? 'enfant' : 'systeme';
    return {
      id: idInteraction(s, position, i + 1),
      position: i + 1,
      type,
      locuteur,
      contenu_texte: texte,
      created_at: instant(s, secondes),
      llm_generation_id: locuteur === 'ari' ? 'gen-' + s.id + '-' + position + '-' + (i + 1) : null,
      modele_llm_utilise: locuteur === 'ari' ? (s.mode === 'devoirs' ? 'openai/gpt-5.6-luna' : 'anthropic/claude-sonnet-5') : null,
      a_photo: options.photo === true,
      metadata: options.meta ? structuredClone(options.meta) : null,
    };
  });
}

// Photo : { purgee } si l'interaction porte une photo, sinon undefined.
export function etatPhoto(interactionId) {
  for (const s of SESSIONS) {
    for (const e of s.ecrans) {
      const fil = FILS[s.scenarioIdx]?.[e.position] || [];
      for (let k = 0; k < fil.length; k++) {
        if (idInteraction(s, e.position, k + 1) !== interactionId) continue;
        const options = fil[k][3] || {};
        return options.photo ? { purgee: options.purgee === true, jour: jourParis(instant(s, fil[k][0])) } : undefined;
      }
    }
  }
  return undefined;
}

// Photos d'une séance (§ 2.7 `photos[]`), plus récentes d'abord.
export function photosSeance(s) {
  return s.ecrans.flatMap((e) => interactionsEcran(s, e.position)
    .filter((i) => i.a_photo)
    .map((i) => ({ interaction_id: i.id, ecran_id: ecranId(s, e.position), session_id: s.id, created_at: i.created_at })))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// Devoir d'une séance en mode devoirs (§ 2.3 `homework`), sinon null.
export function devoirBrut(s) {
  if (s.mode !== 'devoirs') return null;
  return {
    id: 'hw-' + s.id,
    session_id: s.id,
    pour_le: decalerJour(jourParis(s.startedAt), 1),
    matiere: MATIERE[s.scenarioIdx] || 'maths',
    titre: s.theme + ' — exercices 3 et 4 p. 58',
    nb_consignes: 3,
    created_at: instant(s, 30),
  };
}

// Dictée d'une séance (§ 2.5, forme DICT-12), sinon null : la dictée
// du passage pour une séance en mode 'dictee' (nouveau flux, textes
// inventés), plus une dictée de l'ancien flux (classe null) hier, sur la
// première séance du jour.
export function dicteeBrute(s) {
  if (s.dictee) return dicteeNouveauFlux(s, s.dictee);
  const hier = hierParis();
  const premiere = SESSIONS.find((x) => jourParis(x.startedAt) === hier && !x.dictee);
  if (!premiere || premiere.id !== s.id) return null;
  return {
    id: 'dic-' + s.id,
    ecran_id: ecranId(s, s.ecrans.length),
    origine: 'entrainement',
    texte_reference: 'Les enfants ont ramassé des feuilles mortes dans le jardin.',
    classe: null,
    etape: 'preparation',
    finie_at: null,
    mots_cibles: ['ramassé', 'feuilles', 'mortes'],
    niveau_difficulte: 'moyen',
    validation_status: 'valide',
    validation_tentatives: 2,
    ecarts_detectes: [{ attendu: 'ramassé', lu: 'ramasser' }],
    created_at: instant(s, 15 * 60),
    nb_fautes_comptees: 0,
    regles_revues: [],
    evenements_par_type: {},
    session_id: s.id,
  };
}

function dicteeNouveauFlux(s, d) {
  const fin = d.etape === 'fin' && s.durationMin != null ? instant(s, s.durationMin * 60) : null;
  return {
    id: 'dic-' + s.id,
    ecran_id: ecranId(s, 1),
    origine: d.origine,
    texte_reference: d.texte,
    classe: enfantParId[s.childId].classe,
    etape: d.etape,
    finie_at: fin,
    mots_cibles: [...d.mots],
    niveau_difficulte: d.niveau,
    validation_status: d.validation || 'valide',
    validation_tentatives: d.tentatives || 1,
    ecarts_detectes: null,
    created_at: instant(s, 20),
    nb_fautes_comptees: d.fautes.filter(([, comptee]) => comptee).length,
    regles_revues: [...new Set(d.fautes.map(([code]) => code))].sort(),
    evenements_par_type: { ...d.ev },
    session_id: s.id,
  };
}

// Action `tour` (§ 2.9) ; undefined si l'identifiant est inconnu.
export function tourBrut(generationId) {
  const m = /^gen-(ses-\d+)-(\d+)-(\d+)$/.exec(generationId || '');
  const s = m && SESSIONS.find((x) => x.id === m[1]);
  const ecran = s && s.ecrans.find((e) => e.position === +m[2]);
  if (!ecran) return undefined;
  const fil = interactionsEcran(s, ecran.position);
  const n = +m[3];
  const reponse = fil.find((i) => i.position === n && i.locuteur === 'ari');
  if (!reponse) return undefined;

  const enfant = enfantParId[s.childId];
  const tokensIn = 4200 + 180 * n;
  const tokensOut = 40 + (reponse.contenu_texte.length >> 1);
  const generation = {
    id: generationId,
    child_id: s.childId,
    role: 'tutor',
    unite: 'token',
    modele: reponse.modele_llm_utilise,
    prompt_version: 40,
    latence_ms: 900 + ((n * 373) % 1900),
    tokens_input: tokensIn,
    tokens_output: tokensOut,
    // Quelques appels sans prix au catalogue : coût inconnu, jamais 0.
    cout_estime_eur: n % 5 === 3 ? null : Math.round((tokensIn * 0.0000011 + tokensOut * 0.0000044) * 10000) / 10000,
    succes: true,
    erreur: null,
    metadata: { session_id: s.id },
    created_at: new Date(Date.parse(reponse.created_at) - 1400).toISOString(),
  };

  // Trace purgée (ou jamais écrite) : séances d'au moins 7 jours.
  if (ecartJours(jourParis(s.startedAt), aujourdhuiParis()) >= 7) {
    return { generation, trace: null, prompt_systeme: null };
  }

  const historique = fil.filter((i) => i.position < n && (i.locuteur === 'ari' || (i.locuteur === 'enfant' && i.contenu_texte)))
    .map((i) => ({ role: i.locuteur === 'ari' ? 'assistant' : 'user', content: i.contenu_texte }));
  const sha = 'a3f9c1e07b40' + (s.mode === 'devoirs' ? 'd' : 'e');
  const outils = /tarte/.test(reponse.contenu_texte)
    ? [{ nom: 'afficher_visuel', arguments: { type: 'tarte', parts: 4, colorees: 3 } }] : [];
  return {
    generation,
    trace: {
      id: 'trace-' + generationId,
      fournisseur: 'openai-responses',
      modele: reponse.modele_llm_utilise,
      prompt_version: 40,
      requete: {
        system_sha256: sha,
        system_regime: s.mode,
        system_taille: PROMPT_SYSTEME.length,
        session_context: 'Enfant : ' + enfant.name + ' (' + enfant.classe + '). Mode : ' + s.mode + '. Écran ' + ecran.position + ' (' + ecran.type + ').' +
          (ecran.exercices[0] ? ' Exercice en cours : ' + ecran.exercices[0].enonce : ''),
        messages: historique,
        tools_noms: ['afficher_visuel', 'conclure_exercice'],
        tools_sha256: '5be2d0c4a1',
        params: { temperature: 0.4, max_output_tokens: 300 },
        nb_photos: s.mode === 'devoirs' ? 2 : 0,
      },
      reponse: {
        fournisseur: 'openai-responses',
        brut: {
          id: 'resp_' + generationId.replace(/-/g, ''),
          status: 'completed',
          output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: reponse.contenu_texte }] }],
        },
        finish_reason: 'stop',
        status: 200,
        usage: { input_tokens: tokensIn, output_tokens: tokensOut, cached_tokens: Math.round(tokensIn * 0.8) },
        servi: { reply: reponse.contenu_texte, tool_calls: outils },
      },
      created_at: reponse.created_at,
    },
    prompt_systeme: {
      sha256: sha,
      regime: s.mode,
      prompt_version: 40,
      taille: PROMPT_SYSTEME.length,
      texte: PROMPT_SYSTEME,
      premiere_vue_at: new Date(debutJourParisMs(decalerJour(aujourdhuiParis(), -20))).toISOString(),
    },
  };
}
