/* ============================================================
   Aristocles — Transport factice (`?mock=1`) : aucun réseau.
   Même signature que api.js transportHttp. Un léger délai rend
   visibles l'indicateur de chargement et l'annulation.
   estAutorise(env) : false simule un 403 (compte non autorisé).
   ============================================================ */

import { ApiError } from '../api.js';
import { apercu } from './apercu.js';
import { creerConsoleMock } from './console.js';
import { enfant, enfants } from './familles.js';
import { journee } from './journee.js';
import { photo } from './photo.js';
import { sante } from './sante.js';
import { session } from './session.js';
import { session_detail } from './session_detail.js';
import { tour } from './tour.js';
import { veille } from './veille.js';

// `stats` n'existe plus côté front : une action inconnue répond 400.
const ACTIONS = { session, session_detail, journee, apercu, sante, enfants, enfant, tour, photo, veille };

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

// L'Edge `notifs_console` factice a un état (campagnes, messages) : un
// par transport, donc par chargement de la page.
export function transportMock({ estConnecte, estAutorise, delaiMs = 250, console: consoleMock = creerConsoleMock() }) {
  return async (env, action, params = {}, { signal, edge = 'dashboard' } = {}) => {
    await attendre(delaiMs, signal);
    if (!estConnecte(env)) throw new ApiError('Jeton absent ou invalide.', 401);
    if (!estAutorise(env)) throw new ApiError('Compte non autorisé.', 403);
    const table = edge === 'notifs_console' ? consoleMock : ACTIONS;
    const handler = Object.hasOwn(table, action) ? table[action] : null;
    if (!handler) throw new ApiError('Action inconnue : ' + action, 400);
    const donnees = handler(params); // un handler peut lever sa propre ApiError
    if (donnees === undefined) throw new ApiError('Introuvable.', 404);
    return donnees;
  };
}
