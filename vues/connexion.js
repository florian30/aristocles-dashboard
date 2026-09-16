/* ============================================================
   Connexion — e-mail + mot de passe, environnement visible et
   modifiable. Le mot de passe ne quitte le champ que pour
   supabase-js ; l'app ne le conserve nulle part.
   ============================================================ */

import { ENVS } from '../config.js';
import { construireHash } from '../router.js';
import { el, lien } from '../ui/dom.js';

// surConnexion(email, motDePasse) → message d'erreur ou null.
export function rendre({ route, mock, message, surConnexion }) {
  const ecran = el('div', 'login-screen');
  const form = el('form', 'login-form');
  form.noValidate = true;

  const tete = el('div', 'login-head');
  tete.append(el('div', 'wordmark login-wordmark', 'Aristocles'), el('div', 'eyebrow', 'Tableau de bord · outil interne'));
  form.append(tete);

  const envs = el('div', 'login-field');
  envs.append(el('span', 'login-label', 'Environnement'), selecteurEnv(route));
  form.append(envs);

  const champ = (id, libelle, type, autocomplete) => {
    const bloc = el('div', 'login-field');
    const label = el('label', 'login-label', libelle);
    label.htmlFor = id;
    const input = el('input');
    Object.assign(input, { id, type, autocomplete, required: true });
    bloc.append(label, input);
    form.append(bloc);
    return input;
  };
  const email = champ('email', 'E-mail', 'email', 'username');
  const motDePasse = champ('mot-de-passe', 'Mot de passe', 'password', 'current-password');

  const erreur = el('div', 'login-error', message || '');
  erreur.setAttribute('role', 'alert');
  erreur.hidden = !message;
  const bouton = el('button', 'login-submit', 'Se connecter à ' + route.env);
  bouton.type = 'submit';
  form.append(erreur, bouton);

  if (mock) {
    form.append(el('p', 'login-hint',
      'Mode démo : aucun réseau, tout e-mail et mot de passe sont acceptés. ' +
      'Un e-mail commençant par « refuse » simule un compte non autorisé.'));
  }

  const effacer = () => { erreur.hidden = true; };
  email.addEventListener('input', effacer);
  motDePasse.addEventListener('input', effacer);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!email.value.trim() || !motDePasse.value) {
      erreur.textContent = 'Saisissez l’e-mail et le mot de passe.';
      erreur.hidden = false;
      return;
    }
    bouton.disabled = true;
    bouton.textContent = 'Connexion…';
    const echec = await surConnexion(email.value.trim(), motDePasse.value);
    if (!ecran.isConnected) return; // navigation déjà faite
    motDePasse.value = '';
    bouton.disabled = false;
    bouton.textContent = 'Se connecter à ' + route.env;
    if (echec) {
      erreur.textContent = echec;
      erreur.hidden = false;
    }
  });

  ecran.append(form);
  queueMicrotask(() => email.focus());
  return ecran;
}

// Bascule prod/dev : même écran dans l'autre env, sans les
// identifiants (une séance de prod n'existe pas en dev).
export function selecteurEnv(route) {
  const { sessionId: _s, generationId: _g, childId: _c, ...ecran } = route;
  const groupe = el('div', 'env-switch');
  groupe.setAttribute('role', 'group');
  groupe.setAttribute('aria-label', 'Environnement');
  for (const env of Object.keys(ENVS)) {
    const actif = env === route.env;
    const a = lien(construireHash({ ...ecran, env }), 'env-option is-' + env + (actif ? ' is-active' : ''), ENVS[env].label);
    if (actif) a.setAttribute('aria-current', 'true');
    groupe.append(a);
  }
  return groupe;
}
