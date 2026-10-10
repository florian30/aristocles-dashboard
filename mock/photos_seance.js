/* ============================================================
   Mock de l'action `photos_seance` (DASH-3) : URLs signées en lot
   des photos d'une séance, dans l'ordre de prise de vue. La 1re
   photo de devoirs est suivie de sa version redressée ; la photo
   purgée garde sa place avec `url: null`. Une séance de dictée a une
   photo de copie (source 'dictee'). Séance inconnue → 404, séance
   sans photo → `photos: []`. Les URLs sont des SVG en data:.
   ============================================================ */

import { SESSIONS } from './donnees.js';
import { dicteeBrute, etatPhoto, photosSeance } from './fil.js';

const VALIDITE_S = 3600;

function image(titre, sousTitre) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">' +
    '<rect width="480" height="320" fill="#FAF6EE"/><rect x="24" y="24" width="432" height="272" rx="12" fill="none" stroke="#D6CDB9" stroke-width="3"/>' +
    '<text x="240" y="150" font-family="Georgia,serif" font-size="26" fill="#3D2E1F" text-anchor="middle">' + titre + '</text>' +
    '<text x="240" y="190" font-family="Georgia,serif" font-size="16" fill="#7A6952" text-anchor="middle">' + sousTitre + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function photos_seance(params = {}) {
  const s = SESSIONS.find((x) => x.id === params.session_id);
  if (!s) return undefined;
  const devoirs = photosSeance(s).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const photos = [];
  devoirs.forEach((p, k) => {
    const purgee = etatPhoto(p.interaction_id).purgee;
    const base = { source: 'devoirs', ecran_id: p.ecran_id, interaction_id: p.interaction_id, dictee_id: null, prise_le: p.created_at };
    photos.push({ ...base, redressee: false, etat: purgee ? 'purgee' : 'ok', url: purgee ? null : image('Photo de devoir factice', 'Aristocles — mode démo') });
    if (k === 0 && !purgee) {
      photos.push({ ...base, redressee: true, etat: 'ok', url: image('Photo redressée factice', 'Aristocles — mode démo') });
    }
  });
  const dictee = s.dictee ? dicteeBrute(s) : null;
  if (dictee) {
    photos.push({
      source: 'dictee', ecran_id: dictee.ecran_id, interaction_id: null, dictee_id: dictee.id,
      redressee: false, prise_le: dictee.created_at, etat: 'ok', url: image('Copie de dictée factice', 'Aristocles — mode démo'),
    });
  }
  return {
    session_id: s.id,
    validite_s: VALIDITE_S,
    expire_le: new Date(Date.now() + VALIDITE_S * 1000).toISOString(),
    photos: photos.map((p, i) => ({ rang: i + 1, ...p })),
  };
}
