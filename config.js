/* ============================================================
   Aristocles — Configuration des environnements
   Seules les clés anon (publiques par construction : elles
   partent dans chaque requête du navigateur) figurent ici.
   JAMAIS de clé service_role / sb_secret dans ce dépôt public.
   ============================================================ */

export const ENVS = {
  prod: {
    label: 'prod',
    url: 'https://ngbqqewpkcugdwajpbff.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nYnFxZXdwa2N1Z2R3YWpwYmZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTQ4NDEsImV4cCI6MjA5NDY5MDg0MX0.McQ5gijQ4L_2y_eLnB7jn4w7mUzADTHIz2_Kb995U7s',
  },
  dev: {
    label: 'dev',
    url: 'https://mtuqpdtihltuuyemdyni.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10dXFwZHRpaGx0dXV5ZW1keW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMTYyOTksImV4cCI6MjEwNDg5MjI5OX0.cZCRZbvjiuyVym09P2xB6A3wuGP1UbmPppABvAsW4AE',
  },
};

export const ENV_PAR_DEFAUT = 'prod';

export function estEnvValide(env) {
  return Object.prototype.hasOwnProperty.call(ENVS, env);
}

// Durée de vie du cache mémoire des réponses de l'Edge.
export const CACHE_TTL_MS = 5 * 60 * 1000;

// supabase-js v2, version épinglée (ESM servi par jsdelivr).
export const SUPABASE_JS_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

// Mode démo : `?mock=1` dans la query (hors hash) → aucun réseau.
export function estModeMock(search) {
  return /[?&]mock=1(&|$)/.test(search || '');
}

export function urlDashboard(env) {
  return ENVS[env].url + '/functions/v1/dashboard';
}
