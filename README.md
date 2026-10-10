# aristocles-dashboard

Tableau de bord interne d'Aristocles (suivi des testeurs). Site statique HTML/CSS/JS en ES modules natifs, **sans build**, publié par GitHub Pages depuis `main` : https://florian30.github.io/aristocles-dashboard/ (un merge sur `main` met en ligne).

## Lancer en local

```sh
python3 -m http.server 8000
```

- **Mode démo (recommandé en local)** : http://localhost:8000/?mock=1. Un bandeau « DÉMO — données fictives » reste affiché. Aucun réseau : la connexion est simulée et accepte n'importe quel e-mail et mot de passe. Un e-mail qui commence par `refuse` simule un compte non autorisé (403).
- **Mode réel** : http://localhost:8000/. La connexion passe par Supabase Auth, mais l'Edge `dashboard` n'accepte que l'origine GitHub Pages (CORS). En local, les écrans de données affichent donc « serveur injoignable ».

## Tests

```sh
deno test tests/
```

Ils couvrent les modules purs : routeur, formatage et unités des coûts, plages de dates, jours civils de Paris (hier, navigation de jour, bornes ≤ 92 j), échelle et géométrie du graphe, mise en forme santé, adaptateurs (dont les exemples du contrat v2 recopiés dans `tests/contrat_v2_exemples.js` : journee, apercu, sante, enfants, enfant, session_detail, tour, photo), photo jamais en cache, date inexistante rejetée, journée « vide », adaptateur et filtres de la page Incidents (exemple du contrat recopié dans `tests/contrat_veille_exemples.js`), cache et transport de l'API, parcours en données factices.

## Environnements et routes

L'environnement fait partie de l'URL (prod par défaut) :

| Route | Écran |
|---|---|
| `#/{env}/veille/{AAAA-MM-JJ}` | La veille (page d'accueil, action `journee`) : séances, devoirs, dictées de chaque enfant ; sans date = hier à Paris |
| `#/{env}/apercu` | Vue d'ensemble (action `apercu`), dont la rubrique Dictées et la part des séances en mode Dictée |
| `#/{env}/familles` | Familles (action `enfants`) : e-mail du parent, dernière activité, séances, étoiles ; tri par dernière activité |
| `#/{env}/familles/{child_id}` | Fiche enfant (action `enfant`) : séances, photos de devoirs, maîtrise, devoirs, dictées, bilans et conversations parent, mémoire, écrans, versions ; 92 jours par défaut |
| `#/{env}/seances`, `#/{env}/seances/{session_id}` | Liste des séances (`session`), relecture tour par tour (`session_detail`) |
| `#/{env}/seances/{session_id}/tour/{llm_generation_id}` | Trace IA d'une réplique d'Ari (action `tour`) : génération, prompt système, requête et réponse brutes |
| `#/{env}/sante` | Santé & coûts (action `sante`) |
| `#/{env}/incidents?jours=7\|14\|30\|92` | Incidents (action `veille`) : les huit familles de la veille de la prod (vert / orange / rouge), la frise jour par jour (aujourd'hui partiel) et le détail des lignes d'une famille ou d'un jour (`&famille=F1…F8`, `&jour=AAAA-MM-JJ`) ; 14 jours par défaut |
| `#/{env}/messages`, `#/{env}/messages?onglet=app` | Messages (Edge `notifs_console`) : notifications push (écrire, aperçu et audience, essai sur un téléphone, envoyer ou programmer, annuler, résultats) ; messages dans l'app (liste, écrire, publier / retirer) |

`{env}` vaut `prod` ou `dev`. En dev, un bandeau orange « BAC À SABLE — dev » reste affiché en permanence. Une date inexistante dans l'URL de La veille (ex. `2026-02-30`) ramène à hier. Les filtres sont dans le hash, donc un rafraîchissement les garde : `?periode=hier|7j|30j|tout`, `from`, `to`, `child` pour les Séances ; `?periode=7j|30j|92j` ou `from`/`to` pour la Vue d'ensemble, Santé & coûts et la fiche enfant (jours civils de Paris, plage ramenée à 92 jours avec un message si elle dépasse).

**Jours de Paris.** Le serveur compte en jour civil Europe/Paris : « hier », les bornes envoyées à `apercu`/`sante` (`ui/paris.js`) et les heures affichées suivent Paris, quel que soit le fuseau de la machine. Un coût IA inconnu s'affiche « inconnu » (jamais 0 €), avec le nombre d'appels concernés.

**Photos de devoirs.** Le bouton « Télécharger » appelle l'action `photo` à chaque clic (URL signée de 5 minutes, jamais mise en cache, jamais affichée ni placée dans le hash) puis déclenche le téléchargement (`ui/photo.js`). Une photo purgée (404 `photo_purgee`, 90 jours) affiche « Photo effacée (purge automatique) ». En démo, le fichier est une image SVG factice et la seconde photo de chaque séance de devoirs est purgée.

**Dictées.** Chaque dictée (`ui/dictee.js`, partagé par La veille, la fiche enfant et la relecture de séance) montre l'heure, l'origine, la classe, l'étape (finie, à finir, non corrigée, échec), le texte dicté, les fautes comptées et réglées avec les règles revues, et le journal d'étapes compté par type. Une dictée sans classe vient de l'ancien flux : seule son étape « Ancien flux » est signalée. Tant que l'Edge d'un environnement ne rend pas ces champs (DICT-12), la partie concernée n'est simplement pas affichée.

**Messages.** La rubrique parle à une autre Edge, `POST {url}/functions/v1/notifs_console`, avec le même jeton, la même `apikey` et le même corps `{action, params}` ; ses réponses ne sont jamais mises en cache. Chaque envoi porte un numéro (`campagne_id`, UUID) tiré par l'écran **une fois** et réutilisé à chaque nouvel essai (coupure réseau, 409 `en_cours`, doublon confirmé) : le serveur ne fait jamais partir deux fois la même campagne ; un nouveau numéro n'est tiré qu'après un envoi abouti. Les avertissements (nuit, repère hebdo et mensuel, doublon probable) s'affichent sans bloquer ; envoyer, programmer, annuler, publier et retirer demandent une confirmation dans la page (jamais de `confirm()`). Les dates se saisissent à l'heure de Paris et partent avec leur fuseau. Le formulaire des messages dans l'app reprend les règles de la table `message_in_app` (accueil enfant = feuille, jamais d'adresse web côté enfant, bouton obligatoire pour mener quelque part…) pour nommer le champ fautif ; le serveur reste juge et ses refus s'affichent tels quels. Le déclencheur « ouvert par une notification » n'est pas proposé : aucune notification ne sait encore ouvrir un message ; un message qui le porte s'affiche en lecture seule, marqué « pas encore servi ». Un 503 (table ou secret Firebase absents, ex. prod avant la release) affiche « pas disponible sur <env> ». En démo, un texte contenant « coupure » simule une réponse perdue, « bloque » un envoi resté en cours ; le mock garde son état jusqu'au rechargement.

**Contenu non fiable.** Le mot à mot de l'enfant, les messages des parents et les sorties des modèles sont affichés uniquement par `textContent` (aucun `innerHTML` dans le dépôt).

## Accès

Chaque environnement a son propre compte Supabase (e-mail + mot de passe) et sa propre session : on peut être connecté à prod et à dev en même temps. supabase-js garde la session (jetons, jamais le mot de passe) dans le `sessionStorage` : elle disparaît à la fermeture du navigateur, car l'origine github.io est partagée avec d'autres sites. Au chargement, l'app efface toute session Supabase (`sb-*-auth-token`) restée dans le `localStorage`. La connexion est vérifiée par un appel `enfants` (l'action `stats` n'est plus utilisée). Chaque appel envoie `POST {url}/functions/v1/dashboard` avec le corps `{action, params}` et les en-têtes `Authorization: Bearer <access_token>` et `apikey: <clé anon>`. Si l'Edge répond 401, l'app revient à la connexion ; si elle répond 403, elle affiche « Ce compte n'est pas autorisé sur <env> ».

`config.js` ne contient que les clés **anon** (publiques par nature). Aucune clé service_role / secret ne doit entrer dans ce dépôt public.

## Organisation

```
index.html      coquille HTML, charge styles.css et main.js
main.js         routage → session → vue ; annulation et état de chargement
config.js       environnements (url, clé anon), version de supabase-js
auth.js         connexion par env (supabase-js ou simulée en démo)
api.js          transport HTTP, cache 5 min par (env, action, params), adaptateurs
router.js       analyse et fabrication des hash
ui/             formatage, unités et coûts, libellés, DOM, filtres, jours de Paris,
                période, graphe SVG, blocs techniques partagés, téléchargement de photo
ui/dictee.js    rubrique Dictée (libellés purs + carte)
ui/incidents.js page Incidents (sélection, filtres, libellés produit des codes)
ui/messages.js  rubrique Messages (règles des formulaires, dates de Paris, refus de l'Edge)
vues/           une vue par fichier (enfant.js : fiche, tour.js : trace IA)
mock/           données factices par action (formes brutes de l'Edge) ;
                fil.js : mot à mot, photos, devoirs, dictées, traces IA ;
                console.js : Edge notifs_console factice, avec état
tests/          tests Deno
```
