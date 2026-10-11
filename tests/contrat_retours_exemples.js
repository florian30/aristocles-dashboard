// Exemples de réponse des actions `retours`, `retour`, `retour_statut`
// recopiés du contrat (aristocles_voice_proto,
// docs/reference/contrat-dashboard.md § 2.13 à 2.15, AVIS-3).

export const RETOURS = {
  "from": "2026-07-11T08:00:00.000Z",
  "to": "2026-10-11T08:00:00.000Z",
  "statut": null,
  "compteurs": {
    "nouveau": 1,
    "lu": 1,
    "inscrit": 1,
    "clos": 0
  },
  "retours": [
    {
      "id": "c0000000-0000-4000-8000-000000000001",
      "cree_le": "2026-10-10T16:42:05Z",
      "parent_id": "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a",
      "parent_email": "parent.a@example.org",
      "enfant": {
        "child_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "prenom": "Léa",
        "classe": "CE2"
      },
      "categorie": "bug",
      "ou": "dictee",
      "saisie": "mixte",
      "app": {
        "version": "1.4.0",
        "build": 212,
        "plateforme": "ios",
        "env": "prod"
      },
      "statut": "nouveau",
      "ref_registre": null,
      "a_capture": true,
      "session_id": "11111111-1111-4111-8111-111111111111",
      "extrait": "L'écran de la dictée reste noir quand je tourne la tablette, et le bouton du mic…"
    },
    {
      "id": "c0000000-0000-4000-8000-000000000002",
      "cree_le": "2026-10-09T09:00:00Z",
      "parent_id": "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b",
      "parent_email": null,
      "enfant": null,
      "categorie": "autre",
      "ou": "ailleurs",
      "saisie": "texte",
      "app": {
        "version": "1.4.0",
        "build": 212,
        "plateforme": "ios",
        "env": "prod"
      },
      "statut": "lu",
      "ref_registre": null,
      "a_capture": false,
      "session_id": null,
      "extrait": "Rien à signaler."
    }
  ]
};

export const RETOUR = {
  "retour": {
    "id": "c0000000-0000-4000-8000-000000000001",
    "cree_le": "2026-10-10T16:42:05Z",
    "parent_id": "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a",
    "parent_email": "parent.a@example.org",
    "enfant": {
      "child_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "prenom": "Léa",
      "classe": "CE2"
    },
    "categorie": "bug",
    "ou": "dictee",
    "saisie": "mixte",
    "app": {
      "version": "1.4.0",
      "build": 212,
      "plateforme": "ios",
      "env": "prod"
    },
    "statut": "nouveau",
    "ref_registre": null,
    "a_capture": true,
    "session_id": "11111111-1111-4111-8111-111111111111",
    "texte": "L'écran de la dictée reste noir quand je tourne la tablette, et le bouton du micro disparaît. Ma fille a dû recommencer.\nDeuxième ligne.",
    "prises_voix": 2,
    "lancement_id": "1a000000-0000-4000-8000-000000000001",
    "client_ts": "2026-10-10T16:42:00Z",
    "appareil": {
      "modele": "iPad (9e génération)",
      "systeme": "iPadOS 18.1"
    }
  },
  "seance": {
    "session_id": "11111111-1111-4111-8111-111111111111",
    "debut": "2026-10-10T16:30:00Z",
    "mode": "dictee",
    "theme": "Les sons [s] et [z]"
  },
  "capture": {
    "etat": "ok",
    "url": "https://fake.supabase.co/storage/v1/object/sign/retours/signed-token-77",
    "expire_le": "2026-10-11T09:00:00.000Z",
    "validite_s": 3600
  },
  "fil": [
    {
      "seq": 1,
      "client_ts": "2026-10-10T16:30:00Z",
      "type_evenement": "ecran_vu",
      "ecran": "accueil",
      "detail": null,
      "apres_retour": false
    },
    {
      "seq": 2,
      "client_ts": "2026-10-10T16:35:00Z",
      "type_evenement": "ecran_vu",
      "ecran": "dictee",
      "detail": null,
      "apres_retour": false
    },
    {
      "seq": 3,
      "client_ts": "2026-10-10T16:41:00Z",
      "type_evenement": "erreur_client",
      "ecran": "dictee",
      "detail": {
        "code": "rotation"
      },
      "apres_retour": false
    },
    {
      "seq": 4,
      "client_ts": "2026-10-10T16:43:00Z",
      "type_evenement": "ecran_vu",
      "ecran": "votre_avis",
      "detail": null,
      "apres_retour": true
    }
  ],
  "fil_tronque": false,
  "erreurs_7j": [
    {
      "client_ts": "2026-10-10T16:41:00Z",
      "ecran": "dictee",
      "detail": {
        "code": "rotation"
      },
      "app_build": 212,
      "lancement_id": "1a000000-0000-4000-8000-000000000001",
      "meme_lancement": true
    },
    {
      "client_ts": "2026-10-06T10:00:00Z",
      "ecran": "accueil",
      "detail": null,
      "app_build": 212,
      "lancement_id": "1a000000-0000-4000-8000-000000000002",
      "meme_lancement": false
    }
  ],
  "erreurs_tronque": false,
  "fiche": "--- début ---\nInscris ce retour parent au registre docs/revues/retours-testeurs-beta.md\n(grille de tri d'abord, une fiche R-JJMM-sujet par retour retenu, source : in-app ;\njamais d'e-mail ni de nom de famille).\n\n### Retour in-app du 10-10-2026 à 18 h 42 (id c0000000)\n- Remonté par : parent de Léa (CE2)\n- Catégorie : bug · Où : Dictée · Saisie : mixte (2 prise(s) de voix)\n- Build : 1.4.0 (212) · iOS · prod\n- Appareil : iPad (9e génération) · iPadOS 18.1\n- Séance : https://florian30.github.io/aristocles-dashboard/#/prod/seances/11111111-1111-4111-8111-111111111111 (début 10-10-2026 à 18 h 30)\n- Capture : https://florian30.github.io/aristocles-dashboard/#/prod/retours/c0000000-0000-4000-8000-000000000001 (jointe, visible dans le dashboard)\n- Texte :\n  > L'écran de la dictée reste noir quand je tourne la tablette, et le bouton du micro disparaît. Ma fille a dû recommencer.\n  > Deuxième ligne.\n--- fin ---"
};

export const RETOUR_STATUT = {
  "id": "c0000000-0000-4000-8000-000000000001",
  "statut": "inscrit",
  "ref_registre": "R-1010-dictee-rotation"
};
