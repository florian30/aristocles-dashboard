/* ============================================================
   Aristocles — Formatage (fonctions pures, testées sous Deno)
   ============================================================ */

const pad2 = (n) => String(n).padStart(2, '0');

// 'AAAA-MM-JJ' du jour local, décalé de `n` jours en arrière.
export function isoJoursAvant(n, maintenant = new Date()) {
  const d = new Date(maintenant.getTime());
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function dateLocale(iso) {
  const d = new Date(iso);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function heureLocale(iso) {
  const d = new Date(iso);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

export function enMinutes(secondes) {
  return secondes == null ? null : Math.round(secondes / 60);
}

// Durée en minutes ; null = séance encore ouverte.
export function fmtDuree(min) {
  if (min == null) return 'En cours';
  if (min < 60) return min + ' min';
  return Math.floor(min / 60) + ' h ' + pad2(min % 60);
}

export function fmtDureeSec(sec) {
  if (sec == null) return null;
  sec = Math.round(sec);
  if (sec < 60) return sec + ' s';
  if (sec < 3600) {
    const r = sec % 60;
    return Math.floor(sec / 60) + ' min' + (r ? ' ' + pad2(r) + ' s' : '');
  }
  return Math.floor(sec / 3600) + ' h ' + pad2(Math.floor((sec % 3600) / 60));
}

export function fmtJour(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtJourLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtJourHeure(dateStr, heure) {
  return fmtJour(dateStr) + ' · ' + heure;
}

// Espaces fines insécables de toLocaleString normalisées en espaces
// insécables simples : rendu identique, comparaisons de tests stables.
const normaliserEspaces = (s) => s.replace(/[  ]/g, ' ');

export function fmtEntier(v) {
  return normaliserEspaces(Number(v).toLocaleString('fr-FR'));
}

// Coût en euros. null / undefined = coût inconnu : jamais « 0 € ».
export function fmtEuros(v) {
  if (v == null || Number.isNaN(Number(v))) return 'inconnu';
  return normaliserEspaces(
    Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  ) + ' €';
}

export function pluriel(n, mot, motPluriel) {
  return n + ' ' + (n > 1 ? motPluriel || mot + 's' : mot);
}

// Horodatage à la milliseconde pour la chronologie technique.
export function fmtHorodatagePrecis(iso) {
  const d = new Date(iso);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) +
    '.' + String(d.getMilliseconds()).padStart(3, '0');
}
