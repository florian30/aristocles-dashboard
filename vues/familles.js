/* ============================================================
   Familles (action `enfants`) : tous les enfants inscrits, e-mail
   du parent, activité des 92 derniers jours, étoiles. Tri par
   dernière activité ; chaque ligne ouvre la fiche (vues/enfant.js).
   ============================================================ */

import { construireHash } from '../router.js';
import { el, tableau } from '../ui/dom.js';
import { fmtEntier, pluriel } from '../ui/format.js';
import { fmtInstantParis, fmtJourCourt, jourParis } from '../ui/paris.js';

export const titre = 'Familles';

export async function rendre({ route, api, signal }) {
  const { enfants } = await api.enfants(route.env, null, null, { signal });

  const vue = el('div', 'vue vue-familles');
  const tete = el('div', 'page-head');
  const actifs = enfants.filter((e) => e.seances > 0).length;
  tete.append(el('h1', 'page-title', titre),
    el('span', 'page-count', pluriel(enfants.length, 'enfant') + ' · ' + actifs + (actifs > 1 ? ' actifs' : ' actif') + ' sur les 92 derniers jours'));
  vue.append(tete);

  vue.append(tableau({
    classe: 'familles-table',
    colonnes: [
      { titre: 'Prénom', largeur: 'minmax(110px, 0.9fr)' },
      { titre: 'Classe', largeur: '64px' },
      { titre: 'E-mail du parent', largeur: 'minmax(180px, 1.6fr)' },
      { titre: 'Créé le', largeur: '96px' },
      { titre: 'Dernière activité', largeur: '130px' },
      { titre: 'Séances', classe: 'cell-right', largeur: '72px' },
      { titre: 'Notions', classe: 'cell-right', largeur: '72px' },
    ],
    lignes: enfants.map((e) => ({
      href: construireHash({ env: route.env, vue: 'familles', childId: e.childId }),
      classe: e.seances ? '' : 'is-inactive',
      cellules: [
        el('span', 'row-name', e.prenom),
        el('span', 'row-muted', e.classe || '—'),
        e.parentEmail ? el('span', 'mono email', e.parentEmail) : el('span', 'row-muted', 'introuvable'),
        el('span', 'row-muted', e.createdAt ? fmtJourCourt(jourParis(e.createdAt)) : '—'),
        el('span', e.derniereActivite ? '' : 'row-muted', e.derniereActivite ? fmtInstantParis(e.derniereActivite) : 'aucune'),
        fmtEntier(e.seances),
        etoiles(e.notionsAcquises),
      ],
    })),
    vide: 'Aucun enfant inscrit sur ' + route.env + '.',
  }));
  vue.append(el('p', 'bloc-explication bloc-note',
    'Séances et dernière activité : 92 derniers jours. Notions acquises (étoiles) : tout l’historique.'));
  return vue;
}

export function etoiles(n) {
  const c = el('span', 'etoiles' + (n ? '' : ' row-muted'), n ? '★ ' + fmtEntier(n) : '—');
  c.setAttribute('aria-label', pluriel(n, 'notion acquise', 'notions acquises'));
  return c;
}
