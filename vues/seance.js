/* ============================================================
   Lecteur de séance (action `session_detail`) : bilan, fil des
   écrans, chronologie technique, acquisitions.
   Route `…/tour/{llm_generation_id}` : la trace IA d'un tour
   arrivera au lot 5 ; le lecteur l'annonce en tête.
   ============================================================ */

import { construireHash } from '../router.js';
import { serialiserDetail } from '../ui/detail.js';
import { el, etatAVenir, etatErreur, lien, repliable, tableau } from '../ui/dom.js';
import { fmtDuree, fmtDureeSec, fmtHorodatagePrecis, fmtJour, fmtJourHeure, pluriel } from '../ui/format.js';
import {
  LIBELLE_FERMETURE,
  LIBELLE_MAITRISE,
  LIBELLE_MODE,
  LIBELLE_ORIGINE,
  LIBELLE_RESULTAT,
  LIBELLE_STATUT,
  LIBELLE_TYPE_ECRAN,
  LIBELLE_VU_EN_CLASSE,
} from '../ui/libelles.js';

export const titre = 'Séance';

export async function rendre({ route, api, signal }) {
  const seance = await api.detail(route.env, route.sessionId, { signal });
  const retour = lien(construireHash({ env: route.env, vue: 'seances', query: route.query }), 'reader-back', '← Retour aux séances');

  const vue = el('div', 'vue reader');
  vue.append(retour);
  if (!seance) {
    vue.append(etatErreur('Séance introuvable', 'Aucune séance « ' + route.sessionId + ' » sur ' + route.env + '.'));
    return vue;
  }

  const tete = el('div', 'reader-head');
  const titres = el('div', 'reader-titles');
  titres.append(
    el('h1', 'page-title', seance.childName),
    el('div', 'reader-sub', 'Thème : ' + (seance.theme || '—') + ' · Notion principale : ' + (seance.notion || '—')),
  );
  tete.append(titres, el('div', 'reader-meta', [
    fmtJourHeure(seance.date, seance.time),
    LIBELLE_MODE[seance.mode] || seance.mode,
    seance.classe,
    LIBELLE_STATUT[seance.status] || seance.status,
    seance.durationMin == null ? null : fmtDuree(seance.durationMin),
    pluriel(seance.exerciseCount, 'exercice'),
  ].filter(Boolean).join(' · ')));
  vue.append(tete);

  const corps = el('div', 'reader-body');
  vue.append(corps);

  if (route.generationId) {
    corps.append(etatAVenir('Trace IA du tour ' + route.generationId,
      'La relecture détaillée d’un tour (prompt, réponse, coût) arrivera avec la relecture de séance.', 'lot 5'));
  }

  const bilan = el('section', 'resume-card');
  bilan.append(el('span', 'eyebrow', 'Bilan de séance'),
    el('p', 'resume-text' + (seance.resume ? '' : ' is-empty'), seance.resume || '—'));
  corps.append(bilan);

  corps.append(el('h2', 'section-title', 'Fil de la séance'));
  if (seance.ecrans.length === 0) corps.append(el('p', 'reader-empty', 'Aucun écran pour cette séance.'));
  for (const ecran of seance.ecrans) corps.append(carteEcran(ecran));

  // Chronologie technique : absente tant qu'aucun événement n'est journalisé.
  if (seance.evenements.length > 0) corps.append(carteChronologie(seance.evenements));

  corps.append(el('h2', 'section-title', 'Acquisitions'));
  corps.append(tableauAcquisitions(seance.acquisitions));
  return vue;
}

function carteEcran(ecran) {
  const carte = el('section', 'ecran-card');
  const tete = el('div', 'ecran-head');
  tete.append(el('span', 'ecran-title',
    'Écran ' + ecran.position + ' · ' + (LIBELLE_TYPE_ECRAN[ecran.type] || ecran.type)));
  const drapeaux = el('div', 'ecran-flags');
  const fermeture = LIBELLE_FERMETURE[ecran.statutFermeture];
  drapeaux.append(
    el('span', 'chip ' + (fermeture ? fermeture.cls : 'is-muted'), fermeture ? fermeture.label : (ecran.statutFermeture || '—')),
    // pouce_enfant : toujours null aujourd'hui, se remplira seul (lot F5).
    el('span', 'pouce', ecran.pouce === 'haut' ? '👍' : ecran.pouce === 'bas' ? '👎' : 'Pouce —'),
  );
  tete.append(drapeaux);

  const contenu = el('div', 'ecran-body');
  contenu.append(el('p', 'ecran-synthese' + (ecran.synthese ? '' : ' is-empty'), ecran.synthese || '—'));
  for (const x of ecran.exercices) contenu.append(carteExercice(x));
  carte.append(tete, contenu);
  return carte;
}

function carteExercice(x) {
  const identite = el('div', 'exercise-id');
  identite.append(
    el('span', 'exercise-notion', x.notions.length ? x.notions.join(' · ') : 'Exercice'),
    el('span', 'exercise-meta', [LIBELLE_ORIGINE[x.origine] || x.origine, fmtDureeSec(x.dureeSec)].filter(Boolean).join(' · ')),
  );
  const resultat = LIBELLE_RESULTAT[x.resultat];
  const verdict = el('span', 'verdict ' + (resultat ? resultat.cls : 'is-muted'), resultat ? resultat.label : x.resultat);

  if (!x.enonce) {
    const carte = el('div', 'exercise-card');
    const resume = el('div', 'repliable-resume');
    resume.append(identite, verdict);
    carte.append(resume);
    return carte;
  }
  const bloc = el('div', 'exercise-detail-block');
  bloc.append(el('span', 'eyebrow', 'Énoncé'), el('p', null, x.enonce));
  return repliable({ classe: 'exercise-card', entete: [identite, verdict], contenu: [bloc] });
}

// Trace brute du pipeline voix (déclencheurs, tours, TTS). Les
// `detail` imbriqués sortent en JSON indenté.
function carteChronologie(evenements) {
  const liste = el('ol', 'chrono-events');
  for (const ev of evenements) {
    const item = el('li', 'chrono-event');
    const { ligne, blocs } = serialiserDetail(ev.detail);
    item.append(el('span', 'chrono-ligne',
      fmtHorodatagePrecis(ev.ts) + ' · ' + ev.type + (ligne ? ' · ' + ligne : '')));
    for (const b of blocs) item.append(el('pre', 'chrono-json', (b.cle ? b.cle + ' : ' : '') + b.json));
    liste.append(item);
  }
  return repliable({
    classe: 'chrono-card',
    entete: [el('span', 'chrono-title', 'Chronologie technique'), el('span', 'chrono-count', pluriel(evenements.length, 'événement'))],
    contenu: [liste],
  });
}

function tableauAcquisitions(acquisitions) {
  return tableau({
    classe: 'acq-table',
    colonnes: [
      { titre: 'Notion' },
      { titre: 'Maîtrise', largeur: '180px' },
      { titre: 'Vu en classe', largeur: '140px' },
      { titre: 'Mise à jour', classe: 'cell-right', largeur: '120px' },
    ],
    lignes: acquisitions.map((a) => {
      const m = LIBELLE_MAITRISE[a.maitrise];
      return [
        el('span', 'row-name', a.notion || '—'),
        el('span', 'acq-maitrise ' + (m ? m.cls : ''), m ? m.label : a.maitrise),
        LIBELLE_VU_EN_CLASSE[a.vuEnClasse] || a.vuEnClasse,
        a.majDate ? fmtJour(a.majDate) : '—',
      ];
    }),
    // Liste maigre attendue hors CM1 tant que le pont notions (F1) manque.
    vide: 'Aucune acquisition enregistrée pour cet enfant.',
  });
}
