/* ============================================================
   Aristocles — Blocs techniques partagés par La veille et
   Santé & coûts : IA par rôle (unités réelles, coût inconnu),
   erreurs client (pile dépliable), versions, incidents, échecs IA.
   Tout le texte passe par textContent.
   ============================================================ */

import { construireHash } from '../router.js';
import { detailEnTexte } from './detail.js';
import { carteKpi, el, lien, tableau } from './dom.js';
import { fmtEntier } from './format.js';
import { LIBELLE_INCIDENT, LIBELLE_ROLE, LIBELLE_TYPE_ECRAN } from './libelles.js';
import { fmtInstantParis, heureParis } from './paris.js';
import { fmtEchecs, fmtLatence, libellePlateforme, libelleUnite, regrouperVersions, totauxPlateformes, volumesIa } from './sante.js';
import { coutAffiche } from './unites.js';

export function nomRole(role) {
  const nom = el('span', 'row-name', LIBELLE_ROLE[role] || role);
  if (LIBELLE_ROLE[role]) nom.append(el('span', 'cell-note', role));
  return nom;
}

export function celluleCout(bloc) {
  const cout = coutAffiche(bloc);
  const cellule = el('span', 'row-num' + (bloc.eur == null ? ' is-unknown' : ''), cout.valeur);
  if (cout.note) cellule.append(el('span', 'cell-note', cout.note));
  return cellule;
}

// Tuile coût IA : « inconnu » jamais affiché comme 0 ; appels au coût inconnu signalés.
export function carteCout(ia) {
  const n = ia.appelsCoutInconnu;
  const carte = carteKpi('Coût IA', coutAffiche(ia).valeur, n ? 'dont ' + n + (n > 1 ? ' appels inconnus' : ' appel inconnu') : null);
  if (ia.eur == null) carte.querySelector('.kpi-value').classList.add('is-unknown');
  if (n) carte.querySelector('.kpi-note').classList.add('is-unknown-note');
  return carte;
}

// ia : forme adapterIa.
export function tableIa(ia, { vide = 'Aucun appel IA.' } = {}) {
  return tableau({
    classe: 'ia-table',
    colonnes: [
      { titre: 'Rôle', largeur: 'minmax(150px, 1.3fr)' },
      { titre: 'Unité', largeur: 'minmax(90px, 0.8fr)' },
      { titre: 'Appels', classe: 'cell-right', largeur: '64px' },
      { titre: 'Échecs', classe: 'cell-right', largeur: '76px' },
      { titre: 'p50 · p95', classe: 'cell-right', largeur: '104px' },
      { titre: 'Entrée', classe: 'cell-right', largeur: 'minmax(120px, 1fr)' },
      { titre: 'Sortie', classe: 'cell-right', largeur: 'minmax(96px, 0.8fr)' },
      { titre: 'Coût', classe: 'cell-right', largeur: 'minmax(110px, 1fr)' },
    ],
    lignes: ia.parRole.map((r) => {
      const v = volumesIa(r);
      return [
        nomRole(r.role),
        el('span', 'row-muted', libelleUnite(r.unite)),
        fmtEntier(r.appels),
        el('span', r.echecs ? 'is-failure' : 'row-muted', fmtEchecs(r.echecs, r.appels)),
        fmtLatence(r.p50) + ' · ' + fmtLatence(r.p95),
        v.entree,
        v.sortie,
        celluleCout(r),
      ];
    }),
    vide,
  });
}

// Erreurs client groupées : une ligne par groupe, pile dépliable en <pre>.
export function listeErreursClient(erreurs, { vide = 'Aucune erreur client.' } = {}) {
  const table = el('div', 'data-table erreurs-table');
  const colonnes = 'minmax(170px, 1.4fr) minmax(110px, 1fr) minmax(120px, 1fr) 48px 130px';
  table.style.setProperty('--colonnes', colonnes);
  const tete = el('div', 'table-head');
  for (const [t, c] of [['Erreur', ''], ['Écran', ''], ['Version', ''], ['Nb', 'cell-right'], ['Dernière', 'cell-right']]) {
    tete.append(el('span', 'eyebrow ' + c, t));
  }
  table.append(tete);
  if (!erreurs.length) {
    table.append(el('div', 'table-empty', vide));
    return table;
  }
  for (const e of erreurs) {
    const rangee = el('div', 'table-row');
    const type = el('span', 'row-name', e.type || 'Erreur');
    if (e.zone) type.append(el('span', 'cell-note', 'zone ' + e.zone));
    rangee.append(
      type,
      el('span', null, e.ecran || '—'),
      el('span', null, [e.version, libellePlateforme(e.plateforme)].filter(Boolean).join(' · ')),
      el('span', 'cell-right row-num', fmtEntier(e.nb)),
      el('span', 'cell-right row-muted', fmtInstantParis(e.derniere)),
    );
    if (e.pile) {
      const details = el('details', 'pile');
      details.append(el('summary', null, 'Pile (occurrence la plus récente)'), el('pre', 'pile-texte', e.pile));
      rangee.append(details);
    }
    table.append(rangee);
  }
  return table;
}

export function tableVersions(versions, { vide = 'Aucune version vue.' } = {}) {
  const bloc = el('div', 'versions');
  const plateformes = totauxPlateformes(versions);
  if (plateformes.length) {
    const ligne = el('div', 'chips-ligne');
    ligne.append(el('span', 'eyebrow', 'Plateformes'));
    for (const p of plateformes) ligne.append(el('span', 'chip is-muted', p.plateforme + ' · ' + fmtEntier(p.lancements) + (p.lancements > 1 ? ' lancements' : ' lancement')));
    bloc.append(ligne);
  }
  bloc.append(tableau({
    classe: 'versions-table',
    colonnes: [
      { titre: 'Version', largeur: 'minmax(90px, 0.8fr)' },
      { titre: 'Builds', largeur: 'minmax(80px, 0.7fr)' },
      { titre: 'Plateformes', largeur: 'minmax(110px, 1fr)' },
      { titre: 'Lancements', classe: 'cell-right', largeur: '96px' },
      { titre: 'Dernier vu', classe: 'cell-right', largeur: '130px' },
    ],
    lignes: regrouperVersions(versions).map((g) => [
      el('span', 'row-name', g.version),
      el('span', 'row-muted', g.builds.join(', ') || '—'),
      g.plateformes.join(', '),
      fmtEntier(g.lancements),
      el('span', 'row-muted', fmtInstantParis(g.dernierVu)),
    ]),
    vide,
  }));
  return bloc;
}

// incidents : forme adapterIncidents ; lien vers la séance concernée.
export function blocIncidents(incidents, env, { avecDate = true } = {}) {
  const bloc = el('div', 'incidents');
  const types = el('div', 'chips-ligne');
  for (const t of incidents.parType) {
    types.append(el('span', 'chip ' + (t.nb ? 'is-fragile' : 'is-muted'), (LIBELLE_INCIDENT[t.type] || t.type) + ' · ' + t.nb));
  }
  bloc.append(types);
  if (incidents.recents.length) {
    bloc.append(tableau({
      classe: 'incidents-table',
      colonnes: [
        { titre: 'Quand', largeur: avecDate ? '130px' : '64px' },
        { titre: 'Type', largeur: 'minmax(130px, 0.9fr)' },
        { titre: 'Écran', largeur: 'minmax(100px, 0.7fr)' },
        { titre: 'Détail', largeur: 'minmax(180px, 2fr)' },
      ],
      lignes: incidents.recents.map((r) => ({
        href: r.sessionId ? construireHash({ env, vue: 'seances', sessionId: r.sessionId }) : undefined,
        cellules: [
          el('span', 'row-muted', avecDate ? fmtInstantParis(r.ts) : heureParis(r.ts) || '—'),
          el('span', 'row-name', LIBELLE_INCIDENT[r.type] || r.type),
          LIBELLE_TYPE_ECRAN[r.ecranType] || r.ecranType || '—',
          el('span', 'mono', detailEnTexte(r.detail) || '—'),
        ],
      })),
    }));
  }
  return bloc;
}

export function tableEchecsIa(echecs, { avecDate = true, vide = 'Aucun échec IA.' } = {}) {
  return tableau({
    classe: 'echecs-table',
    colonnes: [
      { titre: 'Quand', largeur: avecDate ? '130px' : '64px' },
      { titre: 'Rôle', largeur: 'minmax(130px, 1fr)' },
      { titre: 'Modèle', largeur: 'minmax(140px, 1fr)' },
      { titre: 'Erreur', largeur: 'minmax(160px, 1.5fr)' },
    ],
    lignes: echecs.map((e) => [
      el('span', 'row-muted', avecDate ? fmtInstantParis(e.createdAt) : heureParis(e.createdAt) || '—'),
      nomRole(e.role),
      el('span', 'mono', e.modele || '—'),
      el('span', 'is-failure', e.erreur || '—'),
    ]),
    vide,
  });
}

// Lien vers une séance (utilisé dans les cartes enfant).
export function lienSeance(env, sessionId, texte, classe) {
  return lien(construireHash({ env, vue: 'seances', sessionId }), classe, texte);
}

// Objet JSON libre (contenu de bilan, mémoire…) en champs lisibles :
// texte → paragraphe, liste de valeurs simples → puces, reste → JSON
// indenté. libelles : { cle: 'Libellé' } (sinon la clé, « _ » → espace).
export function champsLibres(objet, { libelles = {}, vide = '—' } = {}) {
  const liste = el('dl', 'champs');
  const entrees = objet && typeof objet === 'object' && !Array.isArray(objet) ? Object.entries(objet) : [[null, objet]];
  for (const [cle, valeur] of entrees) {
    if (cle !== null) liste.append(el('dt', 'eyebrow', libelles[cle] || cle.replace(/_/g, ' ')));
    const dd = el('dd');
    if (valeur == null || valeur === '' || (Array.isArray(valeur) && !valeur.length) ||
      (typeof valeur === 'object' && !Array.isArray(valeur) && !Object.keys(valeur).length)) {
      dd.append(el('span', 'row-muted', vide));
    } else if (typeof valeur !== 'object') {
      dd.append(el('p', 'champ-texte', String(valeur)));
    } else if (Array.isArray(valeur) && valeur.every((v) => v == null || typeof v !== 'object')) {
      const ul = el('ul', 'champ-liste');
      for (const v of valeur) ul.append(el('li', null, String(v)));
      dd.append(ul);
    } else {
      dd.append(el('pre', 'json-bloc', JSON.stringify(valeur, null, 2)));
    }
    liste.append(dd);
  }
  return liste;
}
