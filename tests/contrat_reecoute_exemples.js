// Exemples recopiés du contrat-dashboard.md § 2.18-2.19 (lot 107, aristocles_voice_proto
// #5068), produits par le code de l'Edge (données factices de tests/reecoute_test.ts).

export const EXEMPLE_REECOUTE_LISTE = {
  "compteurs": {
    "total": 5,
    "evaluees": 2,
    "pas_ok": 1
  },
  "nb_resultats": 5,
  "page": 1,
  "par_page": 2,
  "nb_pages": 3,
  "validite_s": 3600,
  "expire_le": "2026-12-20T10:00:00.000Z",
  "prises": [
    {
      "prise_id": "50000000-0000-4000-8000-000000000001",
      "rang": 1,
      "prise_le": "2026-12-19T17:00:07.000Z",
      "enfant": "E-aaaaaa",
      "session_id": "11111111-1111-4111-8111-111111111111",
      "mode": "devoirs",
      "contexte": null,
      "filtre": "aucun",
      "duree_s": 2.4,
      "transcription": "cinquante-six",
      "interaction_id": "70000000-0000-4000-8000-000000000003",
      "message_ari_avant": {
        "interaction_id": "70000000-0000-4000-8000-000000000002",
        "texte": "Combien font 7 × 8 ?",
        "le": "2026-12-19T17:00:00Z"
      },
      "exercice": {
        "code": "ex-mult-7x8",
        "enonce": "Combien font 7 × 8 ?",
        "reponse_attendue": {
          "valeur": 56
        }
      },
      "etat": "ok",
      "url": "https://fake.supabase.co/storage/v1/object/sign/voix-stt/lot-96",
      "evaluation": null
    },
    {
      "prise_id": "50000000-0000-4000-8000-000000000002",
      "rang": 2,
      "prise_le": "2026-12-19T17:00:22.000Z",
      "enfant": "E-aaaaaa",
      "session_id": "11111111-1111-4111-8111-111111111111",
      "mode": "devoirs",
      "contexte": null,
      "filtre": "aucun",
      "duree_s": 2.4,
      "transcription": "soixante-trois",
      "interaction_id": "70000000-0000-4000-8000-000000000006",
      "message_ari_avant": {
        "interaction_id": "70000000-0000-4000-8000-000000000004",
        "texte": "Bravo ! Et 7 × 9 ?",
        "le": "2026-12-19T17:00:10Z"
      },
      "exercice": null,
      "etat": "ok",
      "url": "https://fake.supabase.co/storage/v1/object/sign/voix-stt/lot-96",
      "evaluation": {
        "verdict": "ok",
        "bon_texte": null,
        "commentaire": null,
        "evalue_le": "2026-12-20T08:00:00Z"
      }
    }
  ]
};

export const EXEMPLE_REECOUTE_EVALUER = {
  "prise_id": "50000000-0000-4000-8000-000000000001",
  "verdict": "pas_ok",
  "bon_texte": "cinquante six",
  "commentaire": null,
  "evalue_le": "2026-12-20T09:00:00.000Z"
};
