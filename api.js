/* ============================================================
   Aristocles — Couche d'accès aux données
   Aujourd'hui : lit les données factices de mock.js.
   Demain : chaque fonction appellera une Edge Function Supabase
   en conservant exactement les mêmes signatures et formes de
   retour — rien d'autre dans la page ne devra changer.

   Conventions :
   - from / to : dates ISO 'AAAA-MM-JJ' inclusives ; null ou ''
     signifie « non borné » de ce côté.
   - childId : identifiant enfant, ou null / '' / 'all' pour tous.
   - Toutes les fonctions renvoient des promesses.
   ============================================================ */
(function () {
  'use strict';

  function inRange(session, from, to) {
    if (from && session.date < from) return false;
    if (to && session.date > to) return false;
    return true;
  }

  function exerciseCount(session) {
    return session.timeline.filter((item) => item.type === 'exercise').length;
  }

  /**
   * getStats(from, to) →
   * {
   *   activeChildren, sessionCount, exerciseCount, totalMinutes,
   *   perChild: [{ childId, name, sessions, exercises, minutes }]
   *             — tous les enfants connus, y compris à zéro.
   * }
   */
  async function getStats(from, to) {
    const { children, sessions } = globalThis.ARISTOCLES_MOCK;
    const filtered = sessions.filter((s) => inRange(s, from, to));

    const perChild = children.map((child) => {
      const mine = filtered.filter((s) => s.childId === child.id);
      return {
        childId: child.id,
        name: child.name,
        sessions: mine.length,
        exercises: mine.reduce((acc, s) => acc + exerciseCount(s), 0),
        minutes: mine.reduce((acc, s) => acc + s.durationMin, 0),
      };
    });

    return {
      activeChildren: new Set(filtered.map((s) => s.childId)).size,
      sessionCount: filtered.length,
      exerciseCount: filtered.reduce((acc, s) => acc + exerciseCount(s), 0),
      totalMinutes: filtered.reduce((acc, s) => acc + s.durationMin, 0),
      perChild,
    };
  }

  /**
   * getSessions(from, to, childId) →
   * [{ id, date, time, childId, childName, mode, durationMin, exerciseCount }]
   * triées de la plus récente à la plus ancienne.
   */
  async function getSessions(from, to, childId) {
    const { sessions } = globalThis.ARISTOCLES_MOCK;
    const childById = Object.fromEntries(
      globalThis.ARISTOCLES_MOCK.children.map((c) => [c.id, c])
    );
    return sessions
      .filter((s) => inRange(s, from, to))
      .filter((s) => !childId || childId === 'all' || s.childId === childId)
      .map((s) => ({
        id: s.id,
        date: s.date,
        time: s.time,
        childId: s.childId,
        childName: childById[s.childId].name,
        mode: s.mode,
        durationMin: s.durationMin,
        exerciseCount: exerciseCount(s),
      }))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }

  /**
   * getSessionDetail(id) →
   * { id, date, time, childId, childName, mode, durationMin,
   *   exerciseCount, timeline: [...] } ou null si introuvable.
   * Éléments de timeline :
   *   { type: 'ari' | 'child', text }
   *   { type: 'exercise', exerciseId, notion, level, attempts,
   *     success, statement, visual }
   *   { type: 'mastery', notion, from, to }
   */
  async function getSessionDetail(id) {
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
      durationMin: session.durationMin,
      exerciseCount: exerciseCount(session),
      timeline: session.timeline.map((item) => ({ ...item })),
    };
  }

  globalThis.AristoclesAPI = { getStats, getSessions, getSessionDetail };
})();
