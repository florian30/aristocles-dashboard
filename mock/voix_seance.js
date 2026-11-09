/* ============================================================
   Mock de l'action `voix_seance` (STOCKAGE-AUDIO-STT lot 2, contrat
   v2.9 § 2.16) : prises de voix d'une séance, dans l'ordre du temps.
   Chaque tour `message_enfant_vocal` a sa prise (2 s après le tour,
   comme le dépôt en arrière-plan), sauf : la 1re est purgée (objet
   retiré, `url: null`), la dernière d'une séance qui en a au moins
   trois a perdu sa ligne (`tours_effaces`). Une prise filtrée
   (silence, sans texte ni tour) suit le 1er tour vocal. Séance
   inconnue → 404, séance sans tour vocal → listes vides. L'audio est
   un WAV muet factice en data: (aucune voix réelle).
   ============================================================ */

import { SESSIONS } from './donnees.js';
import { interactionsEcran } from './fil.js';

const VALIDITE_S = 3600;

// 0,2 s de silence, 8 kHz mono 8 bits.
function wavMuet() {
  const n = 1600;
  const octets = new Uint8Array(44 + n);
  const v = new DataView(octets.buffer);
  const ascii = (o, t) => [...t].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
  ascii(0, 'RIFF'); v.setUint32(4, 36 + n, true); ascii(8, 'WAVE');
  ascii(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  ascii(36, 'data'); v.setUint32(40, n, true);
  octets.fill(128, 44);
  let bin = '';
  for (const b of octets) bin += String.fromCharCode(b);
  return 'data:audio/wav;base64,' + btoa(bin);
}
const AUDIO = wavMuet();

const plus = (iso, s) => new Date(Date.parse(iso) + s * 1000).toISOString();

export function voix_seance(params = {}) {
  const s = SESSIONS.find((x) => x.id === params.session_id);
  if (!s) return undefined;
  const vocaux = s.ecrans.flatMap((e) => interactionsEcran(s, e.position))
    .filter((i) => i.type === 'message_enfant_vocal')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const effaces = vocaux.length >= 3 ? [vocaux[vocaux.length - 1].id] : [];
  const prises = [];
  vocaux.forEach((i, k) => {
    if (effaces.includes(i.id)) return;
    const purgee = k === 0;
    prises.push({
      interaction_id: i.id, filtre: 'aucun', transcription: i.contenu_texte, duree_s: 1.5 + (k % 3),
      prise_le: plus(i.created_at, 2), etat: purgee ? 'purgee' : 'ok', url: purgee ? null : AUDIO,
    });
    if (k === 0) {
      prises.push({
        interaction_id: null, filtre: 'silence', transcription: '', duree_s: 0.6,
        prise_le: plus(i.created_at, 6), etat: 'ok', url: AUDIO,
      });
    }
  });
  return {
    session_id: s.id,
    validite_s: VALIDITE_S,
    expire_le: new Date(Date.now() + VALIDITE_S * 1000).toISOString(),
    prises: prises.sort((a, b) => a.prise_le.localeCompare(b.prise_le)).map((p, k) => ({ rang: k + 1, ...p })),
    tours_effaces: effaces,
  };
}
