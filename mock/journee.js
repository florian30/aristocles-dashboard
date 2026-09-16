/* ============================================================
   Mock de l'action `journee` — forme brute de l'Edge (§ 2.5).
   Les séances viennent de donnees.js (mêmes id que le lecteur) ;
   le journal d'usage, la technique et les coûts sont synthétisés
   de façon déterministe à partir du jour. Hier est riche (trois
   enfants dont une activité hors séance, une erreur client, un
   échec IA, un rôle au coût inconnu) ; certains jours sont vides.
   ============================================================ */

import { CHILDREN, SESSIONS } from './donnees.js';
import { aujourdhuiParis, debutJourParisMs, decalerJour, ecartJours, jourParis } from '../ui/paris.js';

const enfantParId = Object.fromEntries(CHILDREN.map((c) => [c.id, c]));

// Usage hors séance : [joursAvant, childId, { ecrans, ouvertures }]
const USAGE_SEUL = [
  [1, 'c1', { ouvertures: 1, ecrans: [['accueil', 2, 41000], ['espace_parent', 1, 95000], ['bilan_parent', 1, 62000]] }],
  [3, 'c4', { ouvertures: 1, ecrans: [['accueil', 1, 12000]] }],
  [7, 'c2', { ouvertures: 2, ecrans: [['accueil', 3, 30000], ['bibliotheque', 1, 18000]] }],
];

const ERREURS = [
  [1, 'c5', { type: 'TimeoutException', zone: 'tutor', ecran: 'session', app_version: '1.4.0', plateforme: 'android', nb: 2, heure: '09:41', exemple_pile:
    'TimeoutException after 0:00:20.000000: Future not completed\n#0  TutorClient.envoyerTour (package:aristocles/tutor/client.dart:188)\n#1  SessionController._surPtt (package:aristocles/session/controller.dart:412)' }],
  [1, 'c3', { type: 'PlatformException', zone: 'audio', ecran: 'accueil', app_version: '1.4.0', plateforme: 'ios', nb: 1, heure: '18:02', exemple_pile:
    'PlatformException(AVAudioSession, setActive failed, null, null)\n#0  AudioSessionIos.activer (package:aristocles/audio/ios.dart:57)' }],
  [4, 'c1', { type: 'FormatException', zone: 'bilan', ecran: 'bilan_parent', app_version: '1.3.2', plateforme: 'ios', nb: 1, heure: '20:15', exemple_pile:
    'FormatException: Unexpected character (at character 1)\n#0  BilanParent.fromJson (package:aristocles/parent/bilan.dart:33)' }],
];

const iso = (date, heure) => new Date(debutJourParisMs(date) + (+heure.slice(0, 2) * 60 + +heure.slice(3)) * 60000).toISOString();

function joursAvant(date) {
  return ecartJours(date, aujourdhuiParis());
}

function resumeSeance(s, i) {
  const exercices = s.ecrans.flatMap((e) => e.exercices);
  const compte = (r) => exercices.filter((x) => x.resultat === r).length;
  const haut = s.ecrans.filter((e) => e.pouce === 'haut').length + (i % 3 === 1 ? 1 : 0);
  const bas = s.ecrans.filter((e) => e.pouce === 'bas').length + (i % 4 === 0 ? 1 : 0);
  const debut = new Date(s.startedAt).getTime();
  const fin = s.durationMin == null ? null : new Date(debut + s.durationMin * 60000).toISOString();
  return {
    id: s.id,
    mode: s.mode,
    status: s.status,
    theme_libelle: s.theme,
    started_at: s.startedAt,
    ended_at: fin,
    duration_seconds: s.durationMin == null ? null : s.durationMin * 60,
    nb_ecrans: s.ecrans.length,
    exercices: { nb: exercices.length, succes: compte('succes'), fragile: compte('fragile'), autres: exercices.length - compte('succes') - compte('fragile') },
    pouces: { haut, bas },
    cloture: {
      soldee_at: fin ? new Date(debut + s.durationMin * 60000 + 5000).toISOString() : null,
      motif: fin ? (i % 5 === 2 ? 'fermeture_a_froid' : 'menage_complet') : null,
    },
  };
}

function erreurBrute(date, e) {
  const { heure, ...reste } = e;
  return { ...reste, derniere_occurrence: iso(date, heure) };
}

// Rôles IA d'une journée, proportionnels au nombre de séances.
function iaDuJour(date, seances) {
  const n = seances.length;
  if (!n) return { appels: 0, echecs: 0, cout_total_eur: 0, appels_cout_inconnu: 0, par_role: [] };
  const avecDevoirs = seances.some((s) => s.mode === 'devoirs');
  const echecTutor = joursAvant(date) === 1 ? 1 : 0;
  const r4 = (x) => Math.round(x * 10000) / 10000;
  const roles = [
    { role: 'tutor', unite: 'token', appels: 26 * n, echecs: echecTutor, latence_p50_ms: 1380, latence_p95_ms: 3150, cout_eur: r4(0.0091 * 26 * n), appels_cout_inconnu: 0, volume_input: 5100 * 26 * n, volume_output: 620 * 26 * n },
    { role: 'tts', unite: 'caractere', appels: 24 * n, echecs: 0, latence_p50_ms: 640, latence_p95_ms: 1210, cout_eur: r4(0.0007 * 24 * n), appels_cout_inconnu: 0, volume_input: 185 * 24 * n, volume_output: 0 },
    { role: 'stt', unite: 'seconde', appels: 22 * n, echecs: 0, latence_p50_ms: 420, latence_p95_ms: 980, cout_eur: r4(0.00025 * 22 * n), appels_cout_inconnu: 0, volume_input: 9 * 22 * n, volume_output: 0 },
    { role: 'synthese_ecran', unite: 'token', appels: 4 * n, echecs: 0, latence_p50_ms: 2100, latence_p95_ms: 4200, cout_eur: r4(0.0066 * 4 * n), appels_cout_inconnu: 0, volume_input: 3400 * 4 * n, volume_output: 520 * 4 * n },
    { role: 'bilan_session', unite: 'token', appels: n, echecs: 0, latence_p50_ms: 3900, latence_p95_ms: 3900, cout_eur: r4(0.0092 * n), appels_cout_inconnu: 0, volume_input: 1850 * n, volume_output: 575 * n },
  ];
  if (avecDevoirs || joursAvant(date) === 1) {
    roles.push({ role: 'vision-parser', unite: 'token', appels: 2, echecs: 0, latence_p50_ms: 5800, latence_p95_ms: 6400, cout_eur: null, appels_cout_inconnu: 2, volume_input: 12000, volume_output: 610 });
  }
  roles.sort((a, b) => b.appels - a.appels);
  return {
    appels: roles.reduce((a, r) => a + r.appels, 0),
    echecs: roles.reduce((a, r) => a + r.echecs, 0),
    cout_total_eur: r4(roles.reduce((a, r) => a + (r.cout_eur || 0), 0)),
    appels_cout_inconnu: roles.reduce((a, r) => a + r.appels_cout_inconnu, 0),
    par_role: roles,
  };
}

const TYPES_INCIDENT = ['tour_erreur', 'tour_anomalie', 'filet_echec_llm', 'ecriture_echec'];

export function journeeBrute(date) {
  const ja = joursAvant(date);
  const seancesDuJour = SESSIONS
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => jourParis(s.startedAt) === date);

  const ids = new Set([
    ...seancesDuJour.map(({ s }) => s.childId),
    ...USAGE_SEUL.filter(([j]) => j === ja).map(([, c]) => c),
    ...ERREURS.filter(([j]) => j === ja).map(([, c]) => c),
  ]);

  const enfants = [...ids].map((childId) => {
    const c = enfantParId[childId];
    const miennes = seancesDuJour.filter(({ s }) => s.childId === childId);
    const usage = USAGE_SEUL.find(([j, id]) => j === ja && id === childId)?.[2];
    const ecrans = (usage ? usage.ecrans : miennes.length ? [['accueil', 1, 9000 + 1000 * miennes.length]] : [])
      .map(([ecran, nb, duree]) => ({ ecran, nb, duree_totale_ms: duree }))
      .sort((a, b) => b.nb - a.nb || a.ecran.localeCompare(b.ecran));
    const devoirs = miennes.filter(({ s }) => s.mode === 'devoirs').map(({ s }) => ({
      id: 'hw-' + s.id,
      session_id: s.id,
      pour_le: decalerJour(date, 1),
      matiere: 'français',
      titre: s.theme + ' — exercices 3 et 4 p. 58',
      nb_consignes: 2,
      created_at: new Date(new Date(s.startedAt).getTime() + 30000).toISOString(),
    }));
    // Une dictée d'entraînement hier (premier enfant en séance), pour montrer le bloc.
    const dictees = ja === 1 && seancesDuJour.length && childId === seancesDuJour[0].s.childId ? [{
      id: 'dic-' + miennes[0].s.id,
      ecran_id: 'ecr-' + miennes[0].s.id + '-9',
      origine: 'entrainement',
      texte_reference: 'Les enfants ont ramassé des feuilles mortes dans le jardin.',
      mots_cibles: ['ramassé', 'feuilles', 'mortes'],
      niveau_difficulte: 'moyen',
      validation_status: 'valide',
      validation_tentatives: 2,
      ecarts_detectes: [{ attendu: 'ramassé', lu: 'ramasser' }],
      created_at: new Date(new Date(miennes[0].s.startedAt).getTime() + 15 * 60000).toISOString(),
      session_id: miennes[0].s.id,
    }] : [];
    return {
      child_id: childId,
      first_name: c.name,
      classe: c.classe,
      seances: miennes.map(({ s, i }) => resumeSeance(s, i)),
      devoirs,
      dictees,
      ecrans,
      ouvertures_app: usage ? usage.ouvertures : miennes.length ? 1 : 0,
      erreurs_client: ERREURS.filter(([j, id]) => j === ja && id === childId).map(([, , e]) => erreurBrute(date, e)),
    };
  }).sort((a, b) => a.first_name.localeCompare(b.first_name));

  const actif = enfants.length > 0;
  const incidents = {
    par_type: TYPES_INCIDENT.map((type) => ({ type, nb: ja === 1 && type === 'tour_anomalie' ? 1 : ja === 1 && type === 'tour_erreur' ? 2 : 0 })),
    recents: ja === 1 && seancesDuJour.length ? [
      { session_id: seancesDuJour[seancesDuJour.length - 1].s.id, type: 'tour_erreur', ecran_type: 'exercice', client_ts: iso(date, '09:41'), detail: { tour: 6, erreur: 'TimeoutException' } },
      { session_id: seancesDuJour[seancesDuJour.length - 1].s.id, type: 'tour_erreur', ecran_type: 'exercice', client_ts: iso(date, '09:38'), detail: { tour: 4, erreur: 'TimeoutException' } },
      { session_id: seancesDuJour[0].s.id, type: 'tour_anomalie', ecran_type: 'vue_ensemble', client_ts: iso(date, '18:21'), detail: { tour: 2, anomalie: 'tts_chevauchement', file_audio: { en_lecture: 'tour_1', en_attente: ['tour_2'] } } },
    ] : [],
  };

  return {
    date,
    from: new Date(debutJourParisMs(date)).toISOString(),
    to: new Date(debutJourParisMs(decalerJour(date, 1))).toISOString(),
    enfants,
    technique: {
      ia: iaDuJour(date, seancesDuJour.map(({ s }) => s)),
      echecs_ia: ja === 1 && seancesDuJour.length ? [{
        llm_generation_id: '7c1e0d2a-54b1-4f7e-9d0a-2b8f1c3e4a55',
        child_id: 'c5',
        role: 'tutor',
        modele: 'openai/gpt-5.6-luna',
        erreur: 'OpenRouter 502',
        created_at: iso(date, '09:41'),
      }] : [],
      versions: actif ? [
        { app_version: '1.4.0', app_build: 142, plateforme: 'ios', enfants: Math.max(1, enfants.length - 1), lancements: Math.max(1, enfants.length - 1), dernier_vu: iso(date, '18:40') },
        ...(ja % 2 === 1 ? [{ app_version: '1.4.0', app_build: 141, plateforme: 'android', enfants: 1, lancements: 1, dernier_vu: iso(date, '09:52') }] : []),
        ...(ja >= 4 ? [{ app_version: '1.3.2', app_build: 131, plateforme: 'ios', enfants: 1, lancements: 1, dernier_vu: iso(date, '20:15') }] : []),
      ] : [],
      incidents,
      erreurs_client: enfants.flatMap((c) => c.erreurs_client).sort((a, b) => b.nb - a.nb),
      ouvertures_app: enfants.reduce((a, c) => a + c.ouvertures_app, 0),
    },
  };
}

export function journee(params = {}) {
  return journeeBrute(params.date);
}
