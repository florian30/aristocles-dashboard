import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { ApiError, creerApi } from '../api.js';
import { transportMock } from '../mock/transport.js';
import { detailEnTexte } from '../ui/detail.js';
import { fmtVolume, volumesRole } from '../ui/unites.js';

const api = (opts = {}) => creerApi({
  transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0, ...opts }),
});

Deno.test('mock : stats traversent les adaptateurs, unités stt/tts respectées', async () => {
  const s = await api().stats('prod', null, null);
  assert(s.sessionCount > 0);
  const parRole = Object.fromEntries(s.llm.parRole.map((r) => [r.role, r]));
  assertEquals(volumesRole(parRole.stt).entree, '1 h 02 d’audio');
  assert(volumesRole(parRole.tts).entree.endsWith(' caractères'));
  assertEquals(parRole.vision_devoirs.eur, null);
  assertEquals(s.llm.appelsCoutInconnu, 21);
  assert(s.llm.volumesHorsTokens.every((v) => !fmtVolume(v.total, v.unite).includes('token')));
});

Deno.test('mock : liste et détail de séance, detail imbriqué sérialisable', async () => {
  const a = api();
  const liste = await a.sessions('dev', null, null, 'all');
  assert(liste.length > 0);
  const avecTrace = liste.find((x) => x.id === 'ses-02');
  const d = await a.detail('dev', avecTrace.id);
  assert(d.evenements.length > 0);
  for (const e of d.evenements) assert(!detailEnTexte(e.detail).includes('[object Object]'));
  assertEquals(await a.detail('dev', 'inconnue'), null);
});

Deno.test('mock : 401 non connecté, 403 non autorisé', async () => {
  const e401 = await assertRejects(() => api({ estConnecte: () => false }).stats('prod', null, null), ApiError);
  assertEquals(e401.status, 401);
  const e403 = await assertRejects(() => api({ estAutorise: () => false }).stats('dev', null, null), ApiError);
  assertEquals(e403.status, 403);
});
