/* ============================================================
   Séances — liste (action `session`), filtrable par plage, par
   enfant (côté Edge) et par mode (ici). Chaque ligne ouvre le
   lecteur (vues/seance.js).
   Les séances sans échange sont masquées sauf `sans_echange=1`.
   ============================================================ */

import { construireHash } from '../router.js';
import { barreFiltres } from '../ui/filtres.js';
import { el, tableau } from '../ui/dom.js';
import { fmtDuree, fmtJourHeure, pluriel } from '../ui/format.js';
import { LIBELLE_MODE } from '../ui/libelles.js';
import { plageDepuisQuery } from '../ui/plage.js';
import { avecInternes, interrupteurInternes } from '../ui/internes.js';
import { avecSansEchange, bandeauSansEchange } from '../ui/sans-echange.js';
import { filtrerParMode, modeDepuisQuery, optionsEnfants, optionsModes } from '../ui/seances-filtres.js';

export const titre = 'Séances';

export async function rendre({ route, api, signal }) {
  const plage = plageDepuisQuery(route.query);
  const child = route.query.child || null;
  const mode = modeDepuisQuery(route.query);
  const options = { signal, avecSansEchange: avecSansEchange(route), avecInternes: avecInternes(route) };
  // Enfant choisi : la plage tous enfants (souvent en cache) donne les
  // enfants proposés ; sinon un seul appel suffit.
  const [{ seances: seancesEnfant, sansEchange }, tousEnfants] = await Promise.all([
    api.sessions(route.env, plage.from, plage.to, child, options),
    child ? api.sessions(route.env, plage.from, plage.to, null, options) : null,
  ]);
  const seances = filtrerParMode(seancesEnfant, mode);

  const vue = el('div', 'vue vue-seances');
  const tete = el('div', 'page-head');
  tete.append(el('h1', 'page-title', titre), el('span', 'page-count', pluriel(seances.length, 'séance')));
  const barre = barreFiltres(route, {
    enfants: optionsEnfants((tousEnfants || { seances: seancesEnfant }).seances, child),
    modes: optionsModes(seancesEnfant, mode),
  });
  barre.append(interrupteurInternes(route));
  vue.append(tete, barre);
  const bandeau = bandeauSansEchange(route, sansEchange);
  if (bandeau) vue.append(bandeau);

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
    vide: child || mode ? 'Aucune séance ne correspond à ces filtres.' : 'Aucune séance sur cette période.',
  }));
  return vue;
}
