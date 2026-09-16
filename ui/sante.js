/* ============================================================
   Aristocles — Mise en forme santé technique (pure)
   Latences, taux d'échec, regroupement des versions d'app,
   résumé des incidents. Utilisé par La veille et Santé & coûts.
   ============================================================ */

import { fmtEntier } from './format.js';
import { LIBELLE_PLATEFORME } from './libelles.js';
import { LIBELLE_UNITE, fmtVolume } from './unites.js';

// 850 → « 850 ms » ; 1400 → « 1,4 s » ; null → « — ».
export function fmtLatence(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return Math.round(ms) + ' ms';
  const s = ms / 1000;
  return s.toLocaleString('fr-FR', { maximumFractionDigits: s < 10 ? 1 : 0 }) + ' s';
}

// « 2 / 40 (5 %) » ; « 0 » sans échec.
export function fmtEchecs(echecs, appels) {
  if (!echecs) return '0';
  if (!appels) return fmtEntier(echecs);
  const pct = (echecs / appels) * 100;
  return fmtEntier(echecs) + ' (' + pct.toLocaleString('fr-FR', { maximumFractionDigits: pct < 10 ? 1 : 0 }) + ' %)';
}

export function libelleUnite(unite) {
  return LIBELLE_UNITE[unite] || unite || 'tokens';
}

// Volumes d'un rôle IA dans son unité : entrée / sortie en tokens pour
// un rôle au token, volume unique sinon (secondes d'audio, caractères).
export function volumesIa(r) {
  if (r.unite === 'token' || r.unite == null) {
    return { entree: fmtVolume(r.volumeEntree, 'token'), sortie: fmtVolume(r.volumeSortie, 'token') };
  }
  return { entree: fmtVolume(r.volumeEntree, r.unite), sortie: '—' };
}

export function libellePlateforme(p) {
  return LIBELLE_PLATEFORME[p] || p || '?';
}

// Lignes (version, build, plateforme) → une entrée par version d'app,
// plateformes et builds rassemblés, lancements additionnés, dernier vu max.
// Les enfants ne s'additionnent pas (un enfant peut changer de plateforme) :
// on garde le maximum par ligne, borne basse honnête.
export function regrouperVersions(versions) {
  const parVersion = new Map();
  for (const v of versions) {
    const cle = v.version || '?';
    const g = parVersion.get(cle) || { version: cle, builds: new Set(), plateformes: new Set(), lancements: 0, enfantsMin: 0, dernierVu: null };
    if (v.build != null) g.builds.add(v.build);
    g.plateformes.add(libellePlateforme(v.plateforme));
    g.lancements += v.lancements || 0;
    g.enfantsMin = Math.max(g.enfantsMin, v.enfants || 0);
    if (v.dernierVu && (!g.dernierVu || v.dernierVu > g.dernierVu)) g.dernierVu = v.dernierVu;
    parVersion.set(cle, g);
  }
  return [...parVersion.values()]
    .map((g) => ({ ...g, builds: [...g.builds].sort((a, b) => a - b), plateformes: [...g.plateformes].sort() }))
    .sort((a, b) => b.lancements - a.lancements || b.version.localeCompare(a.version));
}

// Plateformes vues : [{ plateforme, lancements }] triées.
export function totauxPlateformes(versions) {
  const t = new Map();
  for (const v of versions) {
    const cle = libellePlateforme(v.plateforme);
    t.set(cle, (t.get(cle) || 0) + (v.lancements || 0));
  }
  return [...t.entries()].map(([plateforme, lancements]) => ({ plateforme, lancements }))
    .sort((a, b) => b.lancements - a.lancements || a.plateforme.localeCompare(b.plateforme));
}

export function totalIncidents(incidents) {
  return (incidents?.parType || []).reduce((acc, t) => acc + (t.nb || 0), 0);
}

export function totalErreurs(erreurs) {
  return (erreurs || []).reduce((acc, e) => acc + (e.nb || 0), 0);
}
