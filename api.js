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
   sessions(env, from, to, childId) → [{ id, date, time, childId, childName,
     mode, status, theme, durationMin, exerciseCount }] (récentes d'abord)
   detail(env, sessionId) → { …, resume, homework, ecrans[] (avec
     interactions[] et dictee), acquisitions[], evenements[] } ou null
   enfants(env, from?, to?) → voir adapterEnfants (Familles)
   enfant(env, childId, from?, to?) → voir adapterEnfant ou null
   tour(env, generationId) → voir adapterTour ou null
   photo(env, interactionId) → { url, expireLe, nomFichier }, JAMAIS
     mis en cache (URL signée de 5 min) ; 404 `photo_purgee` propagé
   journee(env, date) → voir adapterJournee (La veille)
   apercu(env, from, to) → voir adapterApercu (Vue d'ensemble)
   sante(env, from, to) → voir adapterSante (Santé & coûts)
   veille(env, jours) → voir adapterVeille (Incidents : familles F1-F8,
     série par jour, lignes de la vue ; `jours` entier 1..92)
   Pour ces actions, les jours sont des jours civils de Paris
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

// Une ligne `interaction` (§ 2.3) : le mot à mot d'un écran.
export function adapterInteraction(i) {
  return {
    id: i.id,
    position: i.position,
    type: i.type,
    locuteur: i.locuteur || null,
    texte: i.contenu_texte ?? null,
    createdAt: i.created_at || null,
    generationId: i.llm_generation_id || null,
    modele: i.modele_llm_utilise || null,
    aPhoto: i.a_photo === true,
    metadata: i.metadata ?? null,
  };
}

export function adapterDetail(data) {
  const s = data.session;
  const ecrans = (data.ecrans || []).map((e) => ({
    id: e.id || null,
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
    interactions: tableau(e.interactions).map(adapterInteraction)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    dictee: e.dictee ? adapterDictee(e.dictee) : null,
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
    endedAt: s.ended_at || null,
    cloture: s.cloture ? { soldeeAt: s.cloture.soldee_at || null, motif: s.cloture.motif || null } : null,
    exerciseCount: ecrans.reduce((acc, e) => acc + e.exercices.length, 0),
    resume: data.resume_seance || null,
    homework: data.homework ? adapterDevoir(data.homework) : null,
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

// Devoir (§ 2.5 `devoirs[]`, § 2.3 `homework`).
export function adapterDevoir(d) {
  return {
    id: d.id,
    sessionId: d.session_id || null,
    pourLe: d.pour_le || null,
    matiere: d.matiere || null,
    titre: d.titre || null,
    nbConsignes: d.nb_consignes ?? null,
  };
}

const nombreFini = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Dictée (§ 2.5 `dictees[]` ; sans `session_id` dans `session_detail`).
// Champs DICT-12 (classe, etape, fautes, journal) : null tant que l'Edge
// ne les rend pas, et la vue n'affiche alors pas la partie concernée.
export function adapterDictee(d) {
  const ev = d.evenements_par_type;
  return {
    id: d.id,
    sessionId: d.session_id || null,
    origine: d.origine || null,
    texte: d.texte_reference || null,
    motsCibles: d.mots_cibles ?? null,
    niveau: d.niveau_difficulte ?? null,
    validation: d.validation_status || null,
    tentatives: d.validation_tentatives ?? null,
    ecarts: d.ecarts_detectes ?? null,
    classe: d.classe || null,
    etape: d.etape || null,
    creeAt: d.created_at || null,
    heure: d.created_at ? heureParis(d.created_at) : null,
    finieAt: d.finie_at || null,
    nbFautes: nombreFini(d.nb_fautes_comptees),
    reglesRevues: Array.isArray(d.regles_revues) ? d.regles_revues.filter((r) => typeof r === 'string') : null,
    evenements: ev && typeof ev === 'object' && !Array.isArray(ev)
      ? Object.fromEntries(Object.entries(ev).filter(([, n]) => nombreFini(n) != null))
      : null,
  };
}

// Rubrique Dictée de l'aperçu (§ 2.4 `dictees`, D20) ; null si absente.
export function adapterApercuDictees(x) {
  if (!x || typeof x !== 'object') return null;
  return {
    lancees: nombreFini(x.lancees) ?? 0,
    finies: nombreFini(x.finies) ?? 0,
    nonCorrigees: nombreFini(x.non_corrigees) ?? 0,
    echecsGeneration: nombreFini(x.echecs_generation) ?? 0,
    tauxEchecGeneration: nombreFini(x.taux_echec_generation),
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
    devoirs: tableau(c.devoirs).map(adapterDevoir),
    dictees: tableau(c.dictees).map(adapterDictee)
      .sort((a, b) => (a.creeAt || '').localeCompare(b.creeAt || '')),
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
    // Vide = rien du tout : un jour qui n'a que des incidents de séance
    // ou des échecs IA n'est pas « sans activité ».
    estVide: enfants.length === 0 && technique.ia.appels === 0 && technique.ia.echecs === 0 &&
      technique.ouvertures === 0 && technique.erreursClient.length === 0 &&
      technique.echecsIa.length === 0 && technique.versions.length === 0 &&
      technique.incidents.recents.length === 0 && technique.incidents.parType.every((t) => t.nb === 0),
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
    // Absente tant que l'Edge de l'environnement n'a pas la rubrique Dictée.
    dictees: adapterApercuDictees(data.dictees),
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

// ---------- Adaptateurs lot 5 (enfants, enfant, tour, photo) ----------

function adapterIdentite(c) {
  return {
    childId: c.child_id,
    prenom: c.first_name,
    classe: c.classe || null,
    genre: c.genre || null,
    createdAt: c.created_at || null,
    parentId: c.parent_id || null,
    parentEmail: c.parent_email || null,
  };
}

// Ordre de la page Familles : dernière activité la plus récente
// d'abord, les enfants sans activité ensuite, puis par prénom.
export function trierParActivite(enfants) {
  return [...enfants].sort((a, b) => {
    if (a.derniereActivite !== b.derniereActivite) {
      if (!a.derniereActivite) return 1;
      if (!b.derniereActivite) return -1;
      return Date.parse(b.derniereActivite) - Date.parse(a.derniereActivite);
    }
    return String(a.prenom).localeCompare(String(b.prenom), 'fr');
  });
}

// § 2.6 — tous les enfants, triés par dernière activité.
export function adapterEnfants(data) {
  return {
    from: data.from || null,
    to: data.to || null,
    enfants: trierParActivite(tableau(data.enfants).map((c) => ({
      ...adapterIdentite(c),
      derniereActivite: c.derniere_activite || null,
      seances: c.seances || 0,
      notionsAcquises: c.notions_acquises || 0,
    }))),
  };
}

// § 2.7 — la fiche d'un enfant. Contenus parent, bilans et mémoire
// restent des objets bruts : la vue les affiche en texte, jamais en HTML.
export function adapterEnfant(data) {
  const m = data.memory_profile;
  return {
    from: data.from || null,
    to: data.to || null,
    identite: adapterIdentite(data.identite || {}),
    seances: tableau(data.seances).map(adapterResumeSeance),
    maitrise: tableau(data.maitrise).map((x) => ({
      conceptId: x.concept_id || null,
      notion: x.notion || null,
      maitrise: x.statut_maitrise,
      vuEnClasse: x.statut_vu_en_classe,
      majAt: x.derniere_mise_a_jour || null,
    })),
    notionsAcquises: data.notions_acquises || 0,
    devoirs: tableau(data.devoirs).map(adapterDevoir),
    dictees: tableau(data.dictees).map(adapterDictee)
      .sort((a, b) => (b.creeAt || '').localeCompare(a.creeAt || '')),
    bilans: tableau(data.bilans).map((b) => ({
      id: b.id,
      type: b.type || null,
      periodeCle: b.periode_cle || null,
      statut: b.statut || null,
      contenu: b.contenu ?? null,
      modele: b.modele || null,
      genereAt: b.genere_at || null,
      regenereAt: b.regenere_at || null,
      luAt: b.lu_at || null,
    })),
    conversationsParent: tableau(data.conversations_parent).map((c) => ({
      id: c.id,
      entreeType: c.entree_type || null,
      entreePeriodeCle: c.entree_periode_cle || null,
      messages: tableau(c.messages).map((x) => ({ role: x.role || null, contenu: x.content ?? null })),
      modele: c.modele || null,
      creeAt: c.cree_at || null,
      majAt: c.maj_at || null,
    })),
    memoire: m
      ? {
        intelligencesEmergentes: m.intelligences_emergentes ?? null,
        preferencesPedagogiques: m.preferences_pedagogiques ?? null,
        interetsPersonnels: m.interets_personnels ?? null,
        contextePersonnel: m.contexte_personnel ?? null,
        niveauDictee: m.niveau_dictee ?? null,
        derniereExtractionAt: m.derniere_extraction_at || null,
        updatedAt: m.updated_at || null,
      }
      : null,
    ecrans: tableau(data.ecrans).map((e) => ({ ecran: e.ecran, nb: e.nb || 0, dureeMs: e.duree_totale_ms || 0 })),
    versions: tableau(data.versions).map(adapterVersion),
    photos: tableau(data.photos).map((p) => ({
      interactionId: p.interaction_id,
      ecranId: p.ecran_id || null,
      sessionId: p.session_id || null,
      createdAt: p.created_at || null,
    })),
  };
}

// § 2.9 — un appel IA. `trace` et `promptSysteme` valent null quand
// la trace est purgée (90 jours) ou n'a jamais existé.
export function adapterTour(data) {
  const g = data.generation || {};
  const t = data.trace;
  const p = data.prompt_systeme;
  return {
    generation: {
      id: g.id,
      childId: g.child_id || null,
      role: g.role || null,
      unite: g.unite || 'token',
      modele: g.modele || null,
      promptVersion: g.prompt_version ?? null,
      latenceMs: nombreOuNull(g.latence_ms),
      volumeEntree: nombreOuNull(g.tokens_input),
      volumeSortie: nombreOuNull(g.tokens_output),
      eur: nombreOuNull(g.cout_estime_eur),
      succes: g.succes === true,
      erreur: g.erreur || null,
      metadata: g.metadata ?? null,
      createdAt: g.created_at || null,
    },
    trace: t
      ? {
        id: t.id,
        fournisseur: t.fournisseur || null,
        modele: t.modele || null,
        promptVersion: t.prompt_version ?? null,
        requete: t.requete ?? null,
        reponse: t.reponse ?? null,
        createdAt: t.created_at || null,
      }
      : null,
    promptSysteme: p
      ? {
        sha256: p.sha256 || null,
        regime: p.regime || null,
        promptVersion: p.prompt_version ?? null,
        taille: p.taille ?? null,
        texte: p.texte ?? null,
        premiereVueAt: p.premiere_vue_at || null,
      }
      : null,
  };
}

// § 2.10 — URL signée de téléchargement (5 min).
export function adapterPhoto(data) {
  return { url: data.url, expireLe: data.expire_le || null, nomFichier: data.nom_fichier || null };
}

// Erreur de l'action `photo` → état affichable. Une photo purgée
// (404 `photo_purgee`) est un état normal, pas une panne.
export function etatErreurPhoto(e) {
  if (e && e.status === 404 && e.message === 'photo_purgee') {
    return { code: 'purgee', message: 'Photo effacée (purge automatique)' };
  }
  return { code: 'erreur', message: 'Téléchargement impossible, réessayez.' };
}

// ---------- Veille de la prod (page Incidents, veille-prod.md § 7) ----------

const FAMILLES_VEILLE = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'];
const NIVEAUX_VEILLE = ['vert', 'orange', 'rouge'];
const niveauVeille = (n) => (NIVEAUX_VEILLE.includes(n) ? n : 'vert');

// `familles` est rendu F1 → F8 par l'Edge ; l'ordre est garanti ici aussi.
// Un coût null reste null (inconnu), jamais 0.
export function adapterVeille(data) {
  const rang = (f) => (FAMILLES_VEILLE.includes(f) ? FAMILLES_VEILLE.indexOf(f) : FAMILLES_VEILLE.length);
  return {
    genereLe: data.genere_le || null,
    aujourdhui: data.aujourdhui || null,
    jours: data.jours ?? null,
    premierJour: data.premier_jour || null,
    niveau: niveauVeille(data.niveau),
    familles: tableau(data.familles).map((f) => ({
      famille: f.famille,
      libelle: f.libelle || f.famille,
      niveau: niveauVeille(f.niveau),
      nb: f.nb || 0,
      joursRouges: f.jours_rouges || 0,
      joursOrange: f.jours_orange || 0,
      dernierJourSignale: f.dernier_jour_signale || null,
      seuil: { orange: f.seuil?.orange ?? null, rouge: f.seuil?.rouge ?? null },
    })).sort((a, b) => rang(a.famille) - rang(b.famille)),
    serie: tableau(data.serie).map((p) => ({
      jour: p.jour,
      partiel: p.partiel === true,
      niveau: niveauVeille(p.niveau),
      appelsLlm: p.appels_llm || 0,
      eur: nombreOuNull(p.cout_eur),
      familles: Object.fromEntries(Object.entries(p.familles || {}).map(([cle, f]) => [cle, {
        niveau: niveauVeille(f?.niveau),
        nb: f?.nb || 0,
        motifs: tableau(f?.motifs),
      }])),
    })),
    lignes: tableau(data.lignes).map((l) => ({
      jour: l.jour,
      famille: l.famille,
      fonction: l.fonction || null,
      role: l.role || null,
      modele: l.modele || null,
      code: l.code,
      nb: l.nb || 0,
      nbTotal: nombreOuNull(l.nb_total),
      p50: nombreOuNull(l.latence_p50_ms),
      p95: nombreOuNull(l.latence_p95_ms),
      eur: nombreOuNull(l.cout_eur),
      premierAt: l.premier_at || null,
      dernierAt: l.dernier_at || null,
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

  // Plage optionnelle (jours civils de Paris) : les deux bornes ou aucune.
  const plageOptionnelle = (from, to) => (from && to ? bornesParis(from, to) : {});

  return {
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
    async veille(env, jours, options) {
      return adapterVeille(await appeler(env, 'veille', { jours }, options));
    },
    async enfants(env, from, to, options) {
      return adapterEnfants(await appeler(env, 'enfants', plageOptionnelle(from, to), options));
    },
    async enfant(env, childId, from, to, options) {
      try {
        return adapterEnfant(await appeler(env, 'enfant', { child_id: childId, ...plageOptionnelle(from, to) }, options));
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    },
    async tour(env, generationId, options) {
      try {
        return adapterTour(await appeler(env, 'tour', { llm_generation_id: generationId }, options));
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    },
    // Hors cache : l'URL signée expire en 5 minutes, on la redemande à chaque clic.
    async photo(env, interactionId, options = {}) {
      return adapterPhoto(await transport(env, 'photo', { interaction_id: interactionId }, options));
    },
    viderCache(env) {
      cache.viderEnv(env);
    },
  };
}
