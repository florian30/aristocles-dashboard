/* ============================================================
   Aristocles — Petit graphe en barres par jour (SVG fait main)
   `echelle` et `geometrieBarres` sont pures (testées sous Deno) ;
   `grapheBarres` crée le SVG par createElementNS, textes par
   textContent. Une série = un graphe (petits multiples) : jamais
   deux échelles sur le même axe.
   ============================================================ */

import { fmtJourCourt } from './paris.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Échelle « ronde » : max ≥ valeurMax, graduations régulières (pas 1-2-5).
export function echelle(valeurMax, nbGraduationsCible = 3) {
  if (!(valeurMax > 0)) return { max: 1, pas: 1, graduations: [0, 1] };
  const brut = valeurMax / nbGraduationsCible;
  const puissance = Math.pow(10, Math.floor(Math.log10(brut)));
  const pas = [1, 2, 5, 10].map((m) => m * puissance).find((p) => p >= brut);
  const pasEntier = Math.max(1, Math.round(pas)); // comptes : jamais de demi-séance
  const max = Math.ceil(valeurMax / pasEntier) * pasEntier;
  const graduations = [];
  for (let v = 0; v <= max; v += pasEntier) graduations.push(v);
  return { max, pas: pasEntier, graduations };
}

// Géométrie des barres dans une zone de tracé (coordonnées SVG).
// points : [{ jour, valeur }] → barres [{ jour, valeur, x, y, largeur, hauteur }]
export function geometrieBarres(points, { largeur, hauteur, gauche = 0, haut = 0, max }) {
  const n = points.length;
  if (!n) return [];
  const bande = largeur / n;
  const epaisseur = Math.max(1, Math.min(24, bande - 2)); // ≤ 24 px, 2 px d'air minimum
  return points.map((p, i) => {
    const h = max > 0 ? (Math.max(0, p.valeur) / max) * hauteur : 0;
    return {
      jour: p.jour,
      valeur: p.valeur,
      x: gauche + i * bande + (bande - epaisseur) / 2,
      y: haut + hauteur - h,
      largeur: epaisseur,
      hauteur: h,
    };
  });
}

// Indices des jours étiquetés sous l'axe : début, fin, et quelques repères.
export function indicesEtiquettes(n, maxEtiquettes = 5) {
  if (n <= 0) return [];
  if (n <= maxEtiquettes) return [...Array(n).keys()];
  const pas = (n - 1) / (maxEtiquettes - 1);
  return [...new Set([...Array(maxEtiquettes).keys()].map((i) => Math.round(i * pas)))];
}

// Chemin d'une barre : coins arrondis en haut, base carrée.
export function cheminBarre({ x, y, largeur, hauteur }, rayon = 4) {
  if (hauteur <= 0) return '';
  const r = Math.min(rayon, largeur / 2, hauteur);
  const bas = y + hauteur;
  return 'M' + x + ',' + bas + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
    'H' + (x + largeur - r) + 'Q' + (x + largeur) + ',' + y + ' ' + (x + largeur) + ',' + (y + r) +
    'V' + bas + 'Z';
}

function svg(tag, attributs = {}, texte) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attributs)) n.setAttribute(k, String(v));
  if (texte != null) n.textContent = texte;
  return n;
}

// serie : [{ jour, valeur }] ; libelle : titre de la série ;
// infobulle(point) → texte du survol (élément <title>).
export function grapheBarres({ serie, libelle, formatValeur = String, infobulle }) {
  const L = 320, H = 132;
  const marge = { gauche: 30, droite: 6, haut: 8, bas: 22 };
  const zone = { largeur: L - marge.gauche - marge.droite, hauteur: H - marge.haut - marge.bas };
  const ech = echelle(Math.max(0, ...serie.map((p) => p.valeur)));

  const racine = svg('svg', { viewBox: '0 0 ' + L + ' ' + H, class: 'graphe', role: 'img' });
  racine.append(svg('title', {}, libelle));

  for (const g of ech.graduations) {
    const y = marge.haut + zone.hauteur - (g / ech.max) * zone.hauteur;
    racine.append(
      svg('line', { x1: marge.gauche, x2: L - marge.droite, y1: y, y2: y, class: g === 0 ? 'graphe-base' : 'graphe-grille' }),
      svg('text', { x: marge.gauche - 6, y: y + 3.5, class: 'graphe-axe', 'text-anchor': 'end' }, formatValeur(g)),
    );
  }

  const barres = geometrieBarres(serie, { largeur: zone.largeur, hauteur: zone.hauteur, gauche: marge.gauche, haut: marge.haut, max: ech.max });
  const bande = zone.largeur / Math.max(1, serie.length);
  barres.forEach((b, i) => {
    const groupe = svg('g', { class: 'graphe-point' });
    // Cible de survol : toute la bande, même pour une barre à zéro.
    groupe.append(svg('rect', { x: marge.gauche + i * bande, y: marge.haut, width: bande, height: zone.hauteur, class: 'graphe-cible' }));
    const d = cheminBarre(b);
    if (d) groupe.append(svg('path', { d, class: 'graphe-barre' }));
    groupe.append(svg('title', {}, infobulle ? infobulle(serie[i]) : fmtJourCourt(b.jour) + ' : ' + formatValeur(b.valeur)));
    racine.append(groupe);
  });

  for (const i of indicesEtiquettes(serie.length)) {
    const b = barres[i];
    const ancre = serie.length === 1 ? 'middle' : i === 0 ? 'start' : i === serie.length - 1 ? 'end' : 'middle';
    const x = ancre === 'start' ? marge.gauche + i * bande : ancre === 'end' ? marge.gauche + (i + 1) * bande : b.x + b.largeur / 2;
    racine.append(svg('text', { x, y: H - 6, class: 'graphe-axe', 'text-anchor': ancre }, fmtJourCourt(b.jour)));
  }
  return racine;
}
