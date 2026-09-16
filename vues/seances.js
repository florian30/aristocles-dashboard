/* ============================================================
   Séances — liste (action `session`), filtrable par plage et
   par enfant. Chaque ligne ouvre le lecteur (vues/seance.js).
   ============================================================ */

import { construireHash } from '../router.js';
import { barreFiltres } from '../ui/filtres.js';
import { el, tableau } from '../ui/dom.js';
import { fmtDuree, fmtJourHeure, pluriel } from '../ui/format.js';
import { LIBELLE_MODE } from '../ui/libelles.js';
import { plageDepuisQuery } from '../ui/plage.js';

export const titre = 'Séances';

export async function rendre({ route, api, signal }) {
  const plage = plageDepuisQuery(route.query);
  const [seances, tout] = await Promise.all([
    api.sessions(route.env, plage.from, plage.to, route.query.child, { signal }),
    api.stats(route.env, null, null, { signal }), // liste des enfants connus
  ]);

  const vue = el('div', 'vue vue-seances');
  const tete = el('div', 'page-head');
  tete.append(el('h1', 'page-title', titre), el('span', 'page-count', pluriel(seances.length, 'séance')));
  vue.append(tete, barreFiltres(route, { enfants: tout.perChild }));

  vue.append(tableau({
    classe: 'sessions-table',
    colonnes: [
      { titre: 'Date · heure', largeur: '190px' },
      { titre: 'Enfant' },
      { titre: 'Mode', largeur: '150px' },
      { titre: 'Durée', classe: 'cell-right', largeur: '100px' },
      { titre: 'Exercices', classe: 'cell-right', largeur: '100px' },
    ],
    lignes: seances.map((s) => {
      const nom = el('span', 'row-name', s.childName);
      if (s.theme) nom.append(el('span', 'cell-note', s.theme));
      const mode = el('span', 'row-mode');
      mode.append(el('span', 'mode-dot is-' + s.mode), document.createTextNode(LIBELLE_MODE[s.mode] || s.mode));
      return {
        href: construireHash({ env: route.env, vue: 'seances', sessionId: s.id, query: route.query }),
        cellules: [
          el('span', 'row-date', fmtJourHeure(s.date, s.time)),
          nom,
          mode,
          el('span', s.durationMin == null ? 'row-open' : '', fmtDuree(s.durationMin)),
          String(s.exerciseCount),
        ],
      };
    }),
    vide: 'Aucune séance sur cette période.',
  }));
  return vue;
}
