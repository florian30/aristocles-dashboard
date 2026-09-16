/* Familles — liste et fiche enfant (contenu au lot 4). */

import { construireHash } from '../router.js';
import { el, etatAVenir, lien } from '../ui/dom.js';

export const titre = 'Familles';

export async function rendre({ route }) {
  const vue = el('div', 'vue vue-familles');
  if (route.childId) {
    vue.append(lien(construireHash({ env: route.env, vue: 'familles' }), 'reader-back', '← Retour aux familles'));
    vue.append(el('h1', 'page-title', 'Fiche enfant'));
    vue.append(etatAVenir('Fiche de l’enfant ' + route.childId,
      'Parcours, séances, acquisitions et échanges avec la famille, sur une seule page.', 'lot 4'));
  } else {
    vue.append(el('h1', 'page-title', titre));
    vue.append(etatAVenir('Les familles testeuses',
      'Chaque famille, ses enfants, leur activité récente et l’accès à la fiche de chaque enfant.', 'lot 4'));
  }
  return vue;
}
