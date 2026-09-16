/* ============================================================
   Aristocles — Jours civils Europe/Paris (fonctions pures)
   Le contrat Edge raisonne en jour civil de Paris : « hier »,
   les bornes de plage et les heures affichées suivent Paris,
   quel que soit le fuseau de la machine qui ouvre le dashboard.
   ============================================================ */

const FUSEAU = 'Europe/Paris';
const JOUR_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n) => String(n).padStart(2, '0');

const formateurParties = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSEAU,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
});

function partiesParis(instant) {
  const p = Object.fromEntries(formateurParties.formatToParts(instant).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

export function estDateCivile(s) {
  const m = DATE_RE.exec(s || '');
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// 'AAAA-MM-JJ' du jour civil de Paris contenant l'instant.
export function jourParis(instant = new Date()) {
  const p = partiesParis(new Date(instant));
  return p.y + '-' + pad2(p.m) + '-' + pad2(p.d);
}

// Jour civil décalé de n jours (arithmétique de calendrier, sans fuseau).
export function decalerJour(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const r = new Date(Date.UTC(y, m - 1, d + n));
  return r.getUTCFullYear() + '-' + pad2(r.getUTCMonth() + 1) + '-' + pad2(r.getUTCDate());
}

export function aujourdhuiParis(maintenant = new Date()) {
  return jourParis(maintenant);
}

export function hierParis(maintenant = new Date()) {
  return decalerJour(jourParis(maintenant), -1);
}

// Nombre de jours civils de `a` à `b` (b − a).
export function ecartJours(a, b) {
  const t = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / JOUR_MS);
}

// Instant UTC (ms) de minuit à Paris pour un jour civil.
export function debutJourParisMs(date) {
  const [y, m, d] = date.split('-').map(Number);
  const mur = Date.UTC(y, m - 1, d);
  let instant = mur;
  // Deux passes : le décalage de Paris dépend de l'instant (heure d'été).
  for (let i = 0; i < 2; i++) {
    const p = partiesParis(new Date(instant));
    const murVu = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    instant = instant + (mur - murVu);
  }
  return instant;
}

export const PLAFOND_JOURS = 92;

// Plage de jours civils inclusifs → bornes ISO UTC pour l'Edge
// (bornes incluses, to − from ≤ 92 jours exactement, même quand un
// retour à l'heure d'hiver allonge la plage d'une heure).
export function bornesParis(from, to) {
  const debut = debutJourParisMs(from);
  const fin = Math.min(debutJourParisMs(decalerJour(to, 1)) - 1, debut + PLAFOND_JOURS * JOUR_MS);
  return { from: new Date(debut).toISOString(), to: new Date(fin).toISOString() };
}

export function heureParis(iso) {
  if (!iso) return null;
  const p = partiesParis(new Date(iso));
  return pad2(p.h) + ':' + pad2(p.min);
}

// « mardi 15 septembre » (année ajoutée si ce n'est pas l'année en cours).
export function fmtJourTitre(date, maintenant = new Date()) {
  const [y, m, d] = date.split('-').map(Number);
  const options = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' };
  if (String(y) !== jourParis(maintenant).slice(0, 4)) options.year = 'numeric';
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('fr-FR', options);
}

// « 15 sept. » pour les axes et listes compactes.
export function fmtJourCourt(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// « 15 sept. · 17:42 » (heure de Paris).
export function fmtInstantParis(iso) {
  if (!iso) return '—';
  return fmtJourCourt(jourParis(new Date(iso))) + ' · ' + heureParis(iso);
}

// Navigation de La veille : jours voisins ; pas de « suivant » au-delà d'aujourd'hui.
export function navigationJour(date, maintenant = new Date()) {
  const aujourdhui = aujourdhuiParis(maintenant);
  const suivant = decalerJour(date, 1);
  return {
    precedent: decalerJour(date, -1),
    suivant: suivant <= aujourdhui ? suivant : null,
    aujourdhui,
    hier: hierParis(maintenant),
    estFutur: date > aujourdhui,
  };
}
