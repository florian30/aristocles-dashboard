/* Mock de l'action `tour` (§ 2.9) : trace des répliques d'Ari de mock/fil.js,
   purgée (`trace: null`) pour les séances d'au moins 7 jours. */

import { tourBrut } from './fil.js';

export function tour(params = {}) {
  return tourBrut(params.llm_generation_id);
}
