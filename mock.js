/* ============================================================
   Aristocles — Données factices (suivi des testeurs)
   Consommées uniquement par api.js. Les dates sont générées
   relativement à aujourd'hui pour que les filtres temporels
   restent pertinents quel que soit le jour d'ouverture.
   ============================================================ */
(function () {
  'use strict';

  const CHILDREN = [
    { id: 'c1', name: 'Lina' },
    { id: 'c2', name: 'Maël' },
    { id: 'c3', name: 'Adam' },
    { id: 'c4', name: 'Chiara' },
    { id: 'c5', name: 'Nina' },
    { id: 'c6', name: 'Sacha' },
    { id: 'c7', name: 'Léon' },
  ];

  // Éléments de fil chronologique :
  //   { type: 'ari',      text }
  //   { type: 'child',    text }
  //   { type: 'exercise', exerciseId, notion, level, attempts, success, statement, visual }
  //   { type: 'mastery',  notion, from, to }
  // "{name}" est remplacé par le prénom de l'enfant à la construction.
  const TRANSCRIPTS = [
    // 0 — Les fractions (entraînement)
    [
      { type: 'ari', text: "Salut {name}. On continue sur les fractions aujourd'hui. Tu te souviens de ce qu'on a vu la dernière fois ?" },
      { type: 'child', text: "Oui, les parts. 3/4 c'est trois parts sur quatre." },
      { type: 'ari', text: "Exactement. Alors dis-moi : si je partage une tarte en quatre parts égales et que j'en mange trois, quelle fraction reste-t-il ?" },
      { type: 'child', text: "Il reste une part… donc 1/4." },
      { type: 'exercise', exerciseId: 'EX-1042', notion: 'Les fractions', level: 'CM1', attempts: 1, success: true,
        statement: "Une tarte est partagée en 4 parts égales. J'en mange 3. Quelle fraction de la tarte reste-t-il ?",
        visual: "Un disque découpé en quatre parts égales, dont trois sont grisées." },
      { type: 'ari', text: "Bien vu. Maintenant, une question plus difficile : entre 2/3 et 3/4, laquelle est la plus grande ?" },
      { type: 'child', text: "2/3, parce que 2 et 3 sont plus petits." },
      { type: 'ari', text: "Intéressant. Qu'est-ce qui compte le plus : la taille des nombres, ou la taille des parts ? Essaie de mettre les deux fractions sur le même dénominateur." },
      { type: 'child', text: "Euh… 2/3 ça fait 8/12 et 3/4 ça fait 9/12." },
      { type: 'ari', text: "Alors, laquelle est la plus grande ?" },
      { type: 'child', text: "3/4 !" },
      { type: 'exercise', exerciseId: 'EX-1043', notion: 'Comparaison de fractions', level: 'CM1', attempts: 2, success: true,
        statement: "Range les fractions 2/3 et 3/4 de la plus petite à la plus grande. Justifie en les mettant au même dénominateur.",
        visual: "Deux barres de même longueur, l'une partagée en trois parts, l'autre en quatre." },
      { type: 'mastery', notion: 'Les fractions', from: 'En cours', to: 'Acquis' },
      { type: 'ari', text: "Tu as buté au départ, c'est normal — comparer des fractions demande de passer par le même dénominateur. Tu l'as trouvé sans aide." },
      { type: 'child', text: "C'était pas si dur en fait." },
      { type: 'ari', text: "On garde cette méthode pour demain. Un dernier exercice pour finir ?" },
      { type: 'child', text: "D'accord." },
      { type: 'exercise', exerciseId: 'EX-1044', notion: 'Fractions et droite graduée', level: 'CM1', attempts: 3, success: false,
        statement: "Place la fraction 5/4 sur la droite graduée.",
        visual: "Une droite graduée de 0 à 2, graduée en quarts, avec un curseur déplaçable." },
      { type: 'ari', text: "Celui-ci résiste encore. On le reprendra au début de la prochaine séance." },
    ],
    // 1 — L'accord du participe passé (devoirs)
    [
      { type: 'ari', text: "Bonjour {name}. Tu as des devoirs de français aujourd'hui. On regarde la première phrase ensemble ?" },
      { type: 'child', text: "« Les lettres que j'ai écrit »… écrite ? écrites ?" },
      { type: 'ari', text: "Bonne question. Avec l'auxiliaire avoir, quand est-ce qu'on accorde le participe passé ?" },
      { type: 'child', text: "Quand le COD est avant le verbe ?" },
      { type: 'ari', text: "Oui. Alors ici, quel est le COD, et où est-il ?" },
      { type: 'child', text: "« les lettres »… avant le verbe. Donc « écrites »." },
      { type: 'exercise', exerciseId: 'EX-2210', notion: "L'accord du participe passé", level: 'CM1', attempts: 1, success: true,
        statement: "Complète en accordant le participe passé si nécessaire : « Les lettres que j'ai (écrire) … sont sur la table. »",
        visual: null },
      { type: 'ari', text: "Exactement. Essayons une autre : « Elles ont mangé une pomme. »" },
      { type: 'child', text: "Mangées ?" },
      { type: 'ari', text: "Où est le COD dans cette phrase ?" },
      { type: 'child', text: "« une pomme », après le verbe… donc « mangé », sans accord." },
      { type: 'exercise', exerciseId: 'EX-2211', notion: "L'accord du participe passé", level: 'CM1', attempts: 2, success: true,
        statement: "Complète en accordant le participe passé si nécessaire : « Elles ont (manger) … une pomme. »",
        visual: null },
      { type: 'mastery', notion: "L'accord du participe passé", from: 'Fragile', to: 'En cours' },
      { type: 'ari', text: "Tu progresses. La règle commence à tenir toute seule." },
    ],
    // 2 — La division posée (entraînement)
    [
      { type: 'ari', text: "Salut {name}. On s'entraîne sur la division posée. 452 divisé par 4, tu poses ?" },
      { type: 'child', text: "4 divisé par 4, ça fait 1. Ensuite 5 divisé par 4… 1, et il reste 1." },
      { type: 'ari', text: "Continue." },
      { type: 'child', text: "12 divisé par 4, ça fait 3. Donc 113." },
      { type: 'exercise', exerciseId: 'EX-3105', notion: 'La division posée', level: 'CM1', attempts: 1, success: true,
        statement: "Pose et effectue la division : 452 ÷ 4.",
        visual: "Une potence de division déjà tracée, avec le dividende 452 et le diviseur 4." },
      { type: 'ari', text: "Et comment vérifier ton résultat sans refaire le calcul ?" },
      { type: 'child', text: "On multiplie 113 par 4 ?" },
      { type: 'ari', text: "Vas-y." },
      { type: 'child', text: "452. C'est bon !" },
      { type: 'ari', text: "Une plus difficile : 517 divisé par 3." },
      { type: 'child', text: "171… reste 4." },
      { type: 'ari', text: "Un reste peut-il être plus grand que le diviseur ?" },
      { type: 'child', text: "Non… alors 172, reste 1." },
      { type: 'exercise', exerciseId: 'EX-3108', notion: 'Division avec reste', level: 'CM1', attempts: 2, success: true,
        statement: "Pose et effectue : 517 ÷ 3. Indique le quotient et le reste.",
        visual: null },
      { type: 'ari', text: "Bien. On s'arrête là pour aujourd'hui." },
    ],
    // 3 — La proportionnalité (entraînement)
    [
      { type: 'ari', text: "Bonjour {name}. Aujourd'hui, la proportionnalité. Si 3 croissants coûtent 3,60 €, combien coûte un croissant ?" },
      { type: 'child', text: "1,20 €." },
      { type: 'ari', text: "Comment tu l'as trouvé ?" },
      { type: 'child', text: "J'ai divisé par 3." },
      { type: 'exercise', exerciseId: 'EX-4021', notion: 'La proportionnalité', level: 'CM1', attempts: 1, success: true,
        statement: "3 croissants coûtent 3,60 €. Combien coûte 1 croissant ?",
        visual: "Un tableau de proportionnalité à deux lignes : nombre de croissants, prix en euros." },
      { type: 'ari', text: "Alors combien coûtent 7 croissants ?" },
      { type: 'child', text: "7 fois 1,20… 8,40 €." },
      { type: 'exercise', exerciseId: 'EX-4022', notion: 'La proportionnalité', level: 'CM1', attempts: 1, success: true,
        statement: "En utilisant le prix d'un croissant, calcule le prix de 7 croissants.",
        visual: null },
      { type: 'ari', text: "Et si la boulangerie propose « 10 croissants pour 10 € », c'est une bonne affaire ?" },
      { type: 'child', text: "10 fois 1,20 ça ferait 12 €… donc oui !" },
      { type: 'mastery', notion: 'La proportionnalité', from: 'Fragile', to: 'En cours' },
      { type: 'ari', text: "Tu as utilisé le passage par l'unité sans que je te le demande. C'est exactement la bonne méthode." },
    ],
    // 4 — Les homophones (séance courte)
    [
      { type: 'ari', text: "Salut {name}. Une séance courte sur les homophones. « a » ou « à » : « Il ___ mangé ___ midi. »" },
      { type: 'child', text: "« Il a mangé à midi. »" },
      { type: 'ari', text: "Comment tu choisis entre les deux ?" },
      { type: 'child', text: "Si on peut dire « avait », c'est le verbe avoir." },
      { type: 'exercise', exerciseId: 'EX-5310', notion: 'Les homophones grammaticaux', level: 'CM1', attempts: 1, success: true,
        statement: "Complète avec « a » ou « à » : « Il ___ mangé ___ midi. »",
        visual: null },
      { type: 'ari', text: "« Son » ou « sont » : « Ils ___ partis avec ___ chien. »" },
      { type: 'child', text: "« Ils son partis »… non, « sont », c'est le verbe être." },
      { type: 'exercise', exerciseId: 'EX-5311', notion: 'Les homophones grammaticaux', level: 'CM1', attempts: 2, success: true,
        statement: "Complète avec « son » ou « sont » : « Ils ___ partis avec ___ chien. »",
        visual: null },
      { type: 'ari', text: "Bien. C'est tout pour aujourd'hui — c'était rapide et propre." },
    ],
  ];

  // [joursAvantAujourdhui, heure, childId, mode, duréeMin, transcriptIdx]
  const SESSION_SEEDS = [
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
    const [daysAgo, time, childId, mode, durationMin, transcriptIdx] = seed;
    const name = childById[childId].name;
    const timeline = TRANSCRIPTS[transcriptIdx].map((item) =>
      item.type === 'ari' || item.type === 'child'
        ? { ...item, text: item.text.split('{name}').join(name) }
        : { ...item }
    );
    return {
      id: 'ses-' + String(i + 1).padStart(2, '0'),
      childId,
      date: isoDaysAgo(daysAgo),
      time,
      mode, // 'entrainement' | 'devoirs'
      durationMin,
      timeline,
    };
  });

  globalThis.ARISTOCLES_MOCK = { children: CHILDREN, sessions: SESSIONS };
})();
