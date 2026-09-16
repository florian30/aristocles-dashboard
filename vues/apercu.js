/* ============================================================
   Vue d'ensemble — reprend l'ancien écran Statistiques (action
   `stats`) : indicateurs, activité par enfant, coûts IA avec
   unités réelles (stt en secondes, tts en caractères) et coûts
   inconnus jamais comptés comme zéro.
   ============================================================ */

import { barreFiltres } from '../ui/filtres.js';
import { carteKpi, el, tableau } from '../ui/dom.js';
import { fmtDuree, fmtEntier } from '../ui/format.js';
import { LIBELLE_ROLE } from '../ui/libelles.js';
import { plageDepuisQuery } from '../ui/plage.js';
import { coutAffiche, fmtVolume, volumesRole } from '../ui/unites.js';

export const titre = "Vue d'ensemble";

export async function rendre({ route, api, signal }) {
  const plage = plageDepuisQuery(route.query);
  // Plage complète : liste de tous les enfants connus, pour montrer
  // aussi les inactifs (l'Edge ne renvoie que les actifs).
  const [stats, tout] = await Promise.all([
    api.stats(route.env, plage.from, plage.to, { signal }),
    api.stats(route.env, null, null, { signal }),
  ]);

  const vue = el('div', 'vue vue-apercu');
  vue.append(el('h1', 'page-title', titre), barreFiltres(route));

  const kpis = el('div', 'kpi-grid');
  kpis.append(
    carteKpi('Enfants actifs', String(stats.activeChildren)),
    carteKpi('Séances', String(stats.sessionCount)),
    carteKpi('Exercices réalisés', String(stats.exerciseCount)),
    carteKpi('Temps total passé', stats.totalMinutes ? fmtDuree(stats.totalMinutes) : '0 min'),
  );
  vue.append(kpis);

  vue.append(el('h2', 'section-title', 'Par enfant'));
  const actifs = new Map(stats.perChild.map((c) => [c.childId, c]));
  const lignes = tout.perChild.map((c) => actifs.get(c.childId) || { ...c, sessions: 0, exercises: 0, minutes: 0 });
  for (const c of stats.perChild) if (!lignes.some((l) => l.childId === c.childId)) lignes.push(c);
  lignes.sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
  vue.append(tableau({
    classe: 'stats-table',
    colonnes: [
      { titre: 'Prénom' },
      { titre: 'Séances', classe: 'cell-right', largeur: '120px' },
      { titre: 'Exercices', classe: 'cell-right', largeur: '120px' },
      { titre: 'Temps passé', classe: 'cell-right', largeur: '140px' },
    ],
    lignes: lignes.map((c) => {
      const inactif = c.sessions === 0;
      return {
        classe: inactif ? 'is-inactive' : '',
        cellules: [c.name, String(c.sessions), String(c.exercises), inactif ? '—' : fmtDuree(c.minutes)],
      };
    }),
    vide: 'Aucun enfant connu.',
  }));

  if (stats.llm) vue.append(sectionCouts(stats.llm));
  return vue;
}

function sectionCouts(llm) {
  const section = el('section', 'llm-section');
  section.append(el('h2', 'section-title', 'Coûts IA'));

  const total = coutAffiche(llm);
  const kpis = el('div', 'kpi-grid llm-kpis');
  kpis.append(
    carteKpi('Coût total estimé', total.valeur, total.note),
    carteKpi('Appels', fmtEntier(llm.appels)),
    carteKpi('Tokens entrée', fmtEntier(llm.tokensEntree), 'rôles facturés au token'),
    carteKpi('Tokens sortie', fmtEntier(llm.tokensSortie), 'rôles facturés au token'),
  );
  section.append(kpis);

  if (llm.volumesHorsTokens.length) {
    const volumes = el('div', 'volumes');
    for (const v of llm.volumesHorsTokens) {
      const bloc = el('div', 'volume');
      bloc.append(
        el('span', 'eyebrow', v.unite === 'seconde' ? 'Audio transcrit' : v.unite === 'caractere' ? 'Texte synthétisé' : v.unite),
        el('span', 'volume-valeur', fmtVolume(v.total, v.unite)),
        el('span', 'volume-note', fmtEntier(v.appels) + (v.appels > 1 ? ' appels' : ' appel')),
      );
      volumes.append(bloc);
    }
    section.append(volumes);
  }

  section.append(tableau({
    classe: 'llm-table',
    colonnes: [
      { titre: 'Rôle' },
      { titre: 'Coût', classe: 'cell-right', largeur: '220px' },
      { titre: 'Appels', classe: 'cell-right', largeur: '80px' },
      { titre: 'Entrée', classe: 'cell-right', largeur: '180px' },
      { titre: 'Sortie', classe: 'cell-right', largeur: '140px' },
    ],
    lignes: llm.parRole.map((r) => {
      const cout = coutAffiche(r);
      const celluleCout = el('span', 'row-num' + (r.eur == null ? ' is-unknown' : ''), cout.valeur);
      if (cout.note) celluleCout.append(el('span', 'cell-note', cout.note));
      const nom = el('span', 'row-name', LIBELLE_ROLE[r.role] || r.role);
      if (LIBELLE_ROLE[r.role]) nom.append(el('span', 'cell-note', r.role));
      const volumes = volumesRole(r);
      return [nom, celluleCout, fmtEntier(r.appels), volumes.entree, volumes.sortie];
    }),
    vide: 'Aucun appel sur cette période.',
  }));
  return section;
}
