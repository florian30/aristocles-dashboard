// Exemples de réponse recopiés du contrat (docs/reference/contrat-dashboard.md, § 2.3 à 2.10).
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

// Exemples recopiés du contrat pour le lot 5 (§ 2.3, 2.6, 2.7, 2.9, 2.10).

export const SESSION_DETAIL = {
  "session": {
    "id": "11111111-1111-1111-1111-111111111111",
    "child_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "first_name": "Zoé",
    "classe": "CM1",
    "mode": "devoirs",
    "status": "archivee",
    "theme_libelle": "Devoirs de maths",
    "notion_principale": "Les fractions simples",
    "started_at": "2026-07-10T17:00:00Z",
    "duration_seconds": 1140,
    "ended_at": "2026-07-10T17:19:00Z",
    "cloture": {
      "soldee_at": "2026-07-10T17:19:05Z",
      "motif": "menage_complet"
    }
  },
  "resume_seance": "Zoé a fait ses devoirs.",
  "homework": {
    "id": "4a4a4a4a-4a4a-4a4a-8a4a-4a4a4a4a4a4a",
    "session_id": "11111111-1111-1111-1111-111111111111",
    "pour_le": "2026-07-11",
    "matiere": "maths",
    "titre": "Fractions p. 42",
    "nb_consignes": 3,
    "created_at": "2026-07-10T17:00:30Z"
  },
  "ecrans": [
    {
      "id": "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1",
      "position": 1,
      "type": "exercice",
      "synthese_redigee": "Zoé a résolu l'exercice.",
      "statut_fermeture": "resolu_succes",
      "pouce_enfant": "haut",
      "exercices": [
        {
          "id": "x1",
          "enonce": "Calcule 3/4 de 20.",
          "resultat": "succes",
          "origine": "devoir_scolaire",
          "duree_secondes": 120,
          "notions": [
            "Les fractions simples"
          ],
          "created_at": "2026-07-10T17:08:00Z"
        }
      ],
      "interactions": [
        {
          "id": "1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b",
          "position": 1,
          "type": "capture_photo",
          "locuteur": "enfant",
          "contenu_texte": null,
          "created_at": "2026-07-10T17:01:00Z",
          "llm_generation_id": null,
          "modele_llm_utilise": null,
          "a_photo": true,
          "metadata": null
        },
        {
          "id": "1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a",
          "position": 2,
          "type": "message_tuteur",
          "locuteur": "ari",
          "contenu_texte": "Comment tu ferais pour partager 20 en 4 ?",
          "created_at": "2026-07-10T17:05:00Z",
          "llm_generation_id": "9e9e9e9e-9e9e-4e9e-8e9e-9e9e9e9e9e9e",
          "modele_llm_utilise": "openai/gpt-5.6-luna",
          "a_photo": false,
          "metadata": null
        },
        {
          "id": "1c1c1c1c-1c1c-4c1c-8c1c-1c1c1c1c1c1c",
          "position": 3,
          "type": "capture_photo",
          "locuteur": "enfant",
          "contenu_texte": null,
          "created_at": "2026-07-10T17:06:00Z",
          "llm_generation_id": null,
          "modele_llm_utilise": null,
          "a_photo": true,
          "metadata": null
        }
      ],
      "dictee": null
    },
    {
      "id": "e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2",
      "position": 2,
      "type": "bilan_session",
      "synthese_redigee": null,
      "statut_fermeture": null,
      "pouce_enfant": null,
      "exercices": [],
      "interactions": [],
      "dictee": null
    }
  ],
  "acquisitions": [
    {
      "notion_id": "fractions-simples",
      "notion": "Les fractions simples",
      "statut_maitrise": "acquise",
      "statut_vu_en_classe": "presume_vu",
      "derniere_mise_a_jour": "2026-07-10T17:10:00Z"
    }
  ],
  "evenements": [
    {
      "seq": 1,
      "type": "tour_debut",
      "client_ts": "2026-07-10T17:04:00Z",
      "ecran_type": "exercice",
      "exercise_id": null,
      "detail": {
        "tour": 1
      }
    }
  ]
};

export const ENFANTS = {
  "from": "2026-07-01T00:00:00.000Z",
  "to": "2026-07-31T23:59:59.000Z",
  "enfants": [
    {
      "child_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "first_name": "Ali",
      "classe": "CE2",
      "genre": "garcon",
      "created_at": "2026-07-09T10:00:00Z",
      "parent_id": "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b",
      "parent_email": "parent.b@example.org",
      "derniere_activite": "2026-07-10T22:30:00Z",
      "seances": 1,
      "notions_acquises": 0
    },
    {
      "child_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "first_name": "Zoé",
      "classe": "CM1",
      "genre": "fille",
      "created_at": "2026-06-01T10:00:00Z",
      "parent_id": "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a",
      "parent_email": "parent.a@example.org",
      "derniere_activite": "2026-07-10T17:00:00Z",
      "seances": 1,
      "notions_acquises": 1
    }
  ]
};

export const ENFANT = {
  "from": "2026-07-01T00:00:00.000Z",
  "to": "2026-07-31T23:59:59.000Z",
  "identite": {
    "child_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "first_name": "Zoé",
    "classe": "CM1",
    "genre": "fille",
    "created_at": "2026-06-01T10:00:00Z",
    "parent_id": "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a",
    "parent_email": "parent.a@example.org"
  },
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
  "maitrise": [
    {
      "concept_id": "fractions-simples",
      "notion": "Les fractions simples",
      "statut_maitrise": "acquise",
      "statut_vu_en_classe": "presume_vu",
      "derniere_mise_a_jour": "2026-07-10T17:10:00Z"
    }
  ],
  "notions_acquises": 1,
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
  "bilans": [
    {
      "id": "bilan-1",
      "type": "quotidien",
      "periode_cle": "2026-07-10",
      "statut": "genere",
      "contenu": {
        "resume": "Bonne séance."
      },
      "modele": "anthropic/claude-haiku-4.5",
      "genere_at": "2026-07-10T20:00:00Z",
      "regenere_at": null,
      "lu_at": null
    }
  ],
  "conversations_parent": [
    {
      "id": "conv-1",
      "entree_type": "quotidien",
      "entree_periode_cle": "2026-07-10",
      "messages": [
        {
          "role": "user",
          "content": "Comment ça s'est passé ?"
        }
      ],
      "modele": "anthropic/claude-haiku-4.5",
      "cree_at": "2026-07-10T20:30:00Z",
      "maj_at": "2026-07-10T20:31:00Z"
    }
  ],
  "memory_profile": {
    "intelligences_emergentes": [],
    "preferences_pedagogiques": {
      "rythme": "calme"
    },
    "interets_personnels": [
      "chats"
    ],
    "contexte_personnel": {},
    "niveau_dictee": "facile",
    "derniere_extraction_at": null,
    "updated_at": "2026-07-10T17:20:00Z"
  },
  "ecrans": [
    {
      "ecran": "accueil",
      "nb": 1,
      "duree_totale_ms": 15000
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
    }
  ],
  "photos": [
    {
      "interaction_id": "1c1c1c1c-1c1c-4c1c-8c1c-1c1c1c1c1c1c",
      "ecran_id": "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1",
      "session_id": "11111111-1111-1111-1111-111111111111",
      "created_at": "2026-07-10T17:06:00Z"
    },
    {
      "interaction_id": "1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b",
      "ecran_id": "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1",
      "session_id": "11111111-1111-1111-1111-111111111111",
      "created_at": "2026-07-10T17:01:00Z"
    }
  ]
};

export const TOUR = {
  "generation": {
    "id": "9e9e9e9e-9e9e-4e9e-8e9e-9e9e9e9e9e9e",
    "child_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "role": "tutor",
    "unite": "token",
    "modele": "openai/gpt-5.6-luna",
    "prompt_version": 40,
    "latence_ms": 1400,
    "tokens_input": 900,
    "tokens_output": 150,
    "cout_estime_eur": 0.012,
    "succes": true,
    "erreur": null,
    "metadata": {
      "session_id": "11111111-1111-1111-1111-111111111111"
    },
    "created_at": "2026-07-10T17:04:58Z"
  },
  "trace": {
    "id": "trace-1",
    "fournisseur": "openai-responses",
    "modele": "openai/gpt-5.6-luna",
    "prompt_version": 40,
    "requete": {
      "system_sha256": "abc123",
      "system_regime": "devoirs",
      "messages": [
        {
          "role": "user",
          "content": "je sais pas"
        }
      ],
      "tools_noms": [
        "afficher_visuel"
      ],
      "nb_photos": 1
    },
    "reponse": {
      "finish_reason": "stop",
      "servi": {
        "reply": "Comment tu ferais ?"
      }
    },
    "created_at": "2026-07-10T17:05:00Z"
  },
  "prompt_systeme": {
    "sha256": "abc123",
    "regime": "devoirs",
    "prompt_version": 40,
    "taille": 27,
    "texte": "Tu es Ari, un robot tuteur…",
    "premiere_vue_at": "2026-07-01T00:00:00Z"
  }
};

export const TOUR_SANS_TRACE = {
  "generation": {
    "id": "9f9f9f9f-9f9f-4f9f-8f9f-9f9f9f9f9f9f",
    "child_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "role": "vision-parser",
    "unite": "token",
    "modele": "anthropic/claude-opus-5",
    "prompt_version": 3,
    "latence_ms": 6000,
    "tokens_input": 6000,
    "tokens_output": 300,
    "cout_estime_eur": null,
    "succes": true,
    "erreur": null,
    "metadata": null,
    "created_at": "2026-07-10T17:01:30Z"
  },
  "trace": null,
  "prompt_systeme": null
};

export const PHOTO = {
  "url": "https://fake.supabase.co/storage/v1/object/sign/devoirs/signed-token-130",
  "expire_le": "2026-07-12T08:05:00.000Z",
  "nom_fichier": "devoir_2026-07-10_1b1b1b1b.jpg"
};

export const PHOTO_PURGEE = {
  "error": "photo_purgee"
};
