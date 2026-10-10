/* ============================================================
   Aristocles — Routeur par hash
   #/{env}/veille/{date}
   #/{env}/apercu
   #/{env}/familles            #/{env}/familles/{child_id}
   #/{env}/seances             #/{env}/seances/{session_id}
   #/{env}/seances/{session_id}/tour/{llm_generation_id}  (trace IA)
   #/{env}/sante
   #/{env}/incidents          (veille de la prod, action `veille`)
   #/{env}/messages           (?onglet=app : messages dans l'app ;
                               sans onglet : notifications)
   Une query optionnelle (`?from=…&to=…&child=…`) porte les filtres
   des écrans de liste, pour qu'un rafraîchissement les conserve.

   analyserHash / construireHash sont pures (testées sous Deno) ;
   seul ecouterHash touche à `window`.
   ============================================================ */

import { ENV_PAR_DEFAUT, estEnvValide } from './config.js';
import { estDateCivile } from './ui/paris.js';

export const VUES = ['veille', 'apercu', 'familles', 'seances', 'sante', 'incidents', 'messages'];

// Route : { env, vue, date?, childId?, sessionId?, generationId?, query }
// `canonique` vaut false quand le hash d'origine doit être réécrit
// (env inconnu, vue inconnue, segments superflus…).
export function analyserHash(hash) {
  const brut = String(hash || '').replace(/^#/, '');
  const [chemin, chaineQuery = ''] = brut.split('?');
  const segments = chemin.split('/').filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(chaineQuery));

  let [env, vue, a, b, c] = segments;
  if (!estEnvValide(env)) {
    return { env: ENV_PAR_DEFAUT, vue: 'veille', date: null, query: {}, canonique: false };
  }
  if (!VUES.includes(vue)) {
    return { env, vue: 'veille', date: null, query: {}, canonique: false };
  }

  const route = { env, vue, query };
  let attendus = 2;
  if (vue === 'veille') {
    // Une date inexistante (2026-02-30) est rejetée comme une date mal
    // formée : route non canonique, main.js ramène à hier.
    route.date = estDateCivile(a) ? a : null;
    if (route.date) attendus = 3;
  } else if (vue === 'familles') {
    route.childId = a || null;
    if (a) attendus = 3;
  } else if (vue === 'seances') {
    route.sessionId = a || null;
    route.generationId = a && b === 'tour' && c ? c : null;
    attendus = route.generationId ? 5 : a ? 3 : 2;
  }
  route.canonique = segments.length === attendus;
  return route;
}

export function construireHash(route) {
  const env = estEnvValide(route.env) ? route.env : ENV_PAR_DEFAUT;
  const vue = VUES.includes(route.vue) ? route.vue : 'veille';
  const segments = [env, vue];
  if (vue === 'veille' && route.date) segments.push(route.date);
  if (vue === 'familles' && route.childId) segments.push(route.childId);
  if (vue === 'seances' && route.sessionId) {
    segments.push(route.sessionId);
    if (route.generationId) segments.push('tour', route.generationId);
  }
  let hash = '#/' + segments.map(encodeURIComponent).join('/');
  const query = Object.entries(route.query || {}).filter(([, v]) => v != null && v !== '');
  if (query.length) hash += '?' + new URLSearchParams(query).toString();
  return hash;
}

// Appelle `rappel(route)` au démarrage puis à chaque changement de hash.
export function ecouterHash(rappel) {
  const traiter = () => rappel(analyserHash(window.location.hash));
  window.addEventListener('hashchange', traiter);
  traiter();
}

export function naviguer(route, { remplacer = false } = {}) {
  const hash = construireHash(route);
  if (remplacer) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (window.location.hash !== hash) {
    window.location.hash = hash;
  } else {
    window.dispatchEvent(new HashChangeEvent('hashchange')); // même écran : on le recharge
  }
}
