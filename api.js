/* ============================================================
   Aristocles — Accès aux données de l'Edge `dashboard`
   POST {url}/functions/v1/dashboard, corps { action, params },
   en-têtes Authorization: Bearer <access_token> + apikey (anon).
   Réponses : 401 { error } (jeton absent/invalide), 403 { error }
   (compte non autorisé), sinon le JSON de l'action.

   Ce module ne dépend ni du DOM ni de supabase-js : le jeton
   est fourni par une fonction injectée (auth.js), le transport
   est remplaçable (mock/). Les adaptateurs traduisent les formes
   Edge en formes de vue et sont testés sous Deno.

   Formes de retour :
   stats(env, from, to) → { activeChildren, sessionCount, exerciseCount,
     totalMinutes, perChild: [{ childId, name, sessions, exercises, minutes }],
     llm: voir ui/unites.js adapterLlm | null }
   sessions(env, from, to, childId) → [{ id, date, time, childId, childName,
     mode, status, theme, durationMin, exerciseCount }] (récentes d'abord)
   detail(env, sessionId) → { …, resume, ecrans[], acquisitions[],
     evenements[] } ou null (séance inconnue)
   journee(env, date) → voir adapterJournee (La veille)
   apercu(env, from, to) → voir adapterApercu (Vue d'ensemble)
   sante(env, from, to) → voir adapterSante (Santé & coûts)
   Pour ces trois actions, les jours sont des jours civils de Paris
   ('AAAA-MM-JJ') ; from/to sont convertis en bornes ISO (≤ 92 j).
   ============================================================ */

import { CACHE_TTL_MS, ENVS, urlDashboard } from './config.js';
import { dateLocale, enMinutes, heureLocale } from './ui/format.js';
import { bornesParis, heureParis } from './ui/paris.js';
import { adapterLlm } from './ui/unites.js';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 = serveur injoignable
  }
}

export function estAnnulation(e) {
  return e && e.name === 'AbortError';
}

// ---------- Cache mémoire (env, action, params) ----------

export function cleCache(env, action, params) {
  const tries = Object.keys(params || {}).sort().map((k) => [k, params[k]]);
  return JSON.stringify([env, action, tries]);
}

export function creerCache({ ttlMs = CACHE_TTL_MS, maintenant = () => Date.now() } = {}) {
  const entrees = new Map();
  return {
    lire(cle) {
      const e = entrees.get(cle);
      if (!e) return undefined;
      if (maintenant() - e.a > ttlMs) {
        entrees.delete(cle);
        return undefined;
      }
      return e.valeur;
    },
    ecrire(cle, valeur) {
      entrees.set(cle, { a: maintenant(), valeur });
    },
    viderEnv(env) {
      for (const cle of entrees.keys()) if (JSON.parse(cle)[0] === env) entrees.delete(cle);
    },
  };
}

// ---------- Transport HTTP ----------

// obtenirJeton(env) → access_token courant (ou null).
export function transportHttp(obtenirJeton, fetchImpl = (...a) => fetch(...a)) {
  return async (env, action, params, { signal } = {}) => {
    const jeton = await obtenirJeton(env);
    if (!jeton) throw new ApiError('Session absente — reconnectez-vous.', 401);
    let reponse;
    try {
      reponse = await fetchImpl(urlDashboard(env), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jeton,
          apikey: ENVS[env].anonKey,
        },
        body: JSON.stringify({ action, params }),
        signal,
      });
    } catch (e) {
      if (estAnnulation(e)) throw e;
      throw new ApiError('Impossible de contacter le serveur ' + env + '.', 0);
    }
    let donnees = null;
    try { donnees = await reponse.json(); } catch (_) { /* réponse non JSON */ }
    if (!reponse.ok) {
      const message = (donnees && donnees.error) || 'Erreur serveur (' + reponse.status + ')';
      throw new ApiError(message, reponse.status);
    }
    return donnees;
  };
}

// ---------- Adaptateurs forme Edge → forme vue ----------

// 'AAAA-MM-JJ' inclusifs → bornes ISO de journée locale.
function borneJour(dateStr, suffixe, nom) {
  const d = new Date(dateStr + suffixe);
  if (isNaN(d.getTime())) throw new ApiError("Date '" + nom + "' invalide.", 400);
  return d.toISOString();
}

export function paramsPlage(from, to) {
  const params = {};
  if (from) params.from = borneJour(from, 'T00:00:00', 'from');
  if (to) params.to = borneJour(to, 'T23:59:59.999', 'to');
  return params;
}

export function adapterStats(data) {
  return {
    activeChildren: data.active_children || 0,
    sessionCount: data.sessions || 0,
    exerciseCount: data.exercises || 0,
    totalMinutes: enMinutes(data.total_seconds) || 0,
    perChild: (data.children || []).map((c) => ({
      childId: c.child_id,
      name: c.first_name,
      sessions: c.sessions,
      exercises: c.exercises,
      minutes: enMinutes(c.total_seconds) || 0,
    })),
    llm: adapterLlm(data.llm),
  };
}

export function adapterSessions(data) {
  return (data.sessions || []).map((s) => ({
    id: s.id,
    date: dateLocale(s.started_at),
    time: heureLocale(s.started_at),
    childId: s.child_id,
    childName: s.first_name,
    mode: s.mode,
    status: s.status,
    theme: s.theme_libelle || null,
    durationMin: enMinutes(s.duration_seconds),
    exerciseCount: s.exercises,
  }));
}

export function adapterDetail(data) {
  const s = data.session;
  const ecrans = (data.ecrans || []).map((e) => ({
    position: e.position,
    type: e.type,
    synthese: e.synthese_redigee || null,
    statutFermeture: e.statut_fermeture || null,
    pouce: e.pouce_enfant || null,
    exercices: (e.exercices || []).map((x) => ({
      id: x.id,
      enonce: x.enonce || null,
      resultat: x.resultat,
      origine: x.origine,
      dureeSec: x.duree_secondes,
      notions: x.notions || [],
    })),
  }));
  return {
    id: s.id,
    date: dateLocale(s.started_at),
    time: heureLocale(s.started_at),
    childId: s.child_id,
    childName: s.first_name,
    classe: s.classe || null,
    mode: s.mode,
    status: s.status,
    theme: s.theme_libelle || null,
    notion: s.notion_principale || null,
    durationMin: enMinutes(s.duration_seconds),
    exerciseCount: ecrans.reduce((acc, e) => acc + e.exercices.length, 0),
    resume: data.resume_seance || null,
    ecrans,
    acquisitions: (data.acquisitions || []).map((a) => ({
      notion: a.notion || null,
      maitrise: a.statut_maitrise,
      vuEnClasse: a.statut_vu_en_classe,
      majDate: a.derniere_mise_a_jour ? dateLocale(a.derniere_mise_a_jour) : null,
    })),
    evenements: (data.evenements ?? []).map((e) => ({
      seq: e.seq,
      type: e.type,
      ts: e.client_ts,
      ecranType: e.ecran_type || null,
      exerciseId: e.exercise_id || null,
      detail: e.detail ?? null,
    })),
  };
}

// ---------- Adaptateurs contrat v2 (journee, apercu, sante) ----------

const nombreOuNull = (v) => (v == null ? null : Number(v));
const tableau = (v) => (Array.isArray(v) ? v : []);

// Bloc `ia` (§ 2.8) : volumes dans l'unité du rôle, coût null = inconnu.
export function adapterIa(ia) {
  if (!ia) return { appels: 0, echecs: 0, eur: null, appelsCoutInconnu: 0, parRole: [] };
  return {
    appels: ia.appels || 0,
    echecs: ia.echecs || 0,
    eur: nombreOuNull(ia.cout_total_eur),
    appelsCoutInconnu: ia.appels_cout_inconnu || 0,
    parRole: tableau(ia.par_role).map((r) => ({
      role: r.role,
      unite: r.unite || 'token',
      appels: r.appels || 0,
      echecs: r.echecs || 0,
      p50: nombreOuNull(r.latence_p50_ms),
      p95: nombreOuNull(r.latence_p95_ms),
      eur: nombreOuNull(r.cout_eur),
      appelsCoutInconnu: r.appels_cout_inconnu || 0,
      volumeEntree: nombreOuNull(r.volume_input),
      volumeSortie: nombreOuNull(r.volume_output),
    })),
  };
}

function adapterErreurClient(e) {
  return {
    type: e.type || null,
    zone: e.zone || null,
    ecran: e.ecran || null,
    version: e.app_version || null,
    plateforme: e.plateforme || null,
    nb: e.nb || 0,
    derniere: e.derniere_occurrence || null,
    pile: e.exemple_pile || null,
  };
}

function adapterVersion(v) {
  return {
    version: v.app_version || null,
    build: v.app_build ?? null,
    plateforme: v.plateforme || null,
    enfants: v.enfants || 0,
    lancements: v.lancements || 0,
    dernierVu: v.dernier_vu || null,
  };
}

function adapterIncidents(i) {
  return {
    parType: tableau(i && i.par_type).map((t) => ({ type: t.type, nb: t.nb || 0 })),
    recents: tableau(i && i.recents).map((r) => ({
      sessionId: r.session_id || null,
      type: r.type,
      ecranType: r.ecran_type || null,
      ts: r.client_ts || null,
      detail: r.detail ?? null,
    })),
  };
}

function adapterEchecIa(e) {
  return {
    generationId: e.llm_generation_id || null,
    childId: e.child_id || null,
    role: e.role,
    modele: e.modele || null,
    erreur: e.erreur || null,
    createdAt: e.created_at || null,
  };
}

// Résumé de séance (§ 2.5), heures en heure de Paris.
export function adapterResumeSeance(s) {
  const x = s.exercices || {};
  return {
    id: s.id,
    mode: s.mode,
    status: s.status,
    theme: s.theme_libelle || null,
    heure: heureParis(s.started_at),
    heureFin: heureParis(s.ended_at),
    startedAt: s.started_at,
    dureeSec: s.duration_seconds ?? null,
    nbEcrans: s.nb_ecrans || 0,
    exercices: { nb: x.nb || 0, succes: x.succes || 0, fragile: x.fragile || 0, autres: x.autres || 0 },
    pouces: { haut: s.pouces?.haut || 0, bas: s.pouces?.bas || 0 },
    cloture: s.cloture ? { soldeeAt: s.cloture.soldee_at || null, motif: s.cloture.motif || null } : null,
  };
}

export function adapterJournee(data) {
  const enfants = tableau(data.enfants).map((c) => ({
    childId: c.child_id,
    prenom: c.first_name,
    classe: c.classe || null,
    seances: tableau(c.seances).map(adapterResumeSeance)
      .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt))),
    devoirs: tableau(c.devoirs).map((d) => ({
      id: d.id,
      sessionId: d.session_id || null,
      pourLe: d.pour_le || null,
      matiere: d.matiere || null,
      titre: d.titre || null,
      nbConsignes: d.nb_consignes ?? null,
    })),
    dictees: tableau(c.dictees).map((d) => ({
      id: d.id,
      sessionId: d.session_id || null,
      origine: d.origine || null,
      texte: d.texte_reference || null,
      motsCibles: d.mots_cibles ?? null,
      niveau: d.niveau_difficulte ?? null,
      validation: d.validation_status || null,
      tentatives: d.validation_tentatives ?? null,
      ecarts: d.ecarts_detectes ?? null,
    })),
    ecrans: tableau(c.ecrans).map((e) => ({ ecran: e.ecran, nb: e.nb || 0, dureeMs: e.duree_totale_ms || 0 })),
    ouvertures: c.ouvertures_app || 0,
    erreursClient: tableau(c.erreurs_client).map(adapterErreurClient),
  }));

  const t = data.technique || {};
  const technique = {
    ia: adapterIa(t.ia),
    echecsIa: tableau(t.echecs_ia).map(adapterEchecIa),
    versions: tableau(t.versions).map(adapterVersion),
    incidents: adapterIncidents(t.incidents),
    erreursClient: tableau(t.erreurs_client).map(adapterErreurClient),
    ouvertures: t.ouvertures_app || 0,
  };

  const seances = enfants.flatMap((c) => c.seances);
  const secondes = seances.reduce((acc, s) => acc + (s.status === 'archivee' ? s.dureeSec || 0 : 0), 0);
  return {
    date: data.date,
    enfants,
    technique,
    resume: {
      enfantsActifs: enfants.length,
      seances: seances.length,
      seancesEnCours: seances.filter((s) => s.status === 'active').length,
      minutes: Math.round(secondes / 60),
      exercices: seances.reduce((acc, s) => acc + s.exercices.nb, 0),
      exercicesReussis: seances.reduce((acc, s) => acc + s.exercices.succes, 0),
      ouvertures: technique.ouvertures,
      erreurs: technique.erreursClient.reduce((acc, e) => acc + e.nb, 0),
      incidents: technique.incidents.parType.reduce((acc, i) => acc + i.nb, 0),
      echecsIa: technique.ia.echecs,
    },
    estVide: enfants.length === 0 && technique.ia.appels === 0 && technique.ouvertures === 0 &&
      technique.erreursClient.length === 0,
  };
}

export function adapterApercu(data) {
  const r = (x) => ({ eligibles: x?.eligibles || 0, revenus: x?.revenus || 0, taux: nombreOuNull(x?.taux) });
  const ex = data.exercices || {};
  const ent = data.entrees_par_mode || {};
  return {
    enfantsActifs: data.enfants_actifs || 0,
    famillesActives: data.familles_actives || 0,
    seances: {
      total: data.seances?.total || 0,
      parMode: { devoirs: 0, entrainement: 0, ...(data.seances?.par_mode || {}) },
    },
    minutes: data.minutes || 0,
    exercices: { total: ex.total || 0, succes: ex.succes || 0, fragile: ex.fragile || 0, autres: ex.autres || 0 },
    ouvertures: data.ouvertures_app || 0,
    entreesParMode: { apprentissage: 0, devoirs: 0, dictee: 0, autre: 0, ...ent },
    retention: { j7: r(data.retention?.j7), j30: r(data.retention?.j30) },
    serie: tableau(data.serie).map((p) => ({
      jour: p.jour,
      seances: p.seances || 0,
      enfantsActifs: p.enfants_actifs || 0,
      minutes: p.minutes || 0,
      ouvertures: p.ouvertures_app || 0,
    })),
    couts: adapterLlm(data.couts),
  };
}

export function adapterSante(data) {
  return {
    erreursClient: tableau(data.erreurs_client).map(adapterErreurClient),
    versions: tableau(data.versions).map(adapterVersion),
    ia: adapterIa(data.ia),
    echecsIa: tableau(data.echecs_ia).map(adapterEchecIa),
    incidents: adapterIncidents(data.incidents),
    quotas: data.quotas
      ? {
        plafond: data.quotas.plafond ?? null,
        auPlafond: tableau(data.quotas.au_plafond).map((q) => ({ parentId: q.parent_id, jour: q.jour, unites: q.unites })),
      }
      : null,
  };
}

// ---------- Client ----------

export function creerApi({ transport, cache = creerCache() }) {
  async function appeler(env, action, params, options = {}) {
    const cle = cleCache(env, action, params);
    const enCache = cache.lire(cle);
    if (enCache !== undefined) return enCache;
    const donnees = await transport(env, action, params, options);
    // Une requête annulée ne remplit jamais le cache.
    if (options.signal && options.signal.aborted) {
      throw new DOMException('Requête annulée', 'AbortError');
    }
    cache.ecrire(cle, donnees);
    return donnees;
  }

  return {
    async stats(env, from, to, options) {
      return adapterStats(await appeler(env, 'stats', paramsPlage(from, to), options));
    },
    async sessions(env, from, to, childId, options) {
      const params = paramsPlage(from, to);
      if (childId && childId !== 'all') params.child_id = childId;
      return adapterSessions(await appeler(env, 'session', params, options));
    },
    async detail(env, sessionId, options) {
      try {
        return adapterDetail(await appeler(env, 'session_detail', { session_id: sessionId }, options));
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    },
    async journee(env, date, options) {
      return adapterJournee(await appeler(env, 'journee', { date }, options));
    },
    async apercu(env, from, to, options) {
      return adapterApercu(await appeler(env, 'apercu', bornesParis(from, to), options));
    },
    async sante(env, from, to, options) {
      return adapterSante(await appeler(env, 'sante', bornesParis(from, to), options));
    },
    viderCache(env) {
      cache.viderEnv(env);
    },
  };
}
