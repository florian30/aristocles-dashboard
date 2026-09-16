# aristocles-dashboard

Tableau de bord interne d'Aristocles (suivi des testeurs). Site statique HTML/CSS/JS en ES modules natifs, **sans build**, publié par GitHub Pages depuis `main` : https://florian30.github.io/aristocles-dashboard/ (un merge sur `main` met en ligne).

## Lancer en local

```sh
python3 -m http.server 8000
```

- **Mode démo (recommandé en local)** : http://localhost:8000/?mock=1. Aucun réseau : la connexion est simulée et accepte n'importe quel e-mail et mot de passe. Un e-mail qui commence par `refuse` simule un compte non autorisé (403).
- **Mode réel** : http://localhost:8000/. La connexion passe par Supabase Auth, mais l'Edge `dashboard` n'accepte que l'origine GitHub Pages (CORS). En local, les écrans de données affichent donc « serveur injoignable ».

## Tests

```sh
deno test tests/
```

Ils couvrent les modules purs : routeur, formatage et unités des coûts, plages de dates, sérialisation du `detail`, cache et transport de l'API, données factices.

## Environnements et routes

L'environnement fait partie de l'URL (prod par défaut) :

| Route | Écran |
|---|---|
| `#/{env}/veille/{AAAA-MM-JJ}` | La veille (page d'accueil, à venir) |
| `#/{env}/apercu` | Vue d'ensemble (action `stats`) |
| `#/{env}/familles`, `#/{env}/familles/{child_id}` | Familles, fiche enfant (à venir) |
| `#/{env}/seances`, `#/{env}/seances/{session_id}` | Liste des séances (`session`), lecteur (`session_detail`) |
| `#/{env}/seances/{session_id}/tour/{llm_generation_id}` | Lecteur + trace IA d'un tour (à venir) |
| `#/{env}/sante` | Santé & coûts (à venir) |

`{env}` vaut `prod` ou `dev`. En dev, un bandeau orange « BAC À SABLE — dev » reste affiché en permanence. Les filtres (`?periode=hier|7j|30j|tout`, `from`, `to`, `child`) sont dans le hash, donc un rafraîchissement les garde.

## Accès

Chaque environnement a son propre compte Supabase (e-mail + mot de passe) et sa propre session : on peut être connecté à prod et à dev en même temps. supabase-js garde la session (jetons, jamais le mot de passe) dans le `localStorage`. Chaque appel envoie `POST {url}/functions/v1/dashboard` avec le corps `{action, params}` et les en-têtes `Authorization: Bearer <access_token>` et `apikey: <clé anon>`. Si l'Edge répond 401, l'app revient à la connexion ; si elle répond 403, elle affiche « Ce compte n'est pas autorisé sur <env> ».

`config.js` ne contient que les clés **anon** (publiques par nature). Aucune clé service_role / secret ne doit entrer dans ce dépôt public.

## Organisation

```
index.html      coquille HTML, charge styles.css et main.js
main.js         routage → session → vue ; annulation et état de chargement
config.js       environnements (url, clé anon), version de supabase-js
auth.js         connexion par env (supabase-js ou simulée en démo)
api.js          transport HTTP, cache 5 min par (env, action, params), adaptateurs
router.js       analyse et fabrication des hash
ui/             formatage, unités et coûts, libellés, DOM, filtres
vues/           une vue par fichier
mock/           données factices par action (formes brutes de l'Edge)
tests/          tests Deno
```
