import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { ApiError, cleCache, creerApi, creerCache, transportHttp } from '../api.js';

Deno.test('cache : clé indépendante de l’ordre des params, distincte par env', () => {
  assertEquals(cleCache('prod', 'stats', { a: 1, b: 2 }), cleCache('prod', 'stats', { b: 2, a: 1 }));
  assertEquals(cleCache('prod', 'stats', {}) === cleCache('dev', 'stats', {}), false);
});

Deno.test('cache : expire après 5 min', () => {
  let t = 0;
  const cache = creerCache({ maintenant: () => t });
  cache.ecrire('k', 1);
  t = 5 * 60 * 1000;
  assertEquals(cache.lire('k'), 1);
  t += 1;
  assertEquals(cache.lire('k'), undefined);
});

Deno.test('api : réponse servie depuis le cache au second appel', async () => {
  let appels = 0;
  const api = creerApi({
    transport: async () => {
      appels += 1;
      return { sessions: 2, children: [], llm: null };
    },
  });
  await api.stats('prod', null, null);
  const s = await api.stats('prod', null, null);
  assertEquals([appels, s.sessionCount], [1, 2]);
  await api.stats('dev', null, null);
  assertEquals(appels, 2);
});

Deno.test('api : une requête annulée ne remplit pas le cache', async () => {
  let appels = 0;
  const api = creerApi({ transport: async () => { appels += 1; return { sessions: [] }; } });
  const ctrl = new AbortController();
  const p = api.sessions('prod', null, null, 'all', { signal: ctrl.signal });
  ctrl.abort();
  await assertRejects(() => p, DOMException);
  await api.sessions('prod', null, null, 'all');
  assertEquals(appels, 2);
});

Deno.test('api : 404 sur session_detail → null ; 403 propagé', async () => {
  const api = creerApi({
    transport: async (_env, action) => {
      throw new ApiError('x', action === 'session_detail' ? 404 : 403);
    },
  });
  assertEquals(await api.detail('prod', 'nope'), null);
  const e = await assertRejects(() => api.stats('dev', null, null), ApiError);
  assertEquals(e.status, 403);
});

Deno.test('transport : Bearer + apikey, corps {action, params} sans mot de passe', async () => {
  let vu;
  const transport = transportHttp(async () => 'jeton-123', async (url, init) => {
    vu = { url, init };
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  await transport('dev', 'stats', { from: 'x' });
  assertEquals(vu.url, 'https://mtuqpdtihltuuyemdyni.supabase.co/functions/v1/dashboard');
  assertEquals(vu.init.headers.Authorization, 'Bearer jeton-123');
  assertEquals(typeof vu.init.headers.apikey, 'string');
  assertEquals(JSON.parse(vu.init.body), { action: 'stats', params: { from: 'x' } });
});

Deno.test('transport : 401 / 403 / réseau → ApiError avec statut', async () => {
  const avec = (status) => transportHttp(async () => 'j', async () =>
    new Response(JSON.stringify({ error: 'refus' }), { status }));
  assertEquals((await assertRejects(() => avec(401)('prod', 'stats', {}), ApiError)).status, 401);
  assertEquals((await assertRejects(() => avec(403)('prod', 'stats', {}), ApiError)).status, 403);
  const reseau = transportHttp(async () => 'j', async () => { throw new TypeError('cors'); });
  assertEquals((await assertRejects(() => reseau('prod', 'stats', {}), ApiError)).status, 0);
  const sansJeton = transportHttp(async () => null, async () => { throw new Error('jamais'); });
  assertEquals((await assertRejects(() => sansJeton('prod', 'stats', {}), ApiError)).status, 401);
});
