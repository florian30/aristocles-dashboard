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

Ils couvrent les modules purs : routeur, formatage et unités des coûts, plages de dates, jours civils de Paris (hier, navigation de jour, bornes ≤ 92 j), échelle et géométrie du graphe, mise en forme santé, adaptateurs (dont les exemples du contrat v2 recopiés dans `tests/contrat_v2_exemples.js` : journee, apercu, sante, enfants, enfant, session_detail, tour, photo), photo jamais en cache, date inexistante rejetée, journée « vide », adaptateur et filtres de la page Incidents (exemple du contrat recopié dans `tests/contrat_veille_exemples.js`), cache et transport de l'API, consignes de devoirs, ordre des écrans reçu tel quel, séances sans échange (param `avec_sans_echange`, compteur, cache), photos d'une séance (`photos_seance`, jamais en cache), parcours en données factices.

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

**Photos.** La relecture de séance et la fiche enfant (groupées par séance, 4 séances chargées à la fois) affichent les photos en miniatures (`ui/photo.js`). Elles viennent de l'action `photos_seance` : les URLs d'affichage sont signées en lot pour 1 heure, ne sont jamais mises en cache, ni affichées, ni placées dans le hash. Les photos arrivent dans l'ordre de prise de vue, et une version redressée suit son originale. Dans la séance, chaque miniature va dans la bulle de sa capture ; une photo de dictée va dans son écran. Un clic ouvre la photo en grand, avec le bouton « Télécharger » (action `photo`, URL signée de 5 minutes demandée à chaque clic). Une photo purgée (90 jours) s'affiche « Photo effacée ». Si une miniature ne charge plus (URL expirée), « Recharger » redemande le lot. Si `photos_seance` manque (Edge pas à jour) ou échoue, l'ancien bouton « Télécharger » revient. En démo, les images sont des SVG factices. La première photo de la séance de devoirs a une version redressée, la seconde est purgée, et chaque séance de dictée a une photo de copie.

**Consignes de devoirs.** En tête d'une séance Devoirs, le bloc « Consignes » montre les consignes telles que l'enfant les a vues (`exercice_presente`). Une consigne corrigée par l'enfant s'affiche « texte d'origine → texte corrigé » (`metadata.enonce_origine`) ; si seule la matière a changé, elle porte « Matière corrigée ». Une consigne retirée est barrée, et une consigne ajoutée par l'enfant est signalée. Les écrans de la séance sont rendus dans l'ordre reçu : l'Edge les trie par 1re activité (`premiere_activite_at`, affichée dans l'en-tête de chaque écran).

**Séances sans échange.** L'Edge écarte par défaut les séances sans aucun échange avec Ari et renvoie leur nombre (`seances_sans_echange`). Séances, La veille et la fiche enfant affichent « N séances sans échange masquées · Afficher ». Le lien pose `sans_echange=1` dans le hash, qui envoie `avec_sans_echange: true` à l'Edge. La veille et la fiche enfant grisent alors ces séances. La Vue d'ensemble et Familles les mentionnent seulement. Tant que l'Edge d'un environnement ne renvoie pas le compteur, rien ne s'affiche.

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
                période, graphe SVG, blocs techniques partagés, miniatures et téléchargement de photos, bandeau des séances sans échange
ui/dictee.js    rubrique Dictée (libellés purs + carte)
ui/incidents.js page Incidents (sélection, filtres, libellés produit des codes)
ui/messages.js  rubrique Messages (règles des formulaires, dates de Paris, refus de l'Edge)
vues/           une vue par fichier (enfant.js : fiche, tour.js : trace IA)
mock/           données factices par action (formes brutes de l'Edge) ;
                fil.js : mot à mot, photos, devoirs, dictées, traces IA ;
                console.js : Edge notifs_console factice, avec état
tests/          tests Deno
```
