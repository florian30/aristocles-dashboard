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
   ============================================================ */

import { CACHE_TTL_MS, ENVS, urlDashboard } from './config.js';
import { dateLocale, enMinutes, heureLocale } from './ui/format.js';
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
    viderCache(env) {
      cache.viderEnv(env);
    },
  };
}
