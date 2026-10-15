/* ============================================================
   Aristocles — Filtres Enfant et Mode de la page Séances (pur)
   L'Edge renvoie toute la plage d'un coup (pas de pagination) :
   l'enfant part au serveur (`child_id`, garde le compteur sans
   échange juste), le mode se filtre ici. Les valeurs proposées
   sont celles présentes dans les séances de la plage.
   ============================================================ */

import { LIBELLE_MODE } from './libelles.js';

const ORDRE_MODES = Object.keys(LIBELLE_MODE);

// Mode choisi dans la query (`mode=devoirs|entrainement|dictee`), ou null.
export const modeDepuisQuery = (query = {}) => query.mode || null;

export function filtrerParMode(seances, mode) {
  return mode ? seances.filter((s) => s.mode === mode) : seances;
}

// Enfants présents dans les séances → [{ childId, name }] par prénom.
// L'enfant choisi reste proposé même sans séance sur la plage.
export function optionsEnfants(seances, childChoisi = null) {
  const parId = new Map();
  for (const s of seances) if (s.childId && !parId.has(s.childId)) parId.set(s.childId, s.childName || s.childId);
  if (childChoisi && !parId.has(childChoisi)) parId.set(childChoisi, 'Enfant choisi');
  return [...parId].map(([childId, name]) => ({ childId, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

// Modes présents → [{ mode, libelle }] dans l'ordre des libellés.
// Le mode choisi reste proposé même s'il n'a aucune séance.
export function optionsModes(seances, modeChoisi = null) {
  const presents = new Set(seances.map((s) => s.mode).filter(Boolean));
  if (modeChoisi) presents.add(modeChoisi);
  const rang = (m) => (ORDRE_MODES.includes(m) ? ORDRE_MODES.indexOf(m) : ORDRE_MODES.length);
  return [...presents].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b))
    .map((mode) => ({ mode, libelle: LIBELLE_MODE[mode] || mode }));
}

// Un filtre s'écarte du défaut (7 jours, tous les enfants, tous les modes).
export function filtresActifs(query = {}) {
  return Boolean(query.child || query.mode || query.from || query.to || (query.periode && query.periode !== '7j'));
}

// Query remise au défaut ; garde ce qui n'est pas un filtre (sans_echange…).
export function queryReinitialisee(query = {}) {
  const { periode: _p, from: _f, to: _t, child: _c, mode: _m, ...reste } = query;
  return reste;
}
