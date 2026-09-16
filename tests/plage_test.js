import { assertEquals } from 'jsr:@std/assert@1';
import { plageDepuisQuery, sansPlage } from '../ui/plage.js';

Deno.test('plage : raccourcis, dates explicites et défaut 7 jours', () => {
  const now = new Date(2026, 8, 16, 9, 0);
  assertEquals(plageDepuisQuery({}, now), { cle: '7j', from: '2026-09-10', to: '2026-09-16' });
  assertEquals(plageDepuisQuery({ periode: 'hier' }, now), { cle: 'hier', from: '2026-09-15', to: '2026-09-15' });
  assertEquals(plageDepuisQuery({ periode: 'tout' }, now), { cle: 'tout', from: null, to: null });
  assertEquals(plageDepuisQuery({ periode: '7j', from: '2026-09-01', to: 'nimp' }, now),
    { cle: 'perso', from: '2026-09-01', to: null });
  assertEquals(sansPlage({ periode: '7j', from: 'a', to: 'b', child: 'c1' }), { child: 'c1' });
});
