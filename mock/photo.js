/* ============================================================
   Mock de l'action `photo` (§ 2.10). Aucune vraie photo : l'URL
   est une petite image SVG en data: (le navigateur l'enregistre
   sous `nom_fichier`). La seconde photo de chaque séance de devoirs
   est purgée → 404 `photo_purgee`, comme l'Edge.
   ============================================================ */

import { ApiError } from '../api.js';
import { etatPhoto } from './fil.js';

const IMAGE = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">' +
  '<rect width="480" height="320" fill="#FAF6EE"/><rect x="24" y="24" width="432" height="272" rx="12" fill="none" stroke="#D6CDB9" stroke-width="3"/>' +
  '<text x="240" y="150" font-family="Georgia,serif" font-size="26" fill="#3D2E1F" text-anchor="middle">Photo de devoir factice</text>' +
  '<text x="240" y="190" font-family="Georgia,serif" font-size="16" fill="#7A6952" text-anchor="middle">Aristocles — mode démo</text></svg>';

export function photo(params = {}) {
  const etat = etatPhoto(params.interaction_id);
  if (!etat) throw new ApiError('Unknown interaction_id', 404);
  if (etat.purgee) throw new ApiError('photo_purgee', 404);
  return {
    url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(IMAGE),
    expire_le: new Date(Date.now() + 5 * 60000).toISOString(),
    nom_fichier: 'devoir_' + etat.jour + '_' + String(params.interaction_id).replace(/-/g, '').slice(0, 8) + '.svg',
  };
}
