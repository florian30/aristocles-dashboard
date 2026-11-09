/* ============================================================
   Aristocles — Quiz de leçon en Devoirs (DASH-QUIZ)
   Aucune donnée nouvelle : tout arrive déjà dans `session_detail`.
   - question : `message_tuteur` avec metadata { source: 'quizz',
     numero, total } ;
   - verdict : `reponse_quizz`, contenu NULL, metadata { numero,
     verdict: 'juste' | 'pas_trouve', relances? } ;
   - carte « Un petit quiz ? » : événement client `trigger_envoye` /
     `tour_debut` dont detail.type_trigger est l'un des trois de
     CARTE_QUIZ (les deux événements d'un même tour n'en font qu'un).
   ============================================================ */

export const CARTE_QUIZ = {
  devoirs_quizz_accepte: 'acceptée',
  devoirs_quizz_non: 'refusée',
  devoirs_quizz_pas_pret: 'quiz pas prêt',
};

const entier = (v) => (Number.isInteger(v) ? v : null);

// { numero, total } si l'interaction est une question du quiz, sinon null.
export function questionQuiz(i) {
  const m = i && i.metadata;
  if (!i || i.type !== 'message_tuteur' || !m || m.source !== 'quizz') return null;
  return { numero: entier(m.numero), total: entier(m.total) };
}

export function prefixeQuestion({ numero, total }) {
  if (numero == null) return 'Quiz';
  return 'Quiz · question ' + numero + (total != null ? '/' + total : '');
}

// « Quiz · question 2 : pas trouvée après 2 relances ».
export function texteVerdict(metadata) {
  const m = metadata || {};
  const verdict = m.verdict === 'juste' ? 'juste' : m.verdict === 'pas_trouve' ? 'pas trouvée' : (m.verdict || '—');
  const relances = entier(m.relances);
  return 'Quiz · question ' + (entier(m.numero) ?? '?') + ' : ' + verdict +
    (relances ? ' après ' + relances + ' relance' + (relances > 1 ? 's' : '') : '');
}

export const texteCarte = (choix) => 'Carte quiz : ' + (CARTE_QUIZ[choix] || choix);

// Événements de la carte quiz, un par tour, à leur heure.
// → [{ createdAt, choix }] dans l'ordre reçu.
export function cartesQuiz(evenements) {
  const cartes = [];
  const vus = new Set();
  for (const ev of evenements || []) {
    const choix = ev.detail && ev.detail.type_trigger;
    if (!(choix in CARTE_QUIZ) || !ev.ts) continue;
    const cle = choix + '|' + (ev.detail.tour ?? ev.ts);
    if (vus.has(cle)) continue;
    vus.add(cle);
    cartes.push({ createdAt: ev.ts, choix });
  }
  return cartes;
}

// Résumé d'une liste d'interactions (+ cartes si connues) :
// « Quiz : 2/3 justes » dès qu'un verdict existe, sinon selon la carte.
export function resumeQuiz(interactions, cartes = []) {
  const verdicts = new Map();
  let total = null;
  let questions = 0;
  for (const i of interactions) {
    const q = questionQuiz(i);
    if (q) questions++;
    if (q && q.total != null) total = Math.max(total ?? 0, q.total);
    if (i.type === 'reponse_quizz' && i.metadata) verdicts.set(i.metadata.numero, i.metadata.verdict);
  }
  if (verdicts.size) {
    const justes = [...verdicts.values()].filter((v) => v === 'juste').length;
    return 'Quiz : ' + justes + '/' + Math.max(total ?? 0, verdicts.size) + ' juste' + (justes > 1 ? 's' : '');
  }
  const choix = new Set(cartes.map((c) => c.choix));
  if (questions || choix.has('devoirs_quizz_accepte')) return 'Quiz accepté, sans réponse enregistrée';
  if (choix.has('devoirs_quizz_non')) return 'Quiz proposé, refusé';
  if (choix.has('devoirs_quizz_pas_pret')) return 'Quiz proposé, pas prêt';
  return null;
}
