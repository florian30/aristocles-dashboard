import { assertEquals } from 'jsr:@std/assert@1';
import { creerApi } from '../api.js';
import { transportMock } from '../mock/transport.js';
import { isoJoursAvant } from '../ui/format.js';
import {
  filtrerParMode, filtresActifs, modeDepuisQuery, optionsEnfants, optionsModes, queryReinitialisee,
} from '../ui/seances-filtres.js';

const apiMock = () => creerApi({
  transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }),
});

const s = (id, childId, childName, mode) => ({ id, childId, childName, mode });
const LISTE = [
  s('1', 'c1', 'Lina', 'entrainement'),
  s('2', 'c2', 'Maël', 'devoirs'),
  s('3', 'c1', 'Lina', 'dictee'),
  s('4', 'c3', 'Adam', 'entrainement'),
];

Deno.test('filtre Mode : garde le mode choisi, aucun mode = tout', () => {
  assertEquals(filtrerParMode(LISTE, 'entrainement').map((x) => x.id), ['1', '4']);
  assertEquals(filtrerParMode(LISTE, 'dictee').map((x) => x.id), ['3']);
  assertEquals(filtrerParMode(LISTE, null), LISTE);
  assertEquals(modeDepuisQuery({ mode: 'devoirs' }), 'devoirs');
  assertEquals(modeDepuisQuery({}), null);
  // Valeurs proposées : modes présents, dans l'ordre des libellés ; le choisi reste.
  assertEquals(optionsModes(LISTE), [
    { mode: 'devoirs', libelle: 'Devoirs' }, { mode: 'entrainement', libelle: 'Entraînement' }, { mode: 'dictee', libelle: 'Dictée' },
  ]);
  assertEquals(optionsModes([LISTE[0]], 'dictee').map((o) => o.mode), ['entrainement', 'dictee']);
});

Deno.test('filtre Enfant : child_id envoyé à l’Edge, enfants proposés = présents dans la plage', async () => {
  const recus = [];
  const api = creerApi({ transport: async (_env, action, params) => {
    recus.push({ action, params });
    return { sessions: [] };
  } });
  await api.sessions('prod', null, null, 'c2');
  assertEquals(recus[0].params, { child_id: 'c2' });

  const { seances } = await apiMock().sessions('prod', null, null, 'c1');
  assertEquals(new Set(seances.map((x) => x.childId)), new Set(['c1']));

  // Jules (c8, inscrit, jamais venu) n'est pas proposé ; tri par prénom.
  const { seances: toutes } = await apiMock().sessions('prod', null, null, null);
  const noms = optionsEnfants(toutes).map((e) => e.name);
  assertEquals(noms.includes('Jules'), false);
  assertEquals(noms, [...noms].sort((a, b) => a.localeCompare(b, 'fr')));
  assertEquals(optionsEnfants(LISTE).map((e) => e.childId), ['c3', 'c1', 'c2']);
  // L'enfant choisi reste proposé même sans séance sur la plage.
  assertEquals(optionsEnfants([], 'c9'), [{ childId: 'c9', name: 'Enfant choisi' }]);
});

Deno.test('combinaison date + enfant + mode, puis réinitialisation', async () => {
  const api = apiMock();
  const from = isoJoursAvant(3);
  const to = isoJoursAvant(0);
  const { seances } = await api.sessions('prod', from, to, 'c1');
  const dictees = filtrerParMode(seances, 'dictee');
  // Mock : Lina (c1) a 2 dictées sur 0–3 jours (J-1 et J-3), aucune autre enfant.
  assertEquals(dictees.length, 2);
  for (const x of dictees) {
    assertEquals([x.childId, x.mode], ['c1', 'dictee']);
    assertEquals(x.date >= from && x.date <= to, true);
  }
  // Hors plage (J-4) : l'entraînement de Lina n'y est pas.
  assertEquals(filtrerParMode(seances, 'entrainement').every((x) => x.date >= from), true);

  const query = { from, to, child: 'c1', mode: 'dictee', sans_echange: '1' };
  assertEquals(filtresActifs(query), true);
  assertEquals(queryReinitialisee(query), { sans_echange: '1' });
  assertEquals(filtresActifs(queryReinitialisee(query)), false);
  assertEquals(filtresActifs({ periode: '7j' }), false);
  assertEquals(filtresActifs({ periode: 'tout' }), true);
});
