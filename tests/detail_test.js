import { assert, assertEquals } from 'jsr:@std/assert@1';
import { detailEnTexte, serialiserDetail } from '../ui/detail.js';

Deno.test('detail : paires scalaires sur une ligne', () => {
  assertEquals(serialiserDetail({ tour: 7, origine: 'ptt', ok: true, x: null }),
    { ligne: 'tour:7 origine:ptt ok:true x:null', blocs: [] });
});

Deno.test('detail : absent → vide', () => {
  assertEquals(serialiserDetail(null), { ligne: '', blocs: [] });
  assertEquals(serialiserDetail(undefined), { ligne: '', blocs: [] });
});

Deno.test('detail : objet imbriqué → JSON indenté, jamais [object Object]', () => {
  const detail = { tour: 9, latences: { stt_ms: 420, llm_ms: 1310 }, essais: [1, 2] };
  const { ligne, blocs } = serialiserDetail(detail);
  assertEquals(ligne, 'tour:9');
  assertEquals(blocs, [
    { cle: 'latences', json: '{\n  "stt_ms": 420,\n  "llm_ms": 1310\n}' },
    { cle: 'essais', json: '[\n  1,\n  2\n]' },
  ]);
  const texte = detailEnTexte(detail);
  assert(!texte.includes('[object Object]'), texte);
  assertEquals(JSON.parse(texte.split('latences: ')[1].split('\nessais')[0]), detail.latences);
});

Deno.test('detail : tableau ou scalaire à la racine', () => {
  assertEquals(detailEnTexte([{ a: 1 }]), '[\n  {\n    "a": 1\n  }\n]');
  assertEquals(detailEnTexte('brut'), 'brut');
});
