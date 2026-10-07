// Exemple de réponse de l'action `veille` recopié du contrat
// (aristocles_voice_proto, docs/reference/veille-prod.md § 7 ; contrat-dashboard.md § 2.11).
export const VEILLE = {
  "genere_le": "2026-10-07T08:00:00.000Z",
  "aujourdhui": "2026-10-07",
  "jours": 2,
  "premier_jour": "2026-10-06",
  "niveau": "rouge",
  "familles": [
    { "famille": "F1", "libelle": "Un enfant n'a pas eu ce qu'il demandait",
      "niveau": "rouge", "nb": 2, "jours_rouges": 1, "jours_orange": 0,
      "dernier_jour_signale": "2026-10-06",
      "seuil": { "orange": null, "rouge": "dès 1" } },
    { "famille": "F2", "libelle": "Un fournisseur refuse ou tombe",
      "niveau": "vert", "nb": 0, "jours_rouges": 0, "jours_orange": 0,
      "dernier_jour_signale": null,
      "seuil": { "orange": "dès 1",
                 "rouge": "dès 3, ou ≥ 2 % des appels quand il y en a au moins 50" } }
  ],
  "serie": [
    { "jour": "2026-10-06", "partiel": false, "niveau": "rouge",
      "appels_llm": 84, "cout_eur": 0.6,
      "familles": { "F1": { "niveau": "rouge", "nb": 2, "motifs": ["2 ce jour (seuil : 1)"] },
                    "F2": { "niveau": "vert", "nb": 0, "motifs": [] } } },
    { "jour": "2026-10-07", "partiel": true, "niveau": "vert",
      "appels_llm": 84, "cout_eur": 0.6,
      "familles": { "F1": { "niveau": "vert", "nb": 0, "motifs": [] },
                    "F2": { "niveau": "vert", "nb": 0, "motifs": [] } } }
  ],
  "lignes": [
    { "jour": "2026-10-06", "famille": "F1", "fonction": "app", "role": null,
      "modele": null, "code": "tour_erreur", "nb": 2, "nb_total": null,
      "latence_p50_ms": null, "latence_p95_ms": null, "cout_eur": null,
      "premier_at": "2026-10-06T07:12:00Z", "dernier_at": "2026-10-06T16:40:00Z" },
    { "jour": "2026-10-06", "famille": "mesure", "fonction": "llm", "role": "tutor",
      "modele": null, "code": "appels", "nb": 0, "nb_total": 80,
      "latence_p50_ms": 3000, "latence_p95_ms": 6000, "cout_eur": 0.4,
      "premier_at": "2026-10-06T08:00:00Z", "dernier_at": "2026-10-06T08:00:00Z" }
  ]
};
