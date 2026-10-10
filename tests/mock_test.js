import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { ApiError, creerApi } from '../api.js';
import { transportMock } from '../mock/transport.js';
import { detailEnTexte } from '../ui/detail.js';
import { decalerJour, hierParis } from '../ui/paris.js';
import { fmtVolume, volumesRole } from '../ui/unites.js';

const api = (opts = {}) => creerApi({
  transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0, ...opts }),
});

Deno.test('mock : coûts d’aperçu traversent les adaptateurs, unités stt/tts respectées', async () => {
  const to = hierParis();
  const a = await api().apercu('prod', decalerJour(to, -6), to);
  const parRole = Object.fromEntries(a.couts.parRole.map((r) => [r.role, r]));
  assert(volumesRole(parRole.stt).entree.endsWith('d’audio'));
  assert(volumesRole(parRole.tts).entree.endsWith(' caractères'));
  assertEquals(parRole['vision-parser'].eur, null);
  assert(a.couts.appelsCoutInconnu > 0);
  assert(a.couts.volumesHorsTokens.every((v) => !fmtVolume(v.total, v.unite).includes('token')));
});

Deno.test('mock : l’action stats n’existe plus (400)', async () => {
  const transport = transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 });
  const e = await assertRejects(() => transport('prod', 'stats', {}), ApiError);
  assertEquals(e.status, 400);
});

Deno.test('mock : liste et détail de séance, detail imbriqué sérialisable', async () => {
  const a = api();
  const { seances: liste } = await a.sessions('dev', null, null, 'all');
  assert(liste.length > 0);
  const avecTrace = liste.find((x) => x.id === 'ses-02');
  const d = await a.detail('dev', avecTrace.id);
  assert(d.evenements.length > 0);
  for (const e of d.evenements) assert(!detailEnTexte(e.detail).includes('[object Object]'));
  assertEquals(await a.detail('dev', 'inconnue'), null);
});

Deno.test('mock : 401 non connecté, 403 non autorisé', async () => {
  const e401 = await assertRejects(() => api({ estConnecte: () => false }).enfants('prod'), ApiError);
  assertEquals(e401.status, 401);
  const e403 = await assertRejects(() => api({ estAutorise: () => false }).enfants('dev'), ApiError);
  assertEquals(e403.status, 403);
});
