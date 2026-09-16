/* Santé & coûts (contenu au lot 5). */

import { el, etatAVenir } from '../ui/dom.js';

export const titre = 'Santé & coûts';

export async function rendre() {
  const vue = el('div', 'vue vue-sante');
  vue.append(el('h1', 'page-title', titre), etatAVenir('Santé technique et coûts',
    'Erreurs, latences et coûts IA dans le temps. Les coûts agrégés restent visibles dans la Vue d’ensemble.', 'lot 5'));
  return vue;
}
