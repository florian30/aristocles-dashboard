// Quiz de leçon en Devoirs (DASH-QUIZ) : questions, verdicts, carte
// « Un petit quiz ? » et résumé, à partir des données déjà reçues.
import { assertEquals } from 'jsr:@std/assert@1';
import { adapterDetail } from '../api.js';
import { session_detail } from '../mock/session_detail.js';
import { filChronologique } from '../ui/fil-seance.js';
import { cartesQuiz, prefixeQuestion, questionQuiz, resumeQuiz, texteCarte, texteVerdict } from '../ui/quiz.js';

const question = (numero, total) => ({ type: 'message_tuteur', locuteur: 'ari', metadata: { source: 'quizz', numero, total } });
const verdict = (numero, v, relances) => ({ type: 'reponse_quizz', locuteur: 'systeme', metadata: { numero, verdict: v, ...(relances != null ? { relances } : {}) } });
const ev = (type, ts, detail) => ({ type, ts, detail });

Deno.test('quiz : question repérée par metadata.source, préfixe « Quiz · question N/T »', () => {
  assertEquals(questionQuiz(question(2, 5)), { numero: 2, total: 5 });
  assertEquals(prefixeQuestion(questionQuiz(question(2, 5))), 'Quiz · question 2/5');
  assertEquals(prefixeQuestion({ numero: 3, total: null }), 'Quiz · question 3');
  assertEquals(questionQuiz({ type: 'message_tuteur', metadata: null }), null);
  assertEquals(questionQuiz({ type: 'message_tuteur', metadata: { source: 'llm' } }), null);
  assertEquals(questionQuiz({ type: 'message_enfant_vocal', metadata: { source: 'quizz', numero: 1 } }), null);
});

Deno.test('quiz : verdict lisible, relances seulement si connues et non nulles', () => {
  assertEquals(texteVerdict(verdict(1, 'juste').metadata), 'Quiz · question 1 : juste');
  assertEquals(texteVerdict(verdict(2, 'pas_trouve').metadata), 'Quiz · question 2 : pas trouvée');
  assertEquals(texteVerdict(verdict(2, 'pas_trouve', 2).metadata), 'Quiz · question 2 : pas trouvée après 2 relances');
  assertEquals(texteVerdict(verdict(3, 'juste', 1).metadata), 'Quiz · question 3 : juste après 1 relance');
  assertEquals(texteVerdict(verdict(1, 'juste', 0).metadata), 'Quiz · question 1 : juste');
  assertEquals(texteVerdict(null), 'Quiz · question ? : —');
});

Deno.test('quiz : carte — un seul événement par tour (trigger_envoye + tour_debut), autres triggers ignorés', () => {
  const cartes = cartesQuiz([
    ev('trigger_envoye', '2026-10-15T10:00:00Z', { tour: 4, type_trigger: 'devoirs_quizz_non' }),
    ev('tour_debut', '2026-10-15T10:00:00.2Z', { tour: 4, origine: 'trigger', type_trigger: 'devoirs_quizz_non' }),
    ev('trigger_envoye', '2026-10-15T10:01:00Z', { tour: 5, type_trigger: 'correction' }),
    ev('tour_fin', '2026-10-15T10:01:30Z', { tour: 5 }),
    ev('trigger_envoye', '2026-10-15T10:02:00Z', { tour: 6, type_trigger: 'devoirs_quizz_pas_pret' }),
  ]);
  assertEquals(cartes, [
    { createdAt: '2026-10-15T10:00:00Z', choix: 'devoirs_quizz_non' },
    { createdAt: '2026-10-15T10:02:00Z', choix: 'devoirs_quizz_pas_pret' },
  ]);
  assertEquals(cartes.map((c) => texteCarte(c.choix)), ['Carte quiz : refusée', 'Carte quiz : quiz pas prêt']);
  assertEquals(texteCarte('devoirs_quizz_accepte'), 'Carte quiz : acceptée');
  assertEquals(cartesQuiz(null), []);
});

Deno.test('quiz : résumé — N/T justes avec verdicts, sinon selon la carte', () => {
  const tours = [question(1, 3), verdict(1, 'juste'), question(2, 3), verdict(2, 'pas_trouve', 1), question(3, 3), verdict(3, 'juste')];
  assertEquals(resumeQuiz(tours), 'Quiz : 2/3 justes');
  // Quiz interrompu : le total annoncé reste le dénominateur.
  assertEquals(resumeQuiz([question(1, 3), verdict(1, 'juste')]), 'Quiz : 1/3 juste');
  // Verdict renvoyé deux fois pour la même question : compté une fois.
  assertEquals(resumeQuiz([verdict(1, 'pas_trouve'), verdict(1, 'juste')]), 'Quiz : 1/1 juste');
  assertEquals(resumeQuiz([], [{ choix: 'devoirs_quizz_non' }]), 'Quiz proposé, refusé');
  assertEquals(resumeQuiz([], [{ choix: 'devoirs_quizz_pas_pret' }]), 'Quiz proposé, pas prêt');
  assertEquals(resumeQuiz([], [{ choix: 'devoirs_quizz_accepte' }]), 'Quiz accepté, sans réponse enregistrée');
  assertEquals(resumeQuiz([{ type: 'message_tuteur', metadata: null }]), null);
});

Deno.test('quiz : fil — la carte se glisse à son heure sans intertitre ni casser l’ordre', () => {
  const ecrans = [
    { position: 1, interactions: [{ id: 'a', createdAt: '2026-10-15T10:00:00Z' }, { id: 'b', createdAt: '2026-10-15T10:02:00Z' }] },
    { position: 2, interactions: [{ id: 'c', createdAt: '2026-10-15T10:03:00Z' }] },
  ];
  const cartes = [{ createdAt: '2026-10-15T10:01:00Z', choix: 'devoirs_quizz_accepte' }, { createdAt: null, choix: 'devoirs_quizz_non' }];
  const resume = filChronologique(ecrans, cartes)
    .map((x) => x.extra ? 'carte' : x.interaction ? x.interaction.id : 'E' + x.ecran.position + (x.retour ? '↩' : ''));
  assertEquals(resume, ['E1', 'a', 'carte', 'b', 'E2', 'c']);
});

Deno.test('quiz : mock Devoirs (ses-03) — carte, questions et verdicts dans le fil, résumé 1/2', () => {
  const seance = adapterDetail(session_detail({ session_id: 'ses-03' }));
  const cartes = cartesQuiz(seance.evenements);
  assertEquals(cartes.map((c) => c.choix), ['devoirs_quizz_accepte']);
  const fil = filChronologique(seance.ecrans, cartes);
  const lignes = fil.flatMap((x) => {
    if (x.extra) return [texteCarte(x.extra.choix)];
    const i = x.interaction;
    if (!i) return [];
    const q = questionQuiz(i);
    if (q) return [prefixeQuestion(q)];
    return i.type === 'reponse_quizz' ? [texteVerdict(i.metadata)] : [];
  });
  assertEquals(lignes, [
    'Carte quiz : acceptée',
    'Quiz · question 1/2',
    'Quiz · question 1 : juste',
    'Quiz · question 2/2',
    'Quiz · question 2 : pas trouvée après 2 relances',
  ]);
  assertEquals(resumeQuiz(seance.ecrans.flatMap((e) => e.interactions), cartes), 'Quiz : 1/2 juste');
  assertEquals(resumeQuiz(seance.ecrans.find((e) => e.position === 5).interactions), 'Quiz : 1/2 juste');
});
