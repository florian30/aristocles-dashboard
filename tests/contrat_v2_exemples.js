// Exemples de réponse recopiés du contrat (docs/reference/contrat-dashboard.md, § 2.4, 2.5, 2.8).
export const JOURNEE = {
  "date": "2026-07-10",
  "from": "2026-07-09T22:00:00.000Z",
  "to": "2026-07-10T22:00:00.000Z",
  "enfants": [
    {
      "child_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "first_name": "Zoé",
      "classe": "CM1",
      "seances": [
        {
          "id": "11111111-1111-1111-1111-111111111111",
          "mode": "devoirs",
          "status": "archivee",
          "theme_libelle": "Devoirs de maths",
          "started_at": "2026-07-10T17:00:00Z",
          "ended_at": "2026-07-10T17:19:00Z",
          "duration_seconds": 1140,
          "nb_ecrans": 2,
          "exercices": {
            "nb": 1,
            "succes": 1,
            "fragile": 0,
            "autres": 0
          },
          "pouces": {
            "haut": 1,
            "bas": 1
          },
          "cloture": {
            "soldee_at": "2026-07-10T17:19:05Z",
            "motif": "menage_complet"
          }
        }
      ],
      "devoirs": [
        {
          "id": "4a4a4a4a-4a4a-4a4a-8a4a-4a4a4a4a4a4a",
          "session_id": "11111111-1111-1111-1111-111111111111",
          "pour_le": "2026-07-11",
          "matiere": "maths",
          "titre": "Fractions p. 42",
          "nb_consignes": 3,
          "created_at": "2026-07-10T17:00:30Z"
        }
      ],
      "dictees": [],
      "ecrans": [
        {
          "ecran": "accueil",
          "nb": 1,
          "duree_totale_ms": 15000
        }
      ],
      "ouvertures_app": 1,
      "erreurs_client": []
    }
  ],
  "technique": {
    "ia": {
      "appels": 2,
      "echecs": 0,
      "cout_total_eur": 0.012,
      "appels_cout_inconnu": 1,
      "par_role": [
        {
          "role": "tutor",
          "unite": "token",
          "appels": 1,
          "echecs": 0,
          "latence_p50_ms": 1400,
          "latence_p95_ms": 1400,
          "cout_eur": 0.012,
          "appels_cout_inconnu": 0,
          "volume_input": 900,
          "volume_output": 150
        },
        {
          "role": "vision-parser",
          "unite": "token",
          "appels": 1,
          "echecs": 0,
          "latence_p50_ms": 6000,
          "latence_p95_ms": 6000,
          "cout_eur": null,
          "appels_cout_inconnu": 1,
          "volume_input": 6000,
          "volume_output": 300
        }
      ]
    },
    "echecs_ia": [],
    "versions": [
      {
        "app_version": "1.0.0",
        "app_build": 101,
        "plateforme": "ios",
        "enfants": 1,
        "lancements": 1,
        "dernier_vu": "2026-07-10T17:20:15Z"
      }
    ],
    "incidents": {
      "par_type": [
        {
          "type": "tour_erreur",
          "nb": 0
        },
        {
          "type": "tour_anomalie",
          "nb": 0
        },
        {
          "type": "filet_echec_llm",
          "nb": 0
        },
        {
          "type": "ecriture_echec",
          "nb": 0
        }
      ],
      "recents": []
    },
    "erreurs_client": [],
    "ouvertures_app": 1
  }
};

export const APERCU = {
  "from": "2026-07-09T22:00:00.000Z",
  "to": "2026-07-11T21:59:59.000Z",
  "enfants_actifs": 2,
  "familles_actives": 2,
  "seances": {
    "total": 2,
    "par_mode": {
      "devoirs": 1,
      "entrainement": 1
    }
  },
  "minutes": 19,
  "exercices": {
    "total": 1,
    "succes": 1,
    "fragile": 0,
    "autres": 0
  },
  "ouvertures_app": 2,
  "entrees_par_mode": {
    "apprentissage": 0,
    "devoirs": 1,
    "dictee": 1,
    "autre": 0
  },
  "retention": {
    "j7": {
      "eligibles": 1,
      "revenus": 1,
      "taux": 1
    },
    "j30": {
      "eligibles": 1,
      "revenus": 1,
      "taux": 1
    }
  },
  "serie": [
    {
      "jour": "2026-07-10",
      "seances": 1,
      "enfants_actifs": 1,
      "minutes": 19,
      "ouvertures_app": 1
    },
    {
      "jour": "2026-07-11",
      "seances": 1,
      "enfants_actifs": 1,
      "minutes": 0,
      "ouvertures_app": 1
    }
  ],
  "couts": {
    "cout_total_eur": 0.012,
    "appels": 3,
    "appels_cout_inconnu": 1,
    "tokens_input": 6900,
    "tokens_output": 450,
    "volumes_hors_tokens": [],
    "par_role": [
      {
        "role": "tutor",
        "unite": "token",
        "cout_eur": 0.012,
        "appels": 2,
        "appels_cout_inconnu": 0,
        "tokens_input": 900,
        "tokens_output": 150
      },
      {
        "role": "vision-parser",
        "unite": "token",
        "cout_eur": null,
        "appels": 1,
        "appels_cout_inconnu": 1,
        "tokens_input": 6000,
        "tokens_output": 300
      }
    ]
  }
};

export const SANTE = {
  "from": "2026-07-01T00:00:00.000Z",
  "to": "2026-07-31T23:59:59.000Z",
  "erreurs_client": [
    {
      "type": "TimeoutException",
      "zone": "tutor",
      "ecran": "session",
      "app_version": "1.0.0",
      "plateforme": "android",
      "nb": 1,
      "derniere_occurrence": "2026-07-10T22:41:30Z",
      "exemple_pile": "a.dart:12"
    }
  ],
  "versions": [
    {
      "app_version": "1.0.0",
      "app_build": 101,
      "plateforme": "ios",
      "enfants": 1,
      "lancements": 1,
      "dernier_vu": "2026-07-10T17:20:15Z"
    },
    {
      "app_version": "1.0.0",
      "app_build": 100,
      "plateforme": "android",
      "enfants": 1,
      "lancements": 1,
      "dernier_vu": "2026-07-10T22:41:30Z"
    }
  ],
  "ia": {
    "appels": 3,
    "echecs": 1,
    "cout_total_eur": 0.012,
    "appels_cout_inconnu": 1,
    "par_role": [
      {
        "role": "tutor",
        "unite": "token",
        "appels": 2,
        "echecs": 1,
        "latence_p50_ms": 1400,
        "latence_p95_ms": 1400,
        "cout_eur": 0.012,
        "appels_cout_inconnu": 0,
        "volume_input": 900,
        "volume_output": 150
      },
      {
        "role": "vision-parser",
        "unite": "token",
        "appels": 1,
        "echecs": 0,
        "latence_p50_ms": 6000,
        "latence_p95_ms": 6000,
        "cout_eur": null,
        "appels_cout_inconnu": 1,
        "volume_input": 6000,
        "volume_output": 300
      }
    ]
  },
  "echecs_ia": [
    {
      "llm_generation_id": "gen-echec",
      "child_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "role": "tutor",
      "modele": "openai/gpt-5.6-luna",
      "erreur": "OpenRouter 502",
      "created_at": "2026-07-10T22:41:00Z"
    }
  ],
  "incidents": {
    "par_type": [
      {
        "type": "tour_erreur",
        "nb": 1
      },
      {
        "type": "tour_anomalie",
        "nb": 0
      },
      {
        "type": "filet_echec_llm",
        "nb": 0
      },
      {
        "type": "ecriture_echec",
        "nb": 0
      }
    ],
    "recents": [
      {
        "session_id": "22222222-2222-2222-2222-222222222222",
        "type": "tour_erreur",
        "ecran_type": "exercice",
        "client_ts": "2026-07-10T22:41:00Z",
        "detail": {
          "tour": 1,
          "erreur": "TimeoutException"
        }
      }
    ]
  },
  "quotas": {
    "plafond": 300,
    "au_plafond": [
      {
        "parent_id": "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a",
        "jour": "2026-07-10",
        "unites": 300
      }
    ]
  }
};
