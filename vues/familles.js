/* ============================================================
   Familles (action `enfants`) : tous les enfants inscrits, e-mail
   du parent, activité des 92 derniers jours, étoiles. Tri par
   dernière activité, ou par la colonne cliquée (`tri`/`sens` dans
   la query) ; chaque ligne ouvre la fiche (vues/enfant.js).
   ============================================================ */

import { construireHash } from '../router.js';
import { el, tableau } from '../ui/dom.js';
import { fmtEntier, pluriel } from '../ui/format.js';
import { fmtInstantParis, fmtJourCourt, jourParis } from '../ui/paris.js';
import { avecInternes, interrupteurInternes } from '../ui/internes.js';
import { mentionSansEchange } from '../ui/sans-echange.js';
import { queryTri, trier, triDepuisQuery } from '../ui/tri.js';

export const titre = 'Familles';

// Colonnes triables, dans l'ordre d'affichage.
export const COLONNES_TRI = {
  prenom: { type: 'texte', valeur: (e) => e.prenom },
  classe: { type: 'texte', valeur: (e) => e.classe },
  email: { type: 'texte', valeur: (e) => e.parentEmail },
  creeLe: { type: 'date', valeur: (e) => e.createdAt },
  activite: { type: 'date', valeur: (e) => e.derniereActivite },
  seances: { type: 'nombre', valeur: (e) => e.seances },
  notions: { type: 'nombre', valeur: (e) => e.notionsAcquises },
};
export const TRI_PAR_DEFAUT = { cle: 'activite', sens: 'desc' };

export async function rendre({ route, api, signal }) {
  const { enfants: recus, sansEchange } = await api.enfants(route.env, null, null, { signal, avecInternes: avecInternes(route) });
  const tri = triDepuisQuery(route.query, COLONNES_TRI, TRI_PAR_DEFAUT);
  const enfants = trier(recus, COLONNES_TRI, tri);
  const colonne = (cle, def) => ({
    ...def,
    tri: { href: construireHash({ ...route, query: queryTri(route.query, cle, tri) }), sens: tri.cle === cle ? tri.sens : null },
  });

  const vue = el('div', 'vue vue-familles');
  const tete = el('div', 'page-head');
  const actifs = enfants.filter((e) => e.seances > 0).length;
  tete.append(el('h1', 'page-title', titre),
    el('span', 'page-count', pluriel(enfants.length, 'enfant') + ' · ' + actifs + (actifs > 1 ? ' actifs' : ' actif') + ' sur les 92 derniers jours'));
  const barre = el('div', 'toolbar');
  barre.append(interrupteurInternes(route));
  vue.append(tete, barre);
  const mention = mentionSansEchange(sansEchange);
  if (mention) vue.append(mention);

  vue.append(tableau({
    classe: 'familles-table',
    colonnes: [
      colonne('prenom', { titre: 'Prénom', largeur: 'minmax(110px, 0.9fr)' }),
      colonne('classe', { titre: 'Classe', largeur: '72px' }),
      colonne('email', { titre: 'E-mail du parent', largeur: 'minmax(180px, 1.6fr)' }),
      colonne('creeLe', { titre: 'Créé le', largeur: '96px' }),
      colonne('activite', { titre: 'Dernière activité', largeur: '160px' }),
      colonne('seances', { titre: 'Séances', classe: 'cell-right', largeur: '84px' }),
      colonne('notions', { titre: 'Notions', classe: 'cell-right', largeur: '80px' }),
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
