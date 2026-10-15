import { assertEquals } from 'jsr:@std/assert@1';
import { adapterDetail } from '../api.js';
import { session_detail } from '../mock/session_detail.js';
import { filChronologique } from '../ui/fil-seance.js';

const tour = (id, createdAt) => ({ id, createdAt });
const ecran = (position, interactions) => ({ position, interactions });
// Fil résumé : « E2 » pour un intertitre (« E2↩ » si retour), l'id pour un tour.
const resume = (fil) => fil.map((x) => x.interaction ? x.interaction.id : 'E' + x.ecran.position + (x.retour ? '↩' : ''));

Deno.test('fil : aller-retour entre deux écrans → ordre de l’heure, intertitre à chaque changement', () => {
  // Écrans reçus dans l'ordre de leur 1re activité : tout l'écran 2 avant l'écran 3.
  const ecrans = [
    ecran(2, [tour('a', '2026-10-15T10:00:00Z'), tour('b', '2026-10-15T10:01:00Z'), tour('e', '2026-10-15T10:05:00Z')]),
    ecran(3, [tour('c', '2026-10-15T10:02:00Z'), tour('d', '2026-10-15T10:03:00Z')]),
  ];
  assertEquals(resume(filChronologique(ecrans)), ['E2', 'a', 'b', 'E3', 'c', 'd', 'E2↩', 'e']);
});

Deno.test('fil : égalité d’heure → ordre reçu (écrans puis position)', () => {
  const t = '2026-10-15T10:00:00Z';
  const ecrans = [ecran(1, [tour('a', t), tour('b', t)]), ecran(2, [tour('c', t)])];
  assertEquals(resume(filChronologique(ecrans)), ['E1', 'a', 'b', 'E2', 'c']);
});

Deno.test('fil : tour sans heure → reste derrière son voisin ; heures à décalage comparées en instant', () => {
  const ecrans = [
    ecran(1, [tour('a', '2026-10-15T10:00:00Z'), tour('b', null), tour('d', '2026-10-15T10:09:00Z')]),
    ecran(2, [tour('c', '2026-10-15T12:05:00+02:00')]), // = 10:05Z
  ];
  assertEquals(resume(filChronologique(ecrans)), ['E1', 'a', 'b', 'E2', 'c', 'E1↩', 'd']);
});

Deno.test('fil : écran sans mot à mot → pas d’intertitre ; aucun écran → fil vide', () => {
  assertEquals(resume(filChronologique([ecran(1, []), ecran(2, [tour('a', '2026-10-15T10:00:00Z')])])), ['E2', 'a']);
  assertEquals(filChronologique([]), []);
});

Deno.test('fil : mock Devoirs (ses-03) — heures croissantes, retour sur l’écran 2 après l’écran 3', () => {
  const seance = adapterDetail(session_detail({ session_id: 'ses-03' }));
  const fil = filChronologique(seance.ecrans);
  const heures = fil.filter((x) => x.interaction).map((x) => x.interaction.createdAt);
  assertEquals(heures, [...heures].sort());
  assertEquals(heures.length, seance.ecrans.reduce((n, e) => n + e.interactions.length, 0));
  const intertitres = fil.filter((x) => !x.interaction).map((x) => x.ecran.position + (x.retour ? '↩' : ''));
  assertEquals(intertitres, ['1', '5', '6', '2', '3', '2↩', '6↩', '4']);
});
