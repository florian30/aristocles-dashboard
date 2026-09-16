/* ============================================================
   Aristocles — Transport factice (`?mock=1`) : aucun réseau.
   Même signature que api.js transportHttp. Un léger délai rend
   visibles l'indicateur de chargement et l'annulation.
   estAutorise(env) : false simule un 403 (compte non autorisé).
   ============================================================ */

import { ApiError } from '../api.js';
import { apercu } from './apercu.js';
import { journee } from './journee.js';
import { sante } from './sante.js';
import { stats } from './stats.js';
import { session } from './session.js';
import { session_detail } from './session_detail.js';

const ACTIONS = { stats, session, session_detail, journee, apercu, sante };

function attendre(ms, signal) {
  return new Promise((resoudre, rejeter) => {
    if (signal && signal.aborted) return rejeter(new DOMException('Requête annulée', 'AbortError'));
    const t = setTimeout(resoudre, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      rejeter(new DOMException('Requête annulée', 'AbortError'));
    }, { once: true });
  });
}

export function transportMock({ estConnecte, estAutorise, delaiMs = 250 }) {
  return async (env, action, params = {}, { signal } = {}) => {
    await attendre(delaiMs, signal);
    if (!estConnecte(env)) throw new ApiError('Jeton absent ou invalide.', 401);
    if (!estAutorise(env)) throw new ApiError('Compte non autorisé.', 403);
    const handler = ACTIONS[action];
    if (!handler) throw new ApiError('Action inconnue : ' + action, 400);
    const donnees = handler(params);
    if (donnees === undefined) throw new ApiError('Séance introuvable.', 404);
    return donnees;
  };
}
