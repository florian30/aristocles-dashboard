import { assertEquals } from 'jsr:@std/assert@1';
import { cheminBarre, echelle, geometrieBarres, indicesEtiquettes } from '../ui/graphe.js';

Deno.test('graphe : échelle ronde, entière, couvrant le maximum', () => {
  assertEquals(echelle(0), { max: 1, pas: 1, graduations: [0, 1] });
  assertEquals(echelle(3), { max: 3, pas: 1, graduations: [0, 1, 2, 3] });
  assertEquals(echelle(7), { max: 10, pas: 5, graduations: [0, 5, 10] });
  const e = echelle(47);
  assertEquals(e.max >= 47 && e.max % e.pas === 0 && e.graduations.at(-1) === e.max, true);
  assertEquals(echelle(47), { max: 60, pas: 20, graduations: [0, 20, 40, 60] });
  assertEquals(echelle(271).max, 300);
});

Deno.test('graphe : géométrie des barres (hauteur proportionnelle, ≤ 24 px, base commune)', () => {
  const barres = geometrieBarres(
    [{ jour: 'a', valeur: 0 }, { jour: 'b', valeur: 5 }, { jour: 'c', valeur: 10 }],
    { largeur: 300, hauteur: 100, gauche: 10, haut: 5, max: 10 },
  );
  assertEquals(barres.map((b) => b.hauteur), [0, 50, 100]);
  assertEquals(barres.map((b) => b.y + b.hauteur), [105, 105, 105]);
  assertEquals(barres.every((b) => b.largeur === 24), true);
  assertEquals(barres[0].x, 10 + (100 - 24) / 2);
  const serrees = geometrieBarres(Array.from({ length: 92 }, (_, i) => ({ jour: String(i), valeur: 1 })), { largeur: 184, hauteur: 10, max: 1 });
  assertEquals(serrees[0].largeur, 1);
  assertEquals(geometrieBarres([], { largeur: 1, hauteur: 1, max: 1 }), []);
});

Deno.test('graphe : étiquettes (début, fin, repères) et barre vide sans tracé', () => {
  assertEquals(indicesEtiquettes(3), [0, 1, 2]);
  assertEquals(indicesEtiquettes(30), [0, 7, 15, 22, 29]);
  assertEquals(indicesEtiquettes(0), []);
  assertEquals(cheminBarre({ x: 0, y: 10, largeur: 10, hauteur: 0 }), '');
  assertEquals(cheminBarre({ x: 0, y: 0, largeur: 10, hauteur: 20 }).startsWith('M0,20V4'), true);
});
