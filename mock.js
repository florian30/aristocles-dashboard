/* ============================================================
   Aristocles — Données factices (suivi des testeurs)
   Consommées uniquement par api.js, dans les formes de retour
   de la page (schéma socle : écrans + synthèses, bilan de
   séance, acquisitions, coûts LLM — jamais de verbatim).
   Les dates sont générées relativement à aujourd'hui pour que
   les filtres temporels restent pertinents quel que soit le
   jour d'ouverture.
   ============================================================ */
(function () {
  'use strict';

  const CHILDREN = [
    { id: 'c1', name: 'Lina', classe: 'CM1' },
    { id: 'c2', name: 'Maël', classe: 'CM1' },
    { id: 'c3', name: 'Adam', classe: 'CM1' },
    { id: 'c4', name: 'Chiara', classe: 'CM1' },
    { id: 'c5', name: 'Nina', classe: 'CM1' },
    { id: 'c6', name: 'Sacha', classe: 'CM1' },
    { id: 'c7', name: 'Léon', classe: 'CM1' },
  ];

  // Scénarios de séance : thème, notion principale, bilan rédigé et
  // suite d'écrans avec leur synthèse (valeurs socle brutes pour type,
  // statutFermeture, pouce, resultat, origine — libellés dans app.js).
  // "{name}" est remplacé par le prénom de l'enfant à la construction.
  const SCENARIOS = [
    // 0 — Les fractions (entraînement)
    {
      theme: 'Les fractions',
      notion: 'Les fractions',
      resume: "Séance solide sur les fractions. {name} mobilise bien la notion de parts et compare désormais deux fractions en passant par le même dénominateur — la méthode a été trouvée sans aide après une première réponse fondée sur la taille des nombres. Le placement d'une fraction supérieure à 1 sur la droite graduée résiste encore : à reprendre en début de prochaine séance.",
      ecrans: [
        {
          position: 1, type: 'vue_ensemble', statutFermeture: 'resolu_succes', pouce: null,
          synthese: "Rappel des acquis sur les parts : {name} restitue sans aide que 3/4 correspond à trois parts sur quatre.",
          exercices: [],
        },
        {
          position: 2, type: 'exercice', statutFermeture: 'resolu_succes', pouce: null,
          synthese: "Partage d'une tarte en quarts : la fraction restante est trouvée du premier coup, avec une justification correcte.",
          exercices: [
            { id: 'xr-101', enonce: "Une tarte est partagée en 4 parts égales. J'en mange 3. Quelle fraction de la tarte reste-t-il ?",
              resultat: 'succes', origine: 'entrainement_complementaire', dureeSec: 45, notions: ['Les fractions'] },
          ],
        },
        {
          position: 3, type: 'exercice', statutFermeture: 'resolu_fragile', pouce: null,
          synthese: "Comparaison de 2/3 et 3/4 : première réponse fondée sur la taille des nombres, puis passage au même dénominateur trouvé seul. La méthode est comprise mais pas encore automatique.",
          exercices: [
            { id: 'xr-102', enonce: "Range les fractions 2/3 et 3/4 de la plus petite à la plus grande. Justifie en les mettant au même dénominateur.",
              resultat: 'fragile', origine: 'entrainement_complementaire', dureeSec: 130, notions: ['Comparaison de fractions'] },
          ],
        },
        {
          position: 4, type: 'exercice', statutFermeture: 'abandon', pouce: null,
          synthese: "Placement de 5/4 sur la droite graduée : trois tentatives sans stabiliser la position. L'écran a été refermé pour ne pas décourager — à reprendre.",
          exercices: [
            { id: 'xr-103', enonce: "Place la fraction 5/4 sur la droite graduée.",
              resultat: 'abandon', origine: 'entrainement_complementaire', dureeSec: 185, notions: ['Fractions et droite graduée'] },
          ],
        },
      ],
      // Trace technique d'exemple (mode ?mock=1) : deux tours entrelacés
      // sur l'exercice de comparaison (xr-102) — le tour 9 (correction
      // vocale, PTT relancé) démarre son TTS avant que celui du tour 8
      // n'ait reçu de tts_fin. C'est la signature du bug visé par la
      // chronologie technique. offsetMs est relatif au début de la
      // session (converti en ts absolu ISO à la construction).
      evenements: [
        { seq: 1, type: 'trigger_envoye', offsetMs: 150200, ecranType: 'exercice', exerciseId: 'xr-102', detail: { tour: 7, origine: 'ptt' } },
        { seq: 2, type: 'tour_debut', offsetMs: 150400, ecranType: 'exercice', exerciseId: 'xr-102', detail: { tour: 7 } },
        { seq: 3, type: 'tour_fin', offsetMs: 152100, ecranType: 'exercice', exerciseId: 'xr-102', detail: { tour: 7 } },
        { seq: 4, type: 'tts_debut', offsetMs: 152300, ecranType: 'exercice', exerciseId: 'xr-102', detail: { tour: 7 } },
        { seq: 5, type: 'tts_fin', offsetMs: 154800, ecranType: 'exercice', exerciseId: 'xr-102', detail: { tour: 7 } },
        { seq: 6, type: 'trigger_envoye', offsetMs: 158000, ecranType: 'exercice', exerciseId: 'xr-102', detail: { tour: 8, origine: 'ptt' } },
        { seq: 7, type: 'tour_debut', offsetMs: 158250, ecranType: 'exercice', exerciseId: 'xr-102', detail: { tour: 8 } },
        { seq: 8, type: 'verdict_commit', offsetMs: 160900, ecranType: 'exercice', exerciseId: 'xr-102', detail: { tour: 8, resultat: 'fragile' } },
        { seq: 9, type: 'tts_debut', offsetMs: 161100, ecranType: 'exercice', exerciseId: 'xr-102', detail: { tour: 8 } },
        { seq: 10, type: 'trigger_envoye', offsetMs: 162400, ecranType: 'exercice', exerciseId: 'xr-102', detail: { tour: 9, type_trigger: 'correction' } },
        { seq: 11, type: 'tour_debut', offsetMs: 162600, ecranType: 'exercice', exerciseId: 'xr-102', detail: { tour: 9 } },
        { seq: 12, type: 'tts_debut', offsetMs: 162900, ecranType: 'exercice', exerciseId: 'xr-102', detail: { tour: 9 } },
      ],
    },
    // 1 — L'accord du participe passé (devoirs)
    {
      theme: "L'accord du participe passé",
      notion: "L'accord du participe passé",
      resume: "Devoirs de français traités en entier. {name} applique la règle de l'accord avec avoir en repérant la position du COD — d'abord avec un guidage, puis seul(e) sur la seconde phrase. La règle commence à tenir sans rappel.",
      ecrans: [
        {
          position: 1, type: 'captation', statutFermeture: 'resolu_succes', pouce: null,
          synthese: "Devoirs photographiés : deux phrases à compléter sur l'accord du participe passé avec l'auxiliaire avoir.",
          exercices: [],
        },
        {
          position: 2, type: 'exercice', statutFermeture: 'resolu_succes', pouce: null,
          synthese: "Première phrase : le COD « les lettres » est repéré avant le verbe, accord « écrites » justifié correctement après un rappel de la règle.",
          exercices: [
            { id: 'xr-201', enonce: "Complète en accordant le participe passé si nécessaire : « Les lettres que j'ai (écrire) … sont sur la table. »",
              resultat: 'succes', origine: 'devoir_scolaire', dureeSec: 95, notions: ["L'accord du participe passé"] },
          ],
        },
        {
          position: 3, type: 'exercice', statutFermeture: 'resolu_succes', pouce: null,
          synthese: "Seconde phrase : première réponse « mangées » corrigée seul(e) après avoir localisé le COD après le verbe.",
          exercices: [
            { id: 'xr-202', enonce: "Complète en accordant le participe passé si nécessaire : « Elles ont (manger) … une pomme. »",
              resultat: 'fragile', origine: 'devoir_scolaire', dureeSec: 80, notions: ["L'accord du participe passé"] },
          ],
        },
        {
          position: 4, type: 'bilan_session', statutFermeture: 'resolu_succes', pouce: null,
          synthese: "Bilan : règle du COD placé avant le verbe restituée correctement en fin de séance.",
          exercices: [],
        },
      ],
    },
    // 2 — La division posée (entraînement)
    {
      theme: 'La division posée',
      notion: 'La division posée',
      resume: "Bonne séance de calcul posé. {name} enchaîne les étapes de la division sans erreur de table et vérifie spontanément son résultat par la multiplication. Sur la division avec reste, un reste supérieur au diviseur a d'abord été accepté, puis corrigé après une seule question.",
      ecrans: [
        {
          position: 1, type: 'exercice', statutFermeture: 'resolu_succes', pouce: null,
          synthese: "452 ÷ 4 posé et résolu sans aide, vérification par la multiplication proposée spontanément.",
          exercices: [
            { id: 'xr-301', enonce: 'Pose et effectue la division : 452 ÷ 4.',
              resultat: 'succes', origine: 'entrainement_complementaire', dureeSec: 150, notions: ['La division posée'] },
          ],
        },
        {
          position: 2, type: 'exercice', statutFermeture: 'resolu_fragile', pouce: null,
          synthese: "517 ÷ 3 : premier quotient avec un reste supérieur au diviseur, corrigé seul après la question « un reste peut-il dépasser le diviseur ? ».",
          exercices: [
            { id: 'xr-302', enonce: 'Pose et effectue : 517 ÷ 3. Indique le quotient et le reste.',
              resultat: 'fragile', origine: 'entrainement_complementaire', dureeSec: 210, notions: ['Division avec reste'] },
          ],
        },
      ],
    },
    // 3 — La proportionnalité (entraînement)
    {
      theme: 'La proportionnalité',
      notion: 'La proportionnalité',
      resume: "Très bonne séance : {name} utilise le passage par l'unité sans qu'on le lui demande, y compris pour juger une offre commerciale. La notion progresse nettement.",
      ecrans: [
        {
          position: 1, type: 'vue_ensemble', statutFermeture: 'resolu_succes', pouce: null,
          synthese: "Situation d'entrée sur les prix : la stratégie « diviser pour trouver le prix d'un croissant » est verbalisée d'emblée.",
          exercices: [],
        },
        {
          position: 2, type: 'exercice', statutFermeture: 'resolu_succes', pouce: 'haut',
          synthese: "Passage par l'unité maîtrisé : prix d'un croissant puis de sept, calculés sans hésitation.",
          exercices: [
            { id: 'xr-401', enonce: '3 croissants coûtent 3,60 €. Combien coûte 1 croissant ?',
              resultat: 'succes', origine: 'entrainement_complementaire', dureeSec: 40, notions: ['La proportionnalité'] },
            { id: 'xr-402', enonce: "En utilisant le prix d'un croissant, calcule le prix de 7 croissants.",
              resultat: 'succes', origine: 'entrainement_complementaire', dureeSec: 55, notions: ['La proportionnalité'] },
          ],
        },
        {
          position: 3, type: 'pont_entrainement', statutFermeture: 'resolu_succes', pouce: null,
          synthese: "Transfert : l'offre « 10 croissants pour 10 € » est jugée avantageuse par comparaison au prix unitaire.",
          exercices: [],
        },
      ],
    },
    // 4 — Les homophones (séance courte, sans bilan rédigé)
    {
      theme: 'Les homophones grammaticaux',
      notion: 'Les homophones grammaticaux',
      resume: null, // vieille session sans bilan → le front affiche « — »
      ecrans: [
        {
          position: 1, type: 'exercice', statutFermeture: 'resolu_succes', pouce: null,
          synthese: "« a / à » : distinction justifiée par la substitution avec « avait ».",
          exercices: [
            { id: 'xr-501', enonce: 'Complète avec « a » ou « à » : « Il ___ mangé ___ midi. »',
              resultat: 'succes', origine: 'entrainement_libre', dureeSec: 35, notions: ['Les homophones grammaticaux'] },
          ],
        },
        {
          position: 2, type: 'exercice', statutFermeture: 'en_cours', pouce: null,
          synthese: null, // écran encore ouvert : pas de synthèse → « — »
          exercices: [
            { id: 'xr-502', enonce: 'Complète avec « son » ou « sont » : « Ils ___ partis avec ___ chien. »',
              resultat: 'fragile', origine: 'entrainement_libre', dureeSec: 70, notions: ['Les homophones grammaticaux'] },
          ],
        },
      ],
    },
  ];

  // [joursAvantAujourdhui, heure, childId, mode, duréeMin, scenarioIdx]
  // duréeMin null = session active (comme côté serveur).
  const SESSION_SEEDS = [
    [0,  '18:05', 'c5', 'entrainement', null, 4],
    [0,  '17:40', 'c1', 'entrainement', 18, 0],
    [0,  '10:05', 'c2', 'devoirs',      14, 1],
    [1,  '18:15', 'c3', 'entrainement', 22, 2],
    [1,  '09:30', 'c5', 'entrainement', 12, 4],
    [2,  '17:00', 'c4', 'entrainement', 19, 3],
    [2,  '11:20', 'c6', 'entrainement', 16, 0],
    [3,  '18:30', 'c2', 'devoirs',      21, 1],
    [3,  '10:15', 'c7', 'entrainement', 13, 2],
    [4,  '17:35', 'c1', 'entrainement', 24, 0],
    [6,  '11:00', 'c3', 'entrainement', 17, 2],
    [6,  '09:40', 'c4', 'devoirs',      15, 3],
    [7,  '18:00', 'c6', 'entrainement', 20, 0],
    [8,  '17:30', 'c1', 'entrainement', 16, 1],
    [8,  '10:30', 'c2', 'entrainement', 12, 4],
    [10, '17:45', 'c7', 'devoirs',      18, 2],
    [12, '10:00', 'c5', 'entrainement', 14, 3],
  ];

  function isoDaysAgo(n) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  const childById = Object.fromEntries(CHILDREN.map((c) => [c.id, c]));

  const SESSIONS = SESSION_SEEDS.map((seed, i) => {
    const [daysAgo, time, childId, mode, durationMin, scenarioIdx] = seed;
    const name = childById[childId].name;
    const scenario = SCENARIOS[scenarioIdx];
    const fill = (text) => (text == null ? null : text.split('{name}').join(name));
    const dateStr = isoDaysAgo(daysAgo);
    // Début de session en ms, pour convertir les offsets de la
    // chronologie technique (scenario.evenements) en ts ISO absolus.
    const startMs = new Date(dateStr + 'T' + time + ':00').getTime();
    return {
      id: 'ses-' + String(i + 1).padStart(2, '0'),
      childId,
      date: dateStr,
      time,
      mode, // 'devoirs' | 'entrainement'
      status: durationMin == null ? 'active' : 'archivee',
      durationMin, // null = session active
      theme: scenario.theme,
      notion: scenario.notion,
      resume: fill(scenario.resume),
      ecrans: scenario.ecrans.map((e) => ({
        ...e,
        synthese: fill(e.synthese),
        exercices: e.exercices.map((x) => ({ ...x, notions: [...x.notions] })),
      })),
      evenements: (scenario.evenements || []).map((e) => ({
        seq: e.seq,
        type: e.type,
        ts: new Date(startMs + e.offsetMs).toISOString(),
        ecranType: e.ecranType || null,
        exerciseId: e.exerciseId || null,
        detail: e.detail ? { ...e.detail } : null,
      })),
    };
  });

  // Acquisitions par enfant (mémoire, indépendante de la plage) —
  // c6 volontairement vide pour couvrir le cas « liste maigre ».
  const ACQUISITIONS = {
    c1: [
      { notion: 'Les fractions', maitrise: 'acquise', vuEnClasse: 'presume_vu', majDate: isoDaysAgo(0) },
      { notion: 'Comparaison de fractions', maitrise: 'en_cours', vuEnClasse: 'presume_vu', majDate: isoDaysAgo(0) },
      { notion: 'Fractions et droite graduée', maitrise: 'fragile', vuEnClasse: 'non_determine', majDate: isoDaysAgo(0) },
      { notion: "L'accord du participe passé", maitrise: 'en_cours', vuEnClasse: 'presume_vu', majDate: isoDaysAgo(8) },
    ],
    c2: [
      { notion: "L'accord du participe passé", maitrise: 'en_cours', vuEnClasse: 'presume_vu', majDate: isoDaysAgo(0) },
      { notion: 'Les homophones grammaticaux', maitrise: 'acquise', vuEnClasse: 'presume_vu', majDate: isoDaysAgo(8) },
    ],
    c3: [
      { notion: 'La division posée', maitrise: 'acquise', vuEnClasse: 'presume_vu', majDate: isoDaysAgo(1) },
      { notion: 'Division avec reste', maitrise: 'en_cours', vuEnClasse: 'non_determine', majDate: isoDaysAgo(1) },
    ],
    c4: [
      { notion: 'La proportionnalité', maitrise: 'en_cours', vuEnClasse: 'presume_non_vu', majDate: isoDaysAgo(2) },
    ],
    c5: [
      { notion: 'La proportionnalité', maitrise: 'parfaitement_acquise', vuEnClasse: 'presume_vu', majDate: isoDaysAgo(12) },
      { notion: 'Les homophones grammaticaux', maitrise: 'jamais_vue', vuEnClasse: 'non_determine', majDate: isoDaysAgo(0) },
    ],
    c6: [],
    c7: [
      { notion: 'La division posée', maitrise: 'fragile', vuEnClasse: 'presume_vu', majDate: isoDaysAgo(3) },
    ],
  };

  // Coûts LLM (forme de retour de getStats().llm, statique).
  const LLM = {
    totalEur: 3.4162,
    calls: 412,
    tokensInput: 1842300,
    tokensOutput: 236480,
    perRole: [
      { role: 'tutor', eur: 2.1074, calls: 236, tokensInput: 1204500, tokensOutput: 148200 },
      { role: 'synthese_ecran', eur: 0.7842, calls: 118, tokensInput: 402600, tokensOutput: 61800 },
      { role: 'bilan_session', eur: 0.3411, calls: 37, tokensInput: 168400, tokensOutput: 21300 },
      { role: 'vision_devoirs', eur: 0.1835, calls: 21, tokensInput: 66800, tokensOutput: 5180 },
    ],
  };

  globalThis.ARISTOCLES_MOCK = {
    children: CHILDREN,
    sessions: SESSIONS,
    acquisitions: ACQUISITIONS,
    llm: LLM,
  };
})();
