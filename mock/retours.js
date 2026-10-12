/* ============================================================
   Mock des actions `retours`, `retour`, `retour_statut` (AVIS-3,
   contrat-dashboard.md § 2.13 à 2.15). Formes brutes de l'Edge.
   Comme console.js, ce mock a un ÉTAT : un statut changé reste
   jusqu'au rechargement de la page (un état par transport).
   Parents, enfants et textes sont fictifs (mock/familles.js).

   Trois retours : un bug avec capture et séance (nouveau), une idée
   sans enfant (lu), un retour inscrit au registre dont la capture
   est purgée (inscrit). Le fil d'usage du premier a un événement
   après l'envoi ; ses erreurs des 7 jours en comptent une d'un autre
   lancement.
   ============================================================ */

import { ApiError } from '../api.js';
import { SESSIONS, isoDaysAgo } from './donnees.js';

const STATUTS = ['nouveau', 'lu', 'inscrit', 'clos'];
const MOTIF_REF = /^R-\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALIDITE_S = 3600;

function capture() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">' +
    '<rect width="390" height="844" fill="#FAF6EE"/><rect x="24" y="24" width="342" height="796" rx="24" fill="none" stroke="#D6CDB9" stroke-width="3"/>' +
    '<text x="195" y="410" font-family="Georgia,serif" font-size="24" fill="#3D2E1F" text-anchor="middle">Capture factice</text>' +
    '<text x="195" y="446" font-family="Georgia,serif" font-size="15" fill="#7A6952" text-anchor="middle">Aristocles — mode démo</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const instant = (joursAvant, heure) => new Date(isoDaysAgo(joursAvant) + 'T' + heure + ':00').toISOString();
const decaler = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60000).toISOString();

function graines() {
  // Une séance de Lina (c1), de dictée de préférence.
  const seance = SESSIONS.find((s) => s.childId === 'c1' && s.mode === 'dictee') || SESSIONS.find((s) => s.childId === 'c1');
  const t1 = decaler(seance.startedAt, 12);
  return [
    {
      id: 'ret-01', parent_id: 'p-0001', parent_email: 'famille.moreau@example.org',
      enfant: { child_id: 'c1', prenom: 'Lina', classe: 'CM1' },
      categorie: 'bug', ou: 'dictee', saisie: 'mixte', prises_voix: 2,
      app: { version: '1.4.0', build: 212, plateforme: 'ios', env: 'prod' },
      statut: 'nouveau', ref_registre: null, a_capture: true, capture_purgee: false,
      session_id: seance.id, seance,
      lancement_id: 'lan-01', client_ts: t1, cree_le: decaler(t1, 0.1),
      appareil: { modele: 'iPad (9e génération)', systeme: 'iPadOS 18.1', orientation: 'paysage' },
      texte: "Quand ma fille tourne la tablette pendant la dictée, l'écran devient noir et le bouton du micro disparaît.\nElle a dû recommencer la dictée depuis le début.",
    },
    {
      id: 'ret-02', parent_id: 'p-0004', parent_email: 'n.rossi@example.org', enfant: null,
      categorie: 'idee', ou: 'espace_parent', saisie: 'texte', prises_voix: 0,
      app: { version: '1.4.0', build: 212, plateforme: 'android', env: 'prod' },
      statut: 'lu', ref_registre: null, a_capture: false, capture_purgee: false,
      session_id: null, seance: null, lancement_id: 'lan-02',
      client_ts: instant(2, '20:15'), cree_le: instant(2, '20:15'),
      appareil: { modele: 'Pixel 7', systeme: 'Android 15' },
      texte: "Ce serait bien de recevoir le bilan de la semaine le dimanche soir plutôt que le lundi.",
    },
    {
      id: 'ret-03', parent_id: 'p-0002', parent_email: 'k.benali@example.org',
      enfant: { child_id: 'c2', prenom: 'Maël', classe: 'CM1' },
      categorie: 'bug', ou: 'devoirs', saisie: 'voix', prises_voix: 1,
      app: { version: '1.3.2', build: 205, plateforme: 'ios', env: 'prod' },
      statut: 'inscrit', ref_registre: 'R-0310-photo-floue', a_capture: true, capture_purgee: true,
      session_id: null, seance: null, lancement_id: null,
      client_ts: instant(8, '18:02'), cree_le: instant(8, '18:02'),
      appareil: null,
      texte: "La photo du cahier était floue mais Ari a quand même lu les consignes de travers.",
    },
  ];
}

// Les champs du résumé (§ 2.13), dans l'ordre du contrat.
const CHAMPS_RESUME = ['id', 'cree_le', 'parent_id', 'parent_email', 'enfant', 'categorie', 'ou', 'saisie', 'app', 'statut', 'ref_registre', 'a_capture', 'session_id'];

function resume(r) {
  return Object.fromEntries(CHAMPS_RESUME.map((k) => [k, r[k]]));
}

const extrait = (t) => {
  const c = Array.from(t.replace(/\s+/g, ' ').trim());
  return c.length > 80 ? c.slice(0, 80).join('') + '…' : c.join('');
};

function fiche(r) {
  const lignes = [
    '--- début ---',
    'Inscris ce retour parent au registre docs/revues/retours-testeurs-beta.md',
    '(fiche factice du mode démo)',
    '',
    '### Retour in-app ' + r.id,
    '- Remonté par : ' + (r.enfant ? 'parent de ' + r.enfant.prenom + ' (' + r.enfant.classe + ')' : 'un parent (aucun enfant en particulier)'),
    '- Catégorie : ' + (r.categorie || 'non précisée') + ' · Où : ' + (r.ou || 'non précisé'),
    '- Texte :',
    ...r.texte.replace(/\r\n?/g, '\n').split('\n').map((l) => (l ? '  > ' + l : '  >')),
    '--- fin ---',
  ];
  return lignes.join('\n');
}

function fil(r) {
  if (!r.lancement_id) return [];
  const t = r.client_ts;
  const ev = (seq, minutes, type, ecran, detail = null) => ({
    seq, client_ts: decaler(t, minutes), type_evenement: type, ecran, detail, apres_retour: minutes > 0,
  });
  return r.id === 'ret-01'
    ? [ev(1, -12, 'ecran_vu', 'accueil'), ev(2, -10, 'ecran_vu', 'dictee'), ev(3, -1, 'erreur_client', 'dictee', { code: 'rotation' }), ev(4, 1, 'ecran_vu', 'votre_avis')]
    : [ev(1, -3, 'ecran_vu', 'espace_parent'), ev(2, 1, 'ecran_vu', 'votre_avis')];
}

function erreurs(r) {
  if (r.id !== 'ret-01') return [];
  return [
    { client_ts: decaler(r.client_ts, -1), ecran: 'dictee', detail: { code: 'rotation' }, app_build: 212, lancement_id: 'lan-01', meme_lancement: true },
    { client_ts: decaler(r.client_ts, -3 * 24 * 60), ecran: 'accueil', detail: null, app_build: 212, lancement_id: 'lan-00', meme_lancement: false },
  ];
}

export function creerRetoursMock() {
  const retours = graines();
  const trouver = (id) => retours.find((r) => r.id === id);

  return {
    retours(params = {}) {
      if (params.statut != null && !STATUTS.includes(params.statut)) {
        throw new ApiError("'statut' must be one of 'nouveau', 'lu', 'inscrit', 'clos'", 400);
      }
      const dans = retours.filter((r) => (!params.from || r.cree_le >= params.from) && (!params.to || r.cree_le <= params.to))
        .sort((a, b) => b.cree_le.localeCompare(a.cree_le));
      const compteurs = { nouveau: 0, lu: 0, inscrit: 0, clos: 0 };
      for (const r of dans) compteurs[r.statut]++;
      return {
        from: params.from || instant(92, '00:00'),
        to: params.to || new Date().toISOString(),
        statut: params.statut || null,
        compteurs,
        retours: dans.filter((r) => !params.statut || r.statut === params.statut).map((r) => ({ ...resume(r), extrait: extrait(r.texte) })),
      };
    },

    retour(params = {}) {
      const r = trouver(params.retour_id);
      if (!r) return undefined; // → 404
      const etat = !r.a_capture ? 'absente' : r.capture_purgee ? 'purgee' : 'ok';
      return {
        retour: { ...resume(r), texte: r.texte, prises_voix: r.prises_voix, lancement_id: r.lancement_id, client_ts: r.client_ts, appareil: r.appareil },
        seance: r.seance ? { session_id: r.seance.id, debut: r.seance.startedAt, mode: r.seance.mode, theme: r.seance.theme || null } : null,
        capture: {
          etat,
          url: etat === 'ok' ? capture() : null,
          expire_le: etat === 'ok' ? new Date(Date.now() + VALIDITE_S * 1000).toISOString() : null,
          validite_s: VALIDITE_S,
        },
        fil: fil(r),
        fil_tronque: false,
        erreurs_7j: erreurs(r),
        erreurs_tronque: false,
        fiche: fiche(r),
      };
    },

    retour_statut(params = {}) {
      if (!STATUTS.includes(params.statut)) {
        throw new ApiError("'statut' must be one of 'nouveau', 'lu', 'inscrit', 'clos'", 400);
      }
      let ref;
      if (params.ref_registre === null) ref = null;
      else if (params.ref_registre !== undefined) {
        ref = String(params.ref_registre).trim();
        if (ref.length > 60 || !MOTIF_REF.test(ref)) throw new ApiError("'ref_registre' must be null or match R-JJMM-sujet", 400);
      }
      const r = trouver(params.retour_id);
      if (!r) return undefined;
      r.statut = params.statut;
      if (ref !== undefined) r.ref_registre = ref;
      return { id: r.id, statut: r.statut, ref_registre: r.ref_registre };
    },
  };
}
