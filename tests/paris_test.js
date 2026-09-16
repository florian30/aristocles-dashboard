import { assertEquals } from 'jsr:@std/assert@1';
import {
  bornesParis, debutJourParisMs, decalerJour, estDateCivile, fmtJourTitre, heureParis, hierParis, navigationJour,
} from '../ui/paris.js';
import { periodeDepuisQuery } from '../ui/periode.js';

Deno.test('paris : hier suit le jour civil de Paris, pas le fuseau de la machine', () => {
  // 15 sept. 22:30 UTC = 16 sept. 00:30 à Paris : hier = 15.
  assertEquals(hierParis(new Date('2026-09-15T22:30:00Z')), '2026-09-15');
  // 15 sept. 21:59 UTC = 15 sept. 23:59 à Paris : hier = 14.
  assertEquals(hierParis(new Date('2026-09-15T21:59:00Z')), '2026-09-14');
  // Hiver (UTC+1) et 1er mars.
  assertEquals(hierParis(new Date('2026-03-01T00:30:00Z')), '2026-02-28');
  assertEquals(hierParis(new Date('2026-01-01T23:30:00Z')), '2026-01-01');
});

Deno.test('paris : décalage de jours et dates civiles', () => {
  assertEquals(decalerJour('2026-02-28', 1), '2026-03-01');
  assertEquals(decalerJour('2026-01-01', -1), '2025-12-31');
  assertEquals(estDateCivile('2026-02-30'), false);
  assertEquals(estDateCivile('2026-02-28'), true);
});

Deno.test('paris : minuit de Paris en UTC, été, hiver et changements d’heure', () => {
  assertEquals(new Date(debutJourParisMs('2026-07-10')).toISOString(), '2026-07-09T22:00:00.000Z');
  assertEquals(new Date(debutJourParisMs('2026-01-10')).toISOString(), '2026-01-09T23:00:00.000Z');
  assertEquals(new Date(debutJourParisMs('2026-03-29')).toISOString(), '2026-03-28T23:00:00.000Z');
  assertEquals(new Date(debutJourParisMs('2026-10-25')).toISOString(), '2026-10-24T22:00:00.000Z');
  assertEquals(heureParis('2026-07-10T17:00:00Z'), '19:00');
});

Deno.test('paris : bornes de plage incluses, jamais plus de 92 jours', () => {
  assertEquals(bornesParis('2026-07-10', '2026-07-11'),
    { from: '2026-07-09T22:00:00.000Z', to: '2026-07-11T21:59:59.999Z' });
  // 92 jours traversant le retour à l'heure d'hiver : plafonné à 92 j exactement.
  const b = bornesParis('2026-08-01', '2026-10-31');
  assertEquals(new Date(b.to) - new Date(b.from) <= 92 * 86400000, true);
});

Deno.test('veille : navigation de jour, suivant jusqu’à aujourd’hui seulement', () => {
  const maintenant = new Date('2026-09-16T07:00:00Z');
  assertEquals(navigationJour('2026-09-15', maintenant),
    { precedent: '2026-09-14', suivant: '2026-09-16', aujourdhui: '2026-09-16', hier: '2026-09-15', estFutur: false });
  assertEquals(navigationJour('2026-09-16', maintenant).suivant, null);
  assertEquals(navigationJour('2026-03-01', maintenant).precedent, '2026-02-28');
  assertEquals(fmtJourTitre('2026-09-15', maintenant), 'mardi 15 septembre');
  assertEquals(fmtJourTitre('2025-09-15', maintenant), 'lundi 15 septembre 2025');
});

Deno.test('période : raccourcis 7/30/92 j, personnalisée plafonnée à 92 jours', () => {
  const now = new Date('2026-09-16T07:00:00Z');
  assertEquals(periodeDepuisQuery({}, now), { cle: '7j', from: '2026-09-10', to: '2026-09-16', jours: 7, plafonnee: false });
  assertEquals(periodeDepuisQuery({ periode: '92j' }, now).from, '2026-06-17');
  assertEquals(periodeDepuisQuery({ from: '2026-01-01', to: '2026-09-16' }, now),
    { cle: 'perso', from: '2026-06-17', to: '2026-09-16', jours: 92, plafonnee: true });
  assertEquals(periodeDepuisQuery({ from: '2026-09-12', to: '2026-09-01' }, now),
    { cle: 'perso', from: '2026-09-01', to: '2026-09-12', jours: 12, plafonnee: false });
  assertEquals(periodeDepuisQuery({ from: 'nimp', periode: '30j' }, now).cle, '30j');
});
