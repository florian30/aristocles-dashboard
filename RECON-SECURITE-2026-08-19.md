# Recon sécurité — dashboard testeurs Aristocles

**Périmètre :** dépôt `florian30/aristocles-dashboard` (front statique) + artefact
publié + surface exposée de la fonction Edge `dashboard`.
**Nature :** constat en lecture seule. Aucune modification, aucune rotation, aucun
redéploiement. Date : 2026-08-19.

---

## Verdict (3 lignes)

Le mot de passe est **SAISI** par la personne qui ouvre le dashboard : champ de
formulaire (`index.html:512`), envoyé tel quel dans le corps POST (`api.js:80`). Il
n'est **jamais embarqué** — ni dans les sources, ni au build (il n'y a pas de build),
ni dans les fichiers réellement servis en ligne (vérifié octet pour octet), ni dans
l'historique git. **La faille n'est pas une fuite de secret** : c'est que ce secret
saisi est l'unique barrière, partagé, devant une fonction `service_role` en accès
public, **sans aucun étranglement** — un seul mot de passe deviné ouvre toute la base.

---

## 1. D'où vient le mot de passe à l'exécution

**Saisi par l'utilisateur.** Aucune constante, aucune variable d'environnement, aucune
injection de bundler.

Chaîne complète, vérifiée ligne à ligne :

- `index.html:512` — champ de saisie :
  `<input id="pw" type="password" autocomplete="current-password" autofocus>`
- `app.js:676` — lecture de la valeur à la soumission : `const pw = el('pw').value;`
- `app.js:658` — `api.setPassword(pw)` transmet la saisie à la couche API.
- `api.js:61-62` — variable mémoire, initialisée à `null`, remplie uniquement par
  l'appelant : `let password = null; function setPassword(pw) { password = pw; }`
- `api.js:80` — envoi dans le corps de la requête :
  `body: JSON.stringify({ password, action, params })`

**Absence d'injection au build — vérifiée, pas déduite :**
- Aucun `import.meta.env`, `process.env`, `VITE_*`, `REACT_APP_*`, `NEXT_PUBLIC_`,
  ni `define(` nulle part dans les sources (grep sur `*.js`/`*.html`/`*.json`).
- Aucun outil de build : pas de `package.json`, pas de `vite/webpack/rollup/esbuild`.
  Le dépôt EST l'artefact — les fichiers sont servis tels quels.

**Persistance de session :** le mot de passe saisi est mémorisé en clair dans
`sessionStorage` sous la clé `aristocles-pw` (`app.js:662`, restauré `app.js:748`).
Portée : l'onglet courant uniquement ; effacé à la fermeture de l'onglet et au logout
(`app.js:169`). Ce n'est pas un secret embarqué dans l'artefact, mais c'est le secret
en clair dans le navigateur du testeur (accessible à tout script de la page / extension).

## 2. Le secret se retrouve-t-il en clair dans les fichiers publiés

**Non.** Il n'y a rien à embarquer puisqu'il est saisi (point 1) — et c'est confirmé
directement sur l'artefact en ligne, ce qui fait foi :

- Fichiers récupérés depuis l'URL publique `https://florian30.github.io/aristocles-dashboard/`
  sans aucune authentification : `index.html`, `api.js`, `app.js`, `mock.js` → tous HTTP 200.
- **Identité octet pour octet** avec les sources locales (SHA-256 identiques sur les 4
  fichiers) → le site en ligne = le code lu ci-dessus, sans transformation.
- Grep `password` sur les JS **réellement servis** : seules les 4 occurrences
  structurelles (déclaration, paramètre, commentaire, envoi). Aucune valeur littérale.
- Grep des littéraux longs suspects dans `api.js` en ligne : uniquement des chaînes
  fonctionnelles (`'ApiError'`, `'Content-Type'`, `'session_detail'`, etc.).

## 3. Le site publié est-il accessible sans authentification à qui connaît l'URL

**Oui, entièrement.** Et c'est ici le piège classique — vérifié :

- **Dépôt :** `visibility = PUBLIC`, `isPrivate = false`. Le dépôt lui-même est donc
  lisible par tous (`api.github.com/repos/...` répond en anonyme).
- **Pages :** l'API Pages renvoie `"public": true`, `status: built`, source
  `branch: main / path: /`. Servi via `pages-build-deployment`.
- **Point factuel demandé :** même si le dépôt était privé, **GitHub Pages sur un
  compte personnel est TOUJOURS servi publiquement** — il n'existe pas de Pages
  « privées » hors plan Enterprise. Un dépôt privé n'aurait donc PAS protégé le site.
  Ici la question est même sans objet : le dépôt est public.
- La page n'a aucune barrière côté serveur : l'écran de mot de passe est purement
  cosmétique (JS client). N'importe qui atteint `index.html`, `app.js`, `api.js` et y
  lit l'URL de la fonction Edge et le contrat d'appel. La seule vraie barrière est la
  validation `password` faite par la fonction Edge distante.

## 4. Le secret apparaît-il dans l'historique, un exemple, la CI, un workflow

**Non, nulle part.**

- **Historique git (9 commits, toutes branches) :** grep sur chaque blob de
  `git rev-list --all` → seules les lignes structurelles (`let password = null;`,
  `function setPassword`, `<input type="password">`). Aucune valeur en dur, aucune
  affectation `setPassword('...')`, aucun `DASHBOARD_PASSWORD=...`.
- **Fichiers d'exemple / env :** aucun `.env*`, aucun `*.example`. `.gitignore` ne
  contient que `.DS_Store`.
- **CI / workflows :** pas de dossier `.github/`. Le seul workflow existant est
  `pages-build-deployment` (dynamique, généré par GitHub Pages) — pas de script custom.
- **Secrets & variables Actions :** `actions/secrets` = 0, `actions/variables` = 0.

Le secret vit exclusivement comme variable d'environnement `DASHBOARD_PASSWORD` de la
fonction Edge, dans l'autre dépôt — hors de ce périmètre, et hors de cet artefact.

## 5. Longueur du mot de passe et étranglement

**Longueur : indéterminable depuis ce périmètre.** Le secret n'est ni dans ce dépôt,
ni dans son historique, ni dans ses variables — il ne vit que côté Supabase. Aucune
contrainte de longueur/format n'est imposée côté front (le champ accepte toute chaîne
non vide, `app.js:677`). Sa robustesse dépend donc entièrement de la valeur choisie
côté back, invisible d'ici.

**Étranglement : AUCUN — noir sur blanc.** Testé directement contre la fonction Edge :

- 10 requêtes POST consécutives avec mot de passe faux → **10× HTTP 401**, temps de
  réponse constant (~0,22–0,33 s), **sans dégradation, sans blocage, sans `Retry-After`**.
- Aucun en-tête de limitation : pas de `ratelimit-*`, pas de `retry-after`. Rien entre
  un attaquant et la fonction : **ni limite de tentatives, ni délai progressif, ni
  captcha, ni verrouillage**.
- Le CORS (`access-control-allow-origin: https://florian30.github.io`) ne protège
  RIEN ici : c'est une règle navigateur. Un appel scripté (curl) avec `Origin` falsifié
  reçoit quand même 401 « traité » → la barrière CORS est contournée par tout attaquant
  non-navigateur. Le brute-force est donc réalisable à pleine vitesse depuis n'importe où.

**Conséquence :** un unique secret partagé, sans étranglement, devant une fonction
`service_role` (contourne toute RLS, lit toute table) exposée publiquement, protégeant
des données d'enfants mineurs. Le coût de l'exception = la totalité de la base, à la
merci d'un seul mot de passe deviné ou divulgué par un testeur.

---

## Recommandations (NON appliquées — constat seulement)

Par ordre de priorité :

1. **Ajouter un étranglement côté fonction Edge** (le plus urgent, indépendant du
   reste) : limitation par IP + délai progressif sur échec, idéalement verrouillage
   temporaire. Rien aujourd'hui ne ralentit un brute-force.
2. **Remplacer le secret partagé par une vraie authentification par testeur**
   (déjà au backlog d'après `recap-dashboard-socle.md:61`) : comptes nominatifs,
   révocables individuellement, traçables. Un seul secret partagé = compromission
   collective et non-révocable.
3. **Réduire le privilège de la fonction** : ne pas exécuter en `service_role` ;
   restreindre aux seules tables/colonnes du dashboard via un rôle dédié + RLS, pour
   que même une compromission ne donne pas « toute la base ».
4. **Ne pas conserver le mot de passe en `sessionStorage`** en clair ; a minima le
   garder en mémoire volatile uniquement.
5. **Rotation du secret** une fois les mesures ci-dessus en place (à décider par
   l'équipe — non effectuée ici, comme demandé).
6. Rappel : le front étant public par conception (Pages), il ne faut JAMAIS y placer
   de secret ; la sécurité doit intégralement reposer sur la fonction Edge.
