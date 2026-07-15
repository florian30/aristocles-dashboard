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
    return fmtDateOnly(dateStr) + ' · ' + time;
  }

  function fmtDateOnly(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function modeLabel(mode) {
    return mode === 'devoirs' ? 'Devoirs' : 'Entraînement';
  }

  function plural(n, word) {
    return n + ' ' + word + (n > 1 ? 's' : '');
  }

  // ---------- Libellés des valeurs socle ----------
  // Les clés brutes viennent d'api.js ; une valeur inconnue est
  // affichée telle quelle (contrat additif côté fonction).

  const STATUS_LABEL = { active: 'En cours', archivee: 'Archivée' };

  const TYPE_ECRAN_LABEL = {
    captation: 'Captation des devoirs',
    vue_ensemble: "Vue d'ensemble",
    exercice: 'Exercice',
    pont_entrainement: 'Pont entraînement',
    bilan_session: 'Bilan de session',
  };

  // label + classe de couleur de la pastille d'écran.
  const FERMETURE_LABEL = {
    en_cours: { label: 'En cours', cls: 'is-info' },
    resolu_succes: { label: 'Résolu', cls: 'is-success' },
    resolu_fragile: { label: 'Résolu — fragile', cls: 'is-fragile' },
    interrompu_pause_explicite: { label: 'Interrompu (pause)', cls: 'is-muted' },
    interrompu_timeout_serveur: { label: 'Interrompu (timeout)', cls: 'is-muted' },
    interrompu_navigation: { label: 'Interrompu (navigation)', cls: 'is-muted' },
    abandon: { label: 'Abandonné', cls: 'is-failure' },
  };

  const RESULTAT_LABEL = {
    succes: { label: 'Réussi', cls: 'is-success' },
    fragile: { label: 'Fragile', cls: 'is-fragile' },
    interrompu_pause: { label: 'Interrompu (pause)', cls: 'is-muted' },
    interrompu_timeout: { label: 'Interrompu (timeout)', cls: 'is-muted' },
    abandon: { label: 'Abandonné', cls: 'is-failure' },
  };

  const ORIGINE_LABEL = {
    devoir_scolaire: 'Devoir scolaire',
    entrainement_complementaire: 'Entraînement complémentaire',
    entrainement_libre: 'Entraînement libre',
  };

  const MAITRISE_LABEL = {
    jamais_vue: { label: 'Jamais vue', cls: 'is-muted' },
    fragile: { label: 'Fragile', cls: 'is-fragile' },
    en_cours: { label: 'En cours', cls: 'is-info' },
    acquise: { label: 'Acquise', cls: 'is-success' },
    parfaitement_acquise: { label: 'Parfaitement acquise', cls: 'is-success' },
  };

  const VU_EN_CLASSE_LABEL = {
    presume_vu: 'Présumé vu',
    presume_non_vu: 'Présumé non vu',
    non_determine: '—',
  };

  function fmtDurSec(sec) {
    if (sec == null) return null;
    if (sec < 60) return sec + ' s';
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    return r ? m + ' min ' + String(r).padStart(2, '0') + ' s' : m + ' min';
  }

  function fmtEur(v) {
    return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' €';
  }

  function fmtInt(v) {
    return v.toLocaleString('fr-FR');
  }

  // Horodatage précis à la milliseconde pour la chronologie technique.
  function fmtTsPrecise(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':' +
      String(d.getSeconds()).padStart(2, '0') + '.' +
      String(d.getMilliseconds()).padStart(3, '0');
  }

  // Résumé d'un detail jsonb : concaténation des paires clé:valeur,
  // sans autre interprétation (jamais de verbatim par construction).
  function fmtDetailSuffix(detail) {
    if (!detail || typeof detail !== 'object') return '';
    const pairs = Object.entries(detail).map(([k, v]) => k + ':' + v).join(' ');
    return pairs ? ' · ' + pairs : '';
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

    renderLlm(stats.llm);
  }

  // Bloc coûts LLM sous le tableau par enfant. Coûts globaux (pas par
  // enfant : la fonction ne sait pas rattacher les appels du tuteur).
  function renderLlm(llm) {
    const section = el('llm-section');
    section.hidden = !llm;
    if (!llm) return;

    const kpis = [
      { label: 'Coût total estimé', value: fmtEur(llm.totalEur) },
      { label: 'Appels', value: fmtInt(llm.calls) },
      { label: 'Tokens entrée', value: fmtInt(llm.tokensInput) },
      { label: 'Tokens sortie', value: fmtInt(llm.tokensOutput) },
    ];
    const grid = el('llm-kpis');
    grid.replaceChildren();
    for (const kpi of kpis) {
      const card = node('div', 'kpi-card');
      card.append(node('div', 'eyebrow', kpi.label), node('div', 'kpi-value', kpi.value));
      grid.append(card);
    }

    const table = el('llm-table');
    table.replaceChildren();
    const head = node('div', 'table-head');
    head.append(
      node('span', 'eyebrow', 'Rôle'),
      node('span', 'eyebrow cell-right', 'Coût'),
      node('span', 'eyebrow cell-right', 'Appels'),
      node('span', 'eyebrow cell-right', 'Tokens entrée'),
      node('span', 'eyebrow cell-right', 'Tokens sortie')
    );
    table.append(head);

    if (llm.perRole.length === 0) {
      table.append(node('div', 'table-empty', 'Aucun appel sur cette période.'));
      return;
    }
    for (const r of llm.perRole) {
      const line = node('div', 'table-row');
      line.append(
        node('span', 'row-name', r.role),
        node('span', 'row-num cell-right', fmtEur(r.eur)),
        node('span', 'row-num cell-right', fmtInt(r.calls)),
        node('span', 'row-num cell-right', fmtInt(r.tokensInput)),
        node('span', 'row-num cell-right', fmtInt(r.tokensOutput))
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

      const name = node('span', 'row-name', s.childName);
      if (s.theme) name.append(node('span', 'row-theme', s.theme));

      row.append(
        node('span', 'row-date', fmtDate(s.date, s.time)),
        name,
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
      handleViewError(e, 'reader-body');
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
      session.classe,
      STATUS_LABEL[session.status] || session.status,
      session.durationMin == null ? null : fmtDur(session.durationMin),
      plural(session.exerciseCount, 'exercice'),
    ].filter(Boolean).join(' · ');
    el('reader-sub').textContent =
      'Thème : ' + (session.theme || '—') +
      ' · Notion principale : ' + (session.notion || '—');

    const body = el('reader-body');
    body.replaceChildren();

    // Bilan de séance (absent sur les vieilles sessions → « — »).
    const bilan = node('section', 'resume-card');
    bilan.append(
      node('span', 'eyebrow', 'Bilan de séance'),
      node('p', 'resume-text' + (session.resume ? '' : ' is-empty'), session.resume || '—')
    );
    body.append(bilan);

    // Fil de la séance : une carte par écran, avec sa synthèse.
    body.append(node('h2', 'section-title', 'Fil de la séance'));
    if (session.ecrans.length === 0) {
      body.append(node('p', 'reader-empty', 'Aucun écran pour cette session.'));
    }
    for (const ecran of session.ecrans) {
      body.append(buildEcranCard(ecran));
    }

    // Chronologie technique (trace client du pipeline voix) : section
    // optionnelle, repliée par défaut. Absente tant qu'il n'y a rien à
    // tracer (evenements vide — Edge pas encore déployée, ou aucun
    // événement journalisé pour cette session).
    if (session.evenements.length > 0) {
      body.append(buildChronologieCard(session.evenements));
    }

    // Acquisitions de l'enfant (mémoire, indépendante de la session).
    body.append(node('h2', 'section-title', 'Acquisitions'));
    body.append(buildAcquisitionsTable(session.acquisitions));
  }

  function buildEcranCard(ecran) {
    const card = node('section', 'ecran-card');

    const head = node('div', 'ecran-head');
    head.append(node('span', 'ecran-title',
      'Écran ' + ecran.position + ' · ' + (TYPE_ECRAN_LABEL[ecran.type] || ecran.type)));
    const flags = node('div', 'ecran-flags');
    const fermeture = FERMETURE_LABEL[ecran.statutFermeture];
    flags.append(node('span',
      'chip ' + (fermeture ? fermeture.cls : 'is-muted'),
      fermeture ? fermeture.label : (ecran.statutFermeture || '—')));
    // pouce_enfant : toujours null aujourd'hui, se remplira seul (lot F5).
    flags.append(node('span', 'pouce',
      ecran.pouce === 'haut' ? '👍' : ecran.pouce === 'bas' ? '👎' : 'Pouce —'));
    head.append(flags);
    card.append(head);

    const content = node('div', 'ecran-body');
    content.append(node('p', 'ecran-synthese' + (ecran.synthese ? '' : ' is-empty'),
      ecran.synthese || '—'));
    if (ecran.exercices.length > 0) {
      const list = node('div', 'ecran-exos');
      for (const x of ecran.exercices) list.append(buildExerciseCard(x));
      content.append(list);
    }
    card.append(content);

    return card;
  }

  function buildExerciseCard(item) {
    const expandable = Boolean(item.enonce);
    const card = node('div', 'exercise-card' + (expandable ? ' is-expandable' : ''));

    const summary = node('div', 'exercise-summary');
    const id = node('div', 'exercise-id');
    id.append(
      node('span', 'exercise-notion',
        item.notions.length ? item.notions.join(' · ') : 'Exercice'),
      node('span', 'exercise-meta',
        [ORIGINE_LABEL[item.origine] || item.origine, fmtDurSec(item.dureeSec)]
          .filter(Boolean).join(' · '))
    );
    const resultat = RESULTAT_LABEL[item.resultat];
    const end = node('div', 'exercise-end');
    end.append(node('span', 'verdict ' + (resultat ? resultat.cls : 'is-muted'),
      resultat ? resultat.label : item.resultat));
    if (expandable) end.append(node('span', 'exercise-caret'));
    summary.append(id, end);
    card.append(summary);

    if (!expandable) return card;

    const detail = node('div', 'exercise-detail');
    detail.hidden = true;
    const block = node('div', 'exercise-detail-block');
    block.append(node('span', 'eyebrow', 'Énoncé'), node('p', null, item.enonce));
    detail.append(block);
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

  // Carte repliable « Chronologie technique » : trace brute du pipeline
  // voix (déclencheurs, tours, TTS), utile pour repérer un bug
  // intermittent (ex. deux tours entrelacés). Même patron d'expansion
  // que buildExerciseCard (role=button, aria-expanded, Enter/Espace).
  function buildChronologieCard(evenements) {
    const card = node('section', 'chrono-card is-expandable');

    const summary = node('div', 'chrono-summary');
    const end = node('div', 'chrono-head-end');
    end.append(
      node('span', 'chrono-count', plural(evenements.length, 'événement')),
      node('span', 'chrono-caret')
    );
    summary.append(node('span', 'chrono-title', 'Chronologie technique'), end);
    card.append(summary);

    const detail = node('div', 'chrono-detail');
    detail.hidden = true;
    const list = node('div', 'chrono-events');
    for (const ev of evenements) {
      list.append(node('div', 'chrono-event',
        fmtTsPrecise(ev.ts) + ' · ' + ev.type + fmtDetailSuffix(ev.detail)));
    }
    detail.append(list);
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

  function buildAcquisitionsTable(acquisitions) {
    const table = node('div', 'data-table acq-table');
    const head = node('div', 'table-head');
    head.append(
      node('span', 'eyebrow', 'Notion'),
      node('span', 'eyebrow', 'Maîtrise'),
      node('span', 'eyebrow', 'Vu en classe'),
      node('span', 'eyebrow cell-right', 'Mise à jour')
    );
    table.append(head);

    if (acquisitions.length === 0) {
      // Liste maigre attendue hors CM1 seedé tant que le pont notions
      // (F1) n'est pas en place.
      table.append(node('div', 'table-empty', 'Aucune acquisition enregistrée pour cet enfant.'));
      return table;
    }

    for (const a of acquisitions) {
      const maitrise = MAITRISE_LABEL[a.maitrise];
      const line = node('div', 'table-row');
      line.append(
        node('span', 'row-name', a.notion || '—'),
        node('span', 'acq-maitrise ' + (maitrise ? maitrise.cls : ''),
          maitrise ? maitrise.label : a.maitrise),
        node('span', 'row-num', VU_EN_CLASSE_LABEL[a.vuEnClasse] || a.vuEnClasse),
        node('span', 'row-num cell-right', a.majDate ? fmtDateOnly(a.majDate) : '—')
      );
      table.append(line);
    }
    return table;
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
