import { assertEquals } from 'jsr:@std/assert@1';
import { libelleEcran, rangConsigne } from '../ui/rang.js';

const ecrans = [
  { position: 1, type: 'captation' },
  { position: 2, type: 'vue_ensemble' },
  { position: 3, type: 'exercice' },
  { position: 5, type: 'exercice' },
  { position: 6, type: 'exercice' },
  { position: 7, type: 'bilan_session' },
];

Deno.test('rang : Devoirs → 1..n parmi les écrans exercice', () => {
  const s = { mode: 'devoirs', ecrans };
  assertEquals([3, 5, 6].map((p) => rangConsigne(s, { type: 'exercice', position: p })), [1, 2, 3]);
  assertEquals(libelleEcran(s, ecrans[3]), 'Consigne 2');
});

Deno.test('rang : Devoirs → autres types non numérotés', () => {
  const s = { mode: 'devoirs', ecrans };
  assertEquals(rangConsigne(s, ecrans[0]), null);
  assertEquals(libelleEcran(s, ecrans[5]), 'Écran 7');
});

Deno.test('rang : Apprentissage inchangé', () => {
  const s = { mode: 'entrainement', ecrans };
  assertEquals(libelleEcran(s, ecrans[3]), 'Écran 5');
});

Deno.test('rang : écran exercice introuvable → libellé Écran', () => {
  assertEquals(libelleEcran({ mode: 'devoirs', ecrans }, { type: 'exercice', position: 9 }), 'Écran 9');
});
