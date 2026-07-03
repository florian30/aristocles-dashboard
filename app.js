/* ============================================================
   Aristocles — Suivi des testeurs
   Logique de la page. Toutes les données passent par
   globalThis.AristoclesAPI (api.js) ; aucun accès direct au mock.
   ============================================================ */
(function () {
  'use strict';

  const api = globalThis.AristoclesAPI;
  const PW_STORAGE_KEY = 'aristocles-pw';

  const state = {
    authed: false,
    view: 'stats', // 'stats' | 'sessions' | 'reader'
    rangeKey: '7d', // 'hier' | '7d' | '30d' | 'tout' | 'custom'
    from: null,
    to: null,
    childFilter: 'all',
    openSessionId: null,
    // Tous les enfants connus (plage complète, chargés au login) :
    // sert au menu déroulant et aux lignes inactives du tableau.
    allChildren: [],
  };

  const el = (id) => document.getElementById(id);

  // ---------- Formatage ----------

  function isoDaysAgo(n) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function fmtDur(min) {
    if (min == null) return 'En cours';
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60);
    return h + ' h ' + String(min % 60).padStart(2, '0');
  }

  function fmtDate(dateStr, time) {
    const d = new Date(dateStr + 'T12:00:00');
    const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    return label + ' · ' + time;
  }

  function modeLabel(mode) {
    return mode === 'devoirs' ? 'Devoirs' : 'Entraînement';
  }

  function plural(n, word) {
    return n + ' ' + word + (n > 1 ? 's' : '');
  }

  // ---------- Construction DOM ----------

  function node(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ---------- Erreurs ----------

  function showLoginError(message) {
    const box = el('login-error');
    box.textContent = message;
    box.hidden = false;
  }

  function hideLoginError() {
    el('login-error').hidden = true;
  }

  function forceLogout(message) {
    api.setPassword(null);
    sessionStorage.removeItem(PW_STORAGE_KEY);
    state.authed = false;
    state.view = 'stats';
    state.openSessionId = null;
    state.childFilter = 'all';
    render();
    if (message) showLoginError(message);
  }

  // Erreur pendant l'usage : 401 → retour au login, sinon message
  // dans le conteneur de la vue.
  function handleViewError(error, containerId) {
    if (error && error.status === 401) {
      forceLogout('Accès refusé — reconnectez-vous.');
      return;
    }
    const box = el(containerId);
    box.replaceChildren(node('div', 'table-empty', 'Erreur de chargement — ' + error.message));
  }

  // ---------- Navigation & affichage ----------

  function applyRange(key) {
    state.rangeKey = key;
    if (key === 'hier') {
      state.from = isoDaysAgo(1);
      state.to = isoDaysAgo(1);
    } else if (key === '7d') {
      state.from = isoDaysAgo(6);
      state.to = isoDaysAgo(0);
    } else if (key === '30d') {
      state.from = isoDaysAgo(29);
      state.to = isoDaysAgo(0);
    } else {
      state.from = null;
      state.to = null;
    }
  }

  function render() {
    el('login-screen').hidden = state.authed;
    el('app').hidden = !state.authed;
    if (!state.authed) return;

    el('tab-stats').classList.toggle('is-active', state.view === 'stats');
    el('tab-sessions').classList.toggle('is-active', state.view === 'sessions' || state.view === 'reader');

    el('toolbar').hidden = state.view === 'reader';
    el('view-stats').hidden = state.view !== 'stats';
    el('view-sessions').hidden = state.view !== 'sessions';
    el('view-reader').hidden = state.view !== 'reader';

    if (state.view !== 'reader') {
      el('range-shortcuts').querySelectorAll('button').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.range === state.rangeKey);
      });
      el('date-from').value = state.from || '';
      el('date-to').value = state.to || '';
      el('child-filter').hidden = state.view !== 'sessions';
    }

    if (state.view === 'stats') renderStats();
    else if (state.view === 'sessions') renderSessions();
    else renderReader();
  }

  // ---------- Vue Statistiques ----------

  async function renderStats() {
    let stats;
    try {
      stats = await api.getStats(state.from, state.to);
    } catch (e) {
      handleViewError(e, 'stats-table');
      return;
    }

    const kpis = [
      { label: 'Enfants actifs', value: String(stats.activeChildren) },
      { label: 'Sessions', value: String(stats.sessionCount) },
      { label: 'Exercices réalisés', value: String(stats.exerciseCount) },
      { label: 'Temps total passé', value: stats.totalMinutes ? fmtDur(stats.totalMinutes) : '0 min' },
    ];
    const grid = el('kpi-grid');
    grid.replaceChildren();
    for (const kpi of kpis) {
      const card = node('div', 'kpi-card');
      card.append(node('div', 'eyebrow', kpi.label), node('div', 'kpi-value', kpi.value));
      grid.append(card);
    }

    // La fonction ne renvoie que les enfants actifs sur la plage :
    // on complète avec la liste connue pour afficher les inactifs.
    const byId = new Map(stats.perChild.map((c) => [c.childId, c]));
    const rows = state.allChildren.map((child) =>
      byId.get(child.childId) || { ...child, sessions: 0, exercises: 0, minutes: 0 }
    );
    for (const c of stats.perChild) {
      if (!state.allChildren.some((k) => k.childId === c.childId)) rows.push(c);
    }
    rows.sort((a, b) => b.minutes - a.minutes);

    const table = el('stats-table');
    table.replaceChildren();
    const head = node('div', 'table-head');
    head.append(
      node('span', 'eyebrow', 'Prénom'),
      node('span', 'eyebrow cell-right', 'Sessions'),
      node('span', 'eyebrow cell-right', 'Exercices'),
      node('span', 'eyebrow cell-right', 'Temps passé')
    );
    table.append(head);

    for (const row of rows) {
      const inactive = row.sessions === 0 && row.exercises === 0;
      const line = node('div', 'table-row' + (inactive ? ' is-inactive' : ''));
      line.append(
        node('span', 'row-name', row.name),
        node('span', 'row-num cell-right', String(row.sessions)),
        node('span', 'row-num cell-right', String(row.exercises)),
        node('span', 'row-num cell-right', inactive ? '—' : fmtDur(row.minutes))
      );
      table.append(line);
    }
  }

  // ---------- Vue Sessions ----------

  async function renderSessions() {
    let sessions;
    try {
      sessions = await api.getSessions(state.from, state.to, state.childFilter);
    } catch (e) {
      handleViewError(e, 'sessions-table');
      return;
    }

    el('sessions-title').textContent = plural(sessions.length, 'session');

    const table = el('sessions-table');
    table.replaceChildren();
    const head = node('div', 'table-head');
    head.append(
      node('span', 'eyebrow', 'Date · heure'),
      node('span', 'eyebrow', 'Enfant'),
      node('span', 'eyebrow', 'Mode'),
      node('span', 'eyebrow cell-right', 'Durée'),
      node('span', 'eyebrow cell-right', 'Exercices')
    );
    table.append(head);

    if (sessions.length === 0) {
      table.append(node('div', 'table-empty', 'Aucune session sur cette période.'));
      return;
    }

    for (const s of sessions) {
      const row = node('div', 'table-row');
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');

      const mode = node('span', 'row-mode');
      mode.append(node('span', 'mode-dot is-' + s.mode), document.createTextNode(modeLabel(s.mode)));

      row.append(
        node('span', 'row-date', fmtDate(s.date, s.time)),
        node('span', 'row-name', s.childName),
        mode,
        node('span', 'row-num cell-right' + (s.durationMin == null ? ' row-open' : ''), fmtDur(s.durationMin)),
        node('span', 'row-num cell-right', String(s.exerciseCount))
      );

      const open = () => {
        state.view = 'reader';
        state.openSessionId = s.id;
        render();
        window.scrollTo(0, 0);
      };
      row.addEventListener('click', open);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
      table.append(row);
    }
  }

  // ---------- Vue Lecteur de session ----------

  async function renderReader() {
    let session;
    try {
      session = await api.getSessionDetail(state.openSessionId);
    } catch (e) {
      handleViewError(e, 'timeline');
      return;
    }
    if (!session) {
      state.view = 'sessions';
      render();
      return;
    }

    el('reader-name').textContent = session.childName;
    el('reader-meta').textContent = [
      fmtDate(session.date, session.time),
      modeLabel(session.mode),
      fmtDur(session.durationMin),
      plural(session.exerciseCount, 'exercice'),
    ].join(' · ');

    const timeline = el('timeline');
    timeline.replaceChildren();

    for (const item of session.timeline) {
      if (item.type === 'ari' || item.type === 'child') {
        const group = node('div', 'bubble-group is-' + item.type);
        group.append(
          node('span', 'bubble-speaker', item.type === 'ari' ? 'Ari' : session.childName),
          node('div', 'bubble', item.text)
        );
        timeline.append(group);
      } else if (item.type === 'exercise') {
        timeline.append(buildExerciseCard(item));
      } else if (item.type === 'mastery') {
        const divider = node('div', 'mastery-divider');
        const label = node('span', 'mastery-label');
        label.append(
          document.createTextNode('Maîtrise · '),
          node('span', 'mastery-notion', item.notion),
          document.createTextNode(' : ' + (item.from ? item.from + ' → ' : '')),
          node('span', 'mastery-to', item.to)
        );
        divider.append(label);
        timeline.append(divider);
      }
    }
  }

  function buildExerciseCard(item) {
    const expandable = Boolean(item.statement || item.visual);
    const card = node('div', 'exercise-card' + (expandable ? ' is-expandable' : ''));

    const summary = node('div', 'exercise-summary');
    const id = node('div', 'exercise-id');
    id.append(
      node('span', 'exercise-notion', item.notion),
      node('span', 'exercise-meta',
        ['Exercice ' + item.exerciseId, item.level, plural(item.attempts, 'tentative')]
          .filter(Boolean).join(' · '))
    );
    const end = node('div', 'exercise-end');
    end.append(node('span', 'verdict ' + (item.success ? 'is-success' : 'is-failure'),
      item.success ? 'Réussi' : 'Échoué'));
    if (expandable) end.append(node('span', 'exercise-caret'));
    summary.append(id, end);
    card.append(summary);

    if (!expandable) return card;

    const detail = node('div', 'exercise-detail');
    detail.hidden = true;
    if (item.statement) {
      const block = node('div', 'exercise-detail-block');
      block.append(node('span', 'eyebrow', 'Énoncé'), node('p', null, item.statement));
      detail.append(block);
    }
    if (item.visual) {
      const block = node('div', 'exercise-detail-block is-visual');
      block.append(node('span', 'eyebrow', 'Visuel'), node('p', null, item.visual));
      detail.append(block);
    }
    card.append(detail);

    summary.setAttribute('role', 'button');
    summary.setAttribute('tabindex', '0');
    summary.setAttribute('aria-expanded', 'false');
    const toggle = () => {
      const open = card.classList.toggle('is-open');
      detail.hidden = !open;
      summary.setAttribute('aria-expanded', String(open));
    };
    summary.addEventListener('click', toggle);
    summary.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });

    return card;
  }

  // ---------- Authentification ----------

  function buildChildFilter(perChild) {
    state.allChildren = perChild.map((c) => ({
      childId: c.childId,
      name: c.name,
      sessions: c.sessions,
      exercises: c.exercises,
      minutes: c.minutes,
    }));
    const select = el('child-filter');
    select.replaceChildren();
    const all = node('option', null, 'Tous les enfants');
    all.value = 'all';
    select.append(all);
    for (const child of perChild) {
      const option = node('option', null, child.name);
      option.value = child.childId;
      select.append(option);
    }
    select.value = state.childFilter;
  }

  // Valide le mot de passe par un appel réel (stats sur la plage
  // complète) — la réponse sert aussi à connaître tous les enfants.
  async function authenticate(pw) {
    api.setPassword(pw);
    try {
      const stats = await api.getStats(null, null);
      buildChildFilter(stats.perChild);
      sessionStorage.setItem(PW_STORAGE_KEY, pw);
      state.authed = true;
      return null;
    } catch (e) {
      api.setPassword(null);
      return e.status === 401 ? 'Mot de passe incorrect.' : e.message;
    }
  }

  // ---------- Événements globaux ----------

  el('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = el('pw').value;
    if (pw.trim().length === 0) {
      showLoginError('Veuillez saisir le mot de passe.');
      return;
    }
    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = true;
    const failure = await authenticate(pw);
    button.disabled = false;
    if (failure) {
      showLoginError(failure);
      return;
    }
    el('pw').value = '';
    hideLoginError();
    applyRange('7d');
    render();
  });

  el('pw').addEventListener('input', hideLoginError);

  el('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    forceLogout(null);
    hideLoginError();
  });

  el('tab-stats').addEventListener('click', () => {
    state.view = 'stats';
    state.openSessionId = null;
    render();
  });

  el('tab-sessions').addEventListener('click', () => {
    state.view = 'sessions';
    state.openSessionId = null;
    render();
  });

  el('reader-back').addEventListener('click', (e) => {
    e.preventDefault();
    state.view = 'sessions';
    state.openSessionId = null;
    render();
  });

  el('range-shortcuts').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-range]');
    if (!button) return;
    applyRange(button.dataset.range);
    render();
  });

  el('date-from').addEventListener('change', (e) => {
    state.from = e.target.value || null;
    state.rangeKey = 'custom';
    render();
  });

  el('date-to').addEventListener('change', (e) => {
    state.to = e.target.value || null;
    state.rangeKey = 'custom';
    render();
  });

  el('child-filter').addEventListener('change', (e) => {
    state.childFilter = e.target.value;
    render();
  });

  // ---------- Initialisation ----------

  async function init() {
    const stored = sessionStorage.getItem(PW_STORAGE_KEY);
    if (stored) await authenticate(stored); // échec silencieux → login
    applyRange('7d');
    render();
  }

  init();
})();
