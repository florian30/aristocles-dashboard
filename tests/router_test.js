import { assertEquals } from 'jsr:@std/assert@1';
import { analyserHash, construireHash } from '../router.js';

Deno.test('routeur : hash vide → prod par défaut, veille sans date, à réécrire', () => {
  for (const hash of ['', '#', '#/', '#/inconnu/apercu']) {
    const r = analyserHash(hash);
    assertEquals([r.env, r.vue, r.date, r.canonique], ['prod', 'veille', null, false], hash);
  }
});

Deno.test('routeur : env dev conservé, vue inconnue → veille', () => {
  const r = analyserHash('#/dev/nimporte');
  assertEquals([r.env, r.vue, r.canonique], ['dev', 'veille', false]);
});

Deno.test('routeur : analyse de chaque forme de route', () => {
  assertEquals(analyserHash('#/prod/veille/2026-09-15'),
    { env: 'prod', vue: 'veille', date: '2026-09-15', query: {}, canonique: true });
  assertEquals(analyserHash('#/dev/veille/pas-une-date').date, null);
  assertEquals(analyserHash('#/prod/apercu?from=2026-09-01&to=2026-09-07'),
    { env: 'prod', vue: 'apercu', query: { from: '2026-09-01', to: '2026-09-07' }, canonique: true });
  assertEquals(analyserHash('#/prod/familles'),
    { env: 'prod', vue: 'familles', childId: null, query: {}, canonique: true });
  assertEquals(analyserHash('#/prod/familles/c-42').childId, 'c-42');
  assertEquals(analyserHash('#/dev/seances'),
    { env: 'dev', vue: 'seances', sessionId: null, generationId: null, query: {}, canonique: true });
  assertEquals(analyserHash('#/dev/seances/ses-01'),
    { env: 'dev', vue: 'seances', sessionId: 'ses-01', generationId: null, query: {}, canonique: true });
  assertEquals(analyserHash('#/dev/seances/ses-01/tour/gen-9'),
    { env: 'dev', vue: 'seances', sessionId: 'ses-01', generationId: 'gen-9', query: {}, canonique: true });
  assertEquals(analyserHash('#/prod/sante'), { env: 'prod', vue: 'sante', query: {}, canonique: true });
});

Deno.test('routeur : segments superflus → non canonique', () => {
  assertEquals(analyserHash('#/prod/apercu/truc').canonique, false);
  assertEquals(analyserHash('#/prod/seances/ses-01/tour').canonique, false);
});

Deno.test('routeur : fabrication d’URL', () => {
  assertEquals(construireHash({ env: 'prod', vue: 'veille', date: '2026-09-15' }), '#/prod/veille/2026-09-15');
  assertEquals(construireHash({ env: 'dev', vue: 'apercu', query: { from: '2026-09-01', to: '', child: null } }),
    '#/dev/apercu?from=2026-09-01');
  assertEquals(construireHash({ env: 'prod', vue: 'familles', childId: 'c 1' }), '#/prod/familles/c%201');
  assertEquals(construireHash({ env: 'prod', vue: 'seances', sessionId: 's1', generationId: 'g2' }),
    '#/prod/seances/s1/tour/g2');
  assertEquals(construireHash({ env: 'prod', vue: 'sante', sessionId: 's1' }), '#/prod/sante');
  assertEquals(construireHash({ env: 'staging', vue: 'bidon' }), '#/prod/veille');
});

Deno.test('routeur : aller-retour analyse ↔ fabrication', () => {
  for (const hash of [
    '#/prod/veille/2026-09-15',
    '#/dev/apercu?from=2026-09-01&to=2026-09-07',
    '#/prod/familles/c%201',
    '#/dev/seances/ses-01/tour/gen-9',
    '#/prod/seances?child=c2',
    '#/dev/sante',
  ]) {
    assertEquals(construireHash(analyserHash(hash)), hash);
  }
});
