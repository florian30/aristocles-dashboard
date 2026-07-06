/* ============================================================
   Aristocles — Couche d'accès aux données
   Par défaut : appelle l'Edge Function Supabase `dashboard`
   (POST JSON { password, action, params }) et adapte ses
   réponses aux formes consommées par la page.
   Mode démo : ajouter `?mock=1` à l'URL pour servir les données
   factices de mock.js avec les mêmes formes de retour.

   Formes de retour (identiques dans les deux modes) :

   getStats(from, to) →
   {
     activeChildren, sessionCount, exerciseCount, totalMinutes,
     perChild: [{ childId, name, sessions, exercises, minutes }]
   }
   NB : en mode réel, perChild ne contient que les enfants actifs
   sur la plage — la page complète avec la liste connue au login.

   getSessions(from, to, childId) →
   [{ id, date, time, childId, childName, mode, status,
      durationMin, exerciseCount }]
   triées de la plus récente à la plus ancienne.
   durationMin est null pour une session encore ouverte.

   getSessionDetail(id) →
   { id, date, time, childId, childName, mode, status,
     durationMin, exerciseCount, timeline: [...] } ou null.
   Éléments de timeline :
     { type: 'ari' | 'child', text }
     { type: 'exercise', exerciseId, notion, level, attempts,
       success, statement, visual }
     { type: 'mastery', notion, from, to }  — from peut être null
   NB : le transcript réel n'est pas horodaté ; les exercices et
   changements de maîtrise (ordonnés entre eux par horodatage)
   sont placés à la suite du dialogue, pas intercalés dedans.

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

  const MODE_KEY = { homework: 'devoirs', learning: 'entrainement' };
  const MASTERY_LABEL = {
    fragile: 'Fragile',
    to_review: 'À revoir',
    solid: 'Solide',
    acquired: 'Acquis',
  };

  // Les notions arrivent en slug ('accord_gn') : lisible à défaut
  // d'un libellé fourni par la fonction.
  function conceptLabel(conceptId) {
    if (!conceptId) return '';
    const words = String(conceptId).split('_').join(' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  // Libellés français des primitives visuelles (catalogue proto) ;
  // à défaut le slug brut reste lisible.
  const PRIMITIVE_LABEL = {
    clock: 'Horloge',
    number_line: 'Droite graduée',
    fraction_bar: 'Barre de fractions',
    fraction_model: 'Modèle de fraction',
    coordinate_grid: 'Grille de coordonnées',
    highlighted_text: 'Texte surligné',
    highlighted_number: 'Nombres mis en évidence',
    labeled_shape: 'Figure légendée',
    value_table: 'Tableau de valeurs',
    bar_chart: 'Diagramme en barres',
    polygon_grid: 'Polygone sur grille',
    sharing: 'Partage',
    symmetry_figure: 'Figure symétrique',
    relation_map: 'Schéma de relations',
    choice_tree: 'Arbre de choix',
    word_boxes: 'Boîtes de mots',
    conjugation_table: 'Tableau de conjugaison',
    timeline: 'Frise chronologique',
  };

  // Le visuel arrive en jsonb brut { primitive, params } (ou une liste
  // de visuels) : on le rend lisible sans prétendre à une description
  // pédagogique. Une chaîne passe telle quelle (parité mode démo).
  function describeVisual(visual) {
    if (!visual) return null;
    if (typeof visual === 'string') return visual || null;
    if (Array.isArray(visual)) {
      const parts = visual.map(describeVisual).filter(Boolean);
      return parts.length ? parts.join(' · ') : null;
    }
    if (!visual.primitive) return null;
    const label = PRIMITIVE_LABEL[visual.primitive] || visual.primitive;
    const params = Object.entries(visual.params || {})
      .map(([k, v]) => k + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v))
      .join(', ');
    return params ? label + ' — ' + params : label;
  }

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
      };
    },

    async getSessions(from, to, childId) {
      const params = rangeParams(from, to);
      if (childId && childId !== 'all') params.child_id = childId;
      const data = await call('sessions', params);
      return (data.sessions || []).map((s) => ({
        id: s.id,
        date: localDate(s.started_at),
        time: localTime(s.started_at),
        childId: s.child_id,
        childName: s.first_name,
        mode: MODE_KEY[s.mode] || s.mode,
        status: s.status,
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

      // Le dialogue d'abord — le transcript n'est pas horodaté.
      const timeline = (data.transcript || [])
        .filter((m) => m && (m.role === 'assistant' || m.role === 'user'))
        .map((m) => ({
          type: m.role === 'assistant' ? 'ari' : 'child',
          text: m.content,
        }));

      // Puis exercices et changements de maîtrise survenus pendant la
      // session, ordonnés entre eux par horodatage.
      const startedAt = Date.parse(s.started_at);
      const closedAt = s.closed_at ? Date.parse(s.closed_at) : Infinity;
      const events = [];
      for (const r of data.exercise_results || []) {
        events.push({
          at: Date.parse(r.created_at),
          item: {
            type: 'exercise',
            exerciseId: r.exercise_id,
            notion: r.concept_label || conceptLabel(r.concept_id),
            level: s.grade,
            attempts: r.attempts_count,
            success: r.success,
            statement: r.statement || null,
            visual: describeVisual(r.visual),
          },
        });
      }
      for (const a of data.acquisitions || []) {
        const at = Date.parse(a.updated_at);
        if (at >= startedAt && at <= closedAt) {
          events.push({
            at,
            item: {
              type: 'mastery',
              notion: a.concept_label || conceptLabel(a.concept_id),
              from: null, // la fonction n'expose pas l'ancien statut
              to: MASTERY_LABEL[a.status] || a.status,
            },
          });
        }
      }
      events.sort((a, b) => a.at - b.at);
      timeline.push(...events.map((e) => e.item));

      return {
        id: s.id,
        date: localDate(s.started_at),
        time: localTime(s.started_at),
        childId: s.child_id,
        childName: s.first_name,
        mode: MODE_KEY[s.mode] || s.mode,
        status: s.status,
        durationMin: toMinutes(s.duration_seconds),
        exerciseCount: (data.exercise_results || []).length,
        timeline,
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
    return session.timeline.filter((item) => item.type === 'exercise').length;
  }

  const mockApi = {
    async getStats(from, to) {
      const { children, sessions } = globalThis.ARISTOCLES_MOCK;
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
          durationMin: s.durationMin,
          exerciseCount: mockExerciseCount(s),
        }))
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    },

    async getSessionDetail(id) {
      const { children, sessions } = globalThis.ARISTOCLES_MOCK;
      const session = sessions.find((s) => s.id === id);
      if (!session) return null;
      const child = children.find((c) => c.id === session.childId);
      return {
        id: session.id,
        date: session.date,
        time: session.time,
        childId: session.childId,
        childName: child.name,
        mode: session.mode,
        status: session.status,
        durationMin: session.durationMin,
        exerciseCount: mockExerciseCount(session),
        timeline: session.timeline.map((item) => ({ ...item })),
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
