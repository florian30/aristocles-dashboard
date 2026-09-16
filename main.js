/* ============================================================
   Aristocles — Point d'entrée : routage, session, chargement.
   Chaque navigation annule la requête précédente (AbortController)
   et un jeton de rendu garantit qu'une réponse périmée n'écrase
   jamais l'écran courant.
   ============================================================ */

import { creerApi, estAnnulation, transportHttp } from './api.js';
import { creerAuth, nettoyerStockageHerite } from './auth.js';
import { estModeMock } from './config.js';
import { transportMock } from './mock/transport.js';
import { construireHash, ecouterHash, naviguer } from './router.js';
import { el, etatChargement, etatErreur, lien } from './ui/dom.js';
import { isoJoursAvant } from './ui/format.js';
import * as vueApercu from './vues/apercu.js';
import * as vueConnexion from './vues/connexion.js';
import * as vueFamilles from './vues/familles.js';
import * as vueSante from './vues/sante.js';
import * as vueSeance from './vues/seance.js';
import * as vueSeances from './vues/seances.js';
import * as vueVeille from './vues/veille.js';

nettoyerStockageHerite();

const MOCK = estModeMock(location.search);
const auth = creerAuth({ mock: MOCK });
const api = creerApi({
  transport: MOCK
    ? transportMock({ estConnecte: auth.estConnecte, estAutorise: auth.estAutorise })
    : transportHttp((env) => auth.jeton(env)),
});

const NAVIGATION = [
  { vue: 'veille', libelle: 'La veille' },
  { vue: 'apercu', libelle: "Vue d'ensemble" },
  { vue: 'familles', libelle: 'Familles' },
  { vue: 'seances', libelle: 'Séances' },
  { vue: 'sante', libelle: 'Santé & coûts' },
];

const racine = document.getElementById('racine');
const bandeauDev = document.getElementById('bandeau-dev');
document.getElementById('bandeau-demo').hidden = !MOCK;

function placerBandeaux() {
  const hauteur = document.getElementById('bandeaux').getBoundingClientRect().height;
  document.body.style.setProperty('--hauteur-bandeaux', hauteur + 'px');
}

let controleur = null;
let numeroRendu = 0;
let ecranCourant = null; // identité de l'écran affiché (vue + identifiants)

function vuePour(route) {
  if (route.vue === 'seances') return route.sessionId ? vueSeance : vueSeances;
  return { veille: vueVeille, apercu: vueApercu, familles: vueFamilles, sante: vueSante }[route.vue];
}

// ---------- Rendu d'une route ----------

async function rendreRoute(route) {
  // Formes non canoniques (env inconnu, veille sans date…) : réécriture.
  if (route.vue === 'veille' && !route.date) {
    naviguer({ ...route, date: isoJoursAvant(1) }, { remplacer: true });
    return;
  }
  if (!route.canonique) {
    naviguer(route, { remplacer: true });
    return;
  }

  controleur?.abort();
  controleur = new AbortController();
  const { signal } = controleur;
  const numero = ++numeroRendu;
  const aJour = () => numero === numeroRendu && !signal.aborted;

  const dev = route.env === 'dev';
  bandeauDev.hidden = !dev;
  placerBandeaux();

  const session = await auth.session(route.env);
  if (!aJour()) return;
  if (!session) {
    afficherConnexion(route);
    return;
  }

  const vue = vuePour(route);
  document.title = vue.titre + ' · ' + route.env + ' · Aristocles';
  const zone = afficherCoque(route, session);

  // Même écran (seuls les filtres changent) : on garde le contenu,
  // grisé, le temps du chargement. Sinon : indicateur seul.
  const identite = [route.env, route.vue, route.sessionId, route.childId, route.generationId].join('|');
  if (identite === ecranCourant && zone.firstChild) {
    zone.classList.add('is-loading');
  } else {
    zone.replaceChildren(etatChargement());
  }
  ecranCourant = identite;

  try {
    const noeud = await vue.rendre({ route, api, signal });
    if (!aJour()) return;
    zone.classList.remove('is-loading');
    zone.replaceChildren(noeud);
  } catch (e) {
    if (!aJour() || estAnnulation(e)) return;
    zone.classList.remove('is-loading');
    ecranCourant = null;
    await gererErreur(e, route, session, zone);
  }
}

async function gererErreur(e, route, session, zone) {
  if (e.status === 401) {
    await auth.deconnexion(route.env);
    afficherConnexion(route, 'Session expirée ou refusée — reconnectez-vous.');
    return;
  }
  // L'état d'erreur remplace toujours les données précédentes.
  if (e.status === 403) {
    zone.replaceChildren(etatErreur(
      'Ce compte n’est pas autorisé sur ' + route.env,
      'Connecté en tant que ' + session.email + '. Déconnectez-vous puis utilisez un compte autorisé sur ' + route.env + '.',
      [boutonDeconnexion(route, 'Se déconnecter')],
    ));
    return;
  }
  const reessayer = el('button', 'bouton', 'Réessayer');
  reessayer.type = 'button';
  reessayer.addEventListener('click', () => {
    api.viderCache(route.env);
    naviguer(route);
  });
  const titre = e.status === 0 ? 'Serveur ' + route.env + ' injoignable' : 'Erreur de chargement';
  const detail = e.status === 0 && location.origin !== 'https://florian30.github.io'
    ? e.message + ' Hors GitHub Pages, l’Edge refuse l’origine (CORS) : utilisez ?mock=1 en local.'
    : e.message + (e.status ? ' (' + e.status + ')' : '');
  zone.replaceChildren(etatErreur(titre, detail, [reessayer]));
}

// ---------- Connexion ----------

function afficherConnexion(route, message) {
  // Tout retour à la connexion (déconnexion, 401, session expirée en
  // silence) vide le cache de l'env : rien ne survit d'un compte à l'autre.
  api.viderCache(route.env);
  ecranCourant = null;
  document.title = 'Connexion · ' + route.env + ' · Aristocles';
  racine.replaceChildren(vueConnexion.rendre({
    route,
    mock: MOCK,
    message,
    surConnexion: async (email, motDePasse) => {
      try {
        await auth.connexion(route.env, email, motDePasse);
      } catch (e) {
        return e.message;
      }
      // Sonde : un compte connecté mais non autorisé est refusé ici,
      // plutôt que de découvrir le 403 plus tard.
      const hier = isoJoursAvant(1);
      try {
        await api.stats(route.env, hier, hier);
      } catch (e) {
        if (e.status === 401 || e.status === 403) {
          await auth.deconnexion(route.env);
          api.viderCache(route.env);
          return e.status === 403
            ? 'Ce compte n’est pas autorisé sur ' + route.env + '.'
            : 'Connexion refusée par le serveur ' + route.env + '.';
        }
        // Autre échec (réseau…) : la session est valide, l'écran le dira.
      }
      naviguer({ env: route.env, vue: 'veille', date: hier });
      return null;
    },
  }));
}

function boutonDeconnexion(route, libelle) {
  const bouton = el('button', 'bouton bouton-discret', libelle);
  bouton.type = 'button';
  bouton.addEventListener('click', async () => {
    await auth.deconnexion(route.env);
    naviguer(route); // → écran de connexion, qui vide le cache
  });
  return bouton;
}

// ---------- Coque (en-tête + zone de contenu) ----------

function afficherCoque(route, session) {
  let coque = racine.querySelector('.app');
  if (!coque) {
    coque = el('div', 'app');
    coque.append(el('header', 'topbar'), el('main', 'contenu'));
    racine.replaceChildren(coque);
  }

  const entete = coque.querySelector('.topbar');
  const marque = lien(construireHash({ env: route.env, vue: 'veille' }), 'topbar-brand');
  marque.append(el('span', 'wordmark', 'Aristocles'));
  if (MOCK) marque.append(el('span', 'chip is-info', 'démo'));

  const nav = el('nav', 'topbar-nav');
  nav.setAttribute('aria-label', 'Sections');
  for (const item of NAVIGATION) {
    const actif = item.vue === route.vue;
    const a = lien(construireHash({ env: route.env, vue: item.vue }), 'tab' + (actif ? ' is-active' : ''), item.libelle);
    if (actif) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }

  const compte = el('div', 'topbar-account');
  compte.append(vueConnexion.selecteurEnv(route), el('span', 'topbar-email', session.email), boutonDeconnexion(route, 'Déconnexion'));

  entete.replaceChildren(marque, nav, compte);
  return coque.querySelector('.contenu');
}

// ---------- Démarrage ----------

ecouterHash((route) => {
  rendreRoute(route).catch((e) => {
    console.error(e);
    racine.replaceChildren(etatErreur('Erreur inattendue', String(e && e.message || e)));
  });
});

