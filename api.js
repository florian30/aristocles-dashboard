/* ============================================================
   Aristocles — Couche d'accès aux données
   Par défaut : appelle l'Edge Function Supabase `dashboard`
   (POST JSON { password, action, params }, schéma socle) et
   adapte ses réponses aux formes consommées par la page.
   Mode démo : ajouter `?mock=1` à l'URL pour servir les données
   factices de mock.js avec les mêmes formes de retour.

   Formes de retour (identiques dans les deux modes) :

   getStats(from, to) →
   {
     activeChildren, sessionCount, exerciseCount, totalMinutes,
     perChild: [{ childId, name, sessions, exercises, minutes }],
     llm: {
       totalEur, calls, tokensInput, tokensOutput,
       perRole: [{ role, eur, calls, tokensInput, tokensOutput }]
     } | null
   }
   NB : en mode réel, perChild ne contient que les enfants actifs
   sur la plage — la page complète avec la liste connue au login.

   getSessions(from, to, childId) →
   [{ id, date, time, childId, childName, mode, status, theme,
      durationMin, exerciseCount }]
   triées de la plus récente à la plus ancienne.
   mode : 'devoirs' | 'entrainement' ; status : 'active' |
   'archivee'. durationMin est null pour une session active ;
   une session archivée sans écran vaut 0.

   getSessionDetail(id) →
   { id, date, time, childId, childName, classe, mode, status,
     theme, notion, durationMin, exerciseCount,
     resume,            — bilan de séance rédigé, ou null
     ecrans: [{ position, type, synthese, statutFermeture, pouce,
                exercices: [{ id, enonce, resultat, origine,
                              dureeSec, notions }] }],
     acquisitions: [{ notion, maitrise, vuEnClasse, majDate }],
     evenements: [{ seq, type, ts, ecranType, exerciseId, detail }]
   } ou null si la session est inconnue.
   evenements : trace technique du pipeline voix, triée par seq.
   Contrat additif — absente tant que l'Edge n'expose pas encore
   la clé : le front reçoit alors un tableau vide.
   Les champs d'état (status, type, statutFermeture, pouce,
   resultat, origine, maitrise, vuEnClasse) portent les valeurs
   socle brutes — les libellés d'affichage vivent dans app.js.

   Conventions :
   - from / to : dates 'AAAA-MM-JJ' inclusives (converties en
     bornes de journée locale) ; null ou '' = non borné.
   - childId : identifiant enfant, ou null / '' / 'all' pour tous.
   - Les erreurs sont des ApiError { status } ; status 401 =
     mot de passe refusé, 0 = serveur injoignable.
   ============================================================ */
(function () {
  'use strict';

  const API_URL = 'https://ngbqqewpkcugdwajpbff.supabase.co/functions/v1/dashboard';
  const USE_MOCK = typeof location !== 'undefined' && /[?&]mock=1(&|$)/.test(location.search);

  let password = null;
  function setPassword(pw) { password = pw; }

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }

  // ---------- Transport ----------

  async function call(action, params) {
    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action, params }),
      });
    } catch (_) {
      throw new ApiError('Impossible de contacter le serveur.', 0);
    }
    let data = null;
    try { data = await response.json(); } catch (_) { /* réponse non JSON */ }
    if (!response.ok) {
      const message = (data && data.error) || 'Erreur serveur (' + response.status + ')';
      throw new ApiError(message, response.status);
    }
    return data;
  }

  // ---------- Adaptation contrat fonction → formes de la page ----------

  function toMinutes(seconds) {
    return seconds == null ? null : Math.round(seconds / 60);
  }

  function localDate(iso) {
    const d = new Date(iso);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function localTime(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  // 'AAAA-MM-JJ' inclusifs → bornes ISO de journée locale.
  function dayBound(dateStr, timeSuffix, name) {
    const d = new Date(dateStr + timeSuffix);
    if (isNaN(d.getTime())) throw new ApiError("Date '" + name + "' invalide.", 400);
    return d.toISOString();
  }

  function rangeParams(from, to) {
    const params = {};
    if (from) params.from = dayBound(from, 'T00:00:00', 'from');
    if (to) params.to = dayBound(to, 'T23:59:59.999', 'to');
    return params;
  }

  function mapLlm(llm) {
    if (!llm) return null;
    return {
      totalEur: llm.cout_total_eur || 0,
      calls: llm.appels || 0,
      tokensInput: llm.tokens_input || 0,
      tokensOutput: llm.tokens_output || 0,
      perRole: (llm.par_role || []).map((r) => ({
        role: r.role,
        eur: r.cout_eur || 0,
        calls: r.appels || 0,
        tokensInput: r.tokens_input || 0,
        tokensOutput: r.tokens_output || 0,
      })),
    };
  }

  const realApi = {
    async getStats(from, to) {
      const data = await call('stats', rangeParams(from, to));
      return {
        activeChildren: data.active_children,
        sessionCount: data.sessions,
        exerciseCount: data.exercises,
        totalMinutes: toMinutes(data.total_seconds) || 0,
        perChild: (data.children || []).map((c) => ({
          childId: c.child_id,
          name: c.first_name,
          sessions: c.sessions,
          exercises: c.exercises,
          minutes: toMinutes(c.total_seconds) || 0,
        })),
        llm: mapLlm(data.llm),
      };
    },

    async getSessions(from, to, childId) {
      const params = rangeParams(from, to);
      if (childId && childId !== 'all') params.child_id = childId;
      // Action au singulier depuis la phase 3 (renommage anglais/singulier
      // de l'Edge dashboard) — la réponse garde son champ `sessions`.
      const data = await call('session', params);
      return (data.sessions || []).map((s) => ({
        id: s.id,
        date: localDate(s.started_at),
        time: localTime(s.started_at),
        childId: s.child_id,
        childName: s.first_name,
        mode: s.mode,
        status: s.status,
        theme: s.theme_libelle || null,
        durationMin: toMinutes(s.duration_seconds),
        exerciseCount: s.exercises,
      }));
    },

    async getSessionDetail(id) {
      let data;
      try {
        data = await call('session_detail', { session_id: id });
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
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
        date: localDate(s.started_at),
        time: localTime(s.started_at),
        childId: s.child_id,
        childName: s.first_name,
        classe: s.classe || null,
        mode: s.mode,
        status: s.status,
        theme: s.theme_libelle || null,
        notion: s.notion_principale || null,
        durationMin: toMinutes(s.duration_seconds),
        exerciseCount: ecrans.reduce((acc, e) => acc + e.exercices.length, 0),
        resume: data.resume_seance || null,
        ecrans,
        acquisitions: (data.acquisitions || []).map((a) => ({
          notion: a.notion || null,
          maitrise: a.statut_maitrise,
          vuEnClasse: a.statut_vu_en_classe,
          majDate: a.derniere_mise_a_jour ? localDate(a.derniere_mise_a_jour) : null,
        })),
        evenements: (data.evenements ?? []).map((e) => ({
          seq: e.seq,
          type: e.type,
          ts: e.client_ts,
          ecranType: e.ecran_type || null,
          exerciseId: e.exercise_id || null,
          detail: e.detail || null,
        })),
      };
    },
  };

  // ---------- Mode démo (mock.js) ----------

  function mockInRange(session, from, to) {
    if (from && session.date < from) return false;
    if (to && session.date > to) return false;
    return true;
  }

  function mockExerciseCount(session) {
    return session.ecrans.reduce((acc, e) => acc + e.exercices.length, 0);
  }

  const mockApi = {
    async getStats(from, to) {
      const { children, sessions, llm } = globalThis.ARISTOCLES_MOCK;
      const filtered = sessions.filter((s) => mockInRange(s, from, to));
      const perChild = children.map((child) => {
        const mine = filtered.filter((s) => s.childId === child.id);
        return {
          childId: child.id,
          name: child.name,
          sessions: mine.length,
          exercises: mine.reduce((acc, s) => acc + mockExerciseCount(s), 0),
          minutes: mine.reduce((acc, s) => acc + (s.durationMin || 0), 0),
        };
      });
      return {
        activeChildren: new Set(filtered.map((s) => s.childId)).size,
        sessionCount: filtered.length,
        exerciseCount: filtered.reduce((acc, s) => acc + mockExerciseCount(s), 0),
        totalMinutes: filtered.reduce((acc, s) => acc + (s.durationMin || 0), 0),
        perChild,
        // Bloc statique (non filtré par la plage) — suffisant pour la démo.
        llm: { ...llm, perRole: llm.perRole.map((r) => ({ ...r })) },
      };
    },

    async getSessions(from, to, childId) {
      const { children, sessions } = globalThis.ARISTOCLES_MOCK;
      const childById = Object.fromEntries(children.map((c) => [c.id, c]));
      return sessions
        .filter((s) => mockInRange(s, from, to))
        .filter((s) => !childId || childId === 'all' || s.childId === childId)
        .map((s) => ({
          id: s.id,
          date: s.date,
          time: s.time,
          childId: s.childId,
          childName: childById[s.childId].name,
          mode: s.mode,
          status: s.status,
          theme: s.theme,
          durationMin: s.durationMin,
          exerciseCount: mockExerciseCount(s),
        }))
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    },

    async getSessionDetail(id) {
      const { children, sessions, acquisitions } = globalThis.ARISTOCLES_MOCK;
      const session = sessions.find((s) => s.id === id);
      if (!session) return null;
      const child = children.find((c) => c.id === session.childId);
      return {
        id: session.id,
        date: session.date,
        time: session.time,
        childId: session.childId,
        childName: child.name,
        classe: child.classe,
        mode: session.mode,
        status: session.status,
        theme: session.theme,
        notion: session.notion,
        durationMin: session.durationMin,
        exerciseCount: mockExerciseCount(session),
        resume: session.resume,
        ecrans: session.ecrans.map((e) => ({
          ...e,
          exercices: e.exercices.map((x) => ({ ...x, notions: [...x.notions] })),
        })),
        acquisitions: (acquisitions[session.childId] || []).map((a) => ({ ...a })),
        evenements: (session.evenements || []).map((e) => ({ ...e, detail: e.detail ? { ...e.detail } : null })),
      };
    },
  };

  const backend = USE_MOCK ? mockApi : realApi;

  globalThis.AristoclesAPI = {
    setPassword,
    isMock: USE_MOCK,
    ApiError,
    getStats: backend.getStats,
    getSessions: backend.getSessions,
    getSessionDetail: backend.getSessionDetail,
  };
})();
