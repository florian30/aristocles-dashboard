/* ============================================================
   Mock de l'action `apercu` — forme brute de l'Edge (§ 2.4),
   agrégée jour par jour à partir du mock `journee` pour rester
   cohérente avec La veille.
   ============================================================ */

import { decalerJour, jourParis } from '../ui/paris.js';
import { journeeBrute } from './journee.js';

// Jours civils de Paris couverts par une plage ISO.
export function joursDeLaPlage(params) {
  const premier = jourParis(new Date(params.from));
  const dernier = jourParis(new Date(params.to));
  const jours = [];
  for (let j = premier; j <= dernier; j = decalerJour(j, 1)) jours.push(j);
  return jours;
}

// Fusion des blocs `ia` en bloc coûts (forme `stats.llm`, § 1.5–1.6).
export function coutsDepuisIa(blocs) {
  const parRole = new Map();
  for (const ia of blocs) {
    for (const r of ia.par_role) {
      const g = parRole.get(r.role) || { role: r.role, unite: r.unite, cout_eur: null, appels: 0, appels_cout_inconnu: 0, tokens_input: 0, tokens_output: 0 };
      g.appels += r.appels;
      g.appels_cout_inconnu += r.appels_cout_inconnu;
      if (r.cout_eur != null) g.cout_eur = Math.round(((g.cout_eur || 0) + r.cout_eur) * 10000) / 10000;
      g.tokens_input += r.volume_input || 0;
      g.tokens_output += r.volume_output || 0;
      parRole.set(r.role, g);
    }
  }
  const roles = [...parRole.values()].sort((a, b) =>
    a.cout_eur == null ? 1 : b.cout_eur == null ? -1 : b.cout_eur - a.cout_eur);
  const auToken = roles.filter((r) => r.unite === 'token');
  return {
    cout_total_eur: Math.round(roles.reduce((a, r) => a + (r.cout_eur || 0), 0) * 10000) / 10000,
    appels: roles.reduce((a, r) => a + r.appels, 0),
    appels_cout_inconnu: roles.reduce((a, r) => a + r.appels_cout_inconnu, 0),
    tokens_input: auToken.reduce((a, r) => a + r.tokens_input, 0),
    tokens_output: auToken.reduce((a, r) => a + r.tokens_output, 0),
    volumes_hors_tokens: roles.filter((r) => r.unite !== 'token')
      .map((r) => ({ unite: r.unite, total: r.tokens_input, appels: r.appels })),
    par_role: roles,
  };
}

// Rubrique Dictée (§ 2.4, D20) : nouveau flux seulement (classe non nulle).
function apercuDictees(dictees) {
  const nouvelles = dictees.filter((d) => d.classe != null);
  const echecs = nouvelles.filter((d) => d.validation_status === 'rejete').length;
  return {
    lancees: nouvelles.length,
    finies: nouvelles.filter((d) => d.etape === 'fin').length,
    non_corrigees: nouvelles.filter((d) => d.etape === 'non_corrigee').length,
    echecs_generation: echecs,
    taux_echec_generation: nouvelles.length ? Math.round((echecs / nouvelles.length) * 100) / 100 : null,
  };
}

export function apercu(params = {}) {
  const jours = joursDeLaPlage(params).map((j) => journeeBrute(j, params));
  const enfants = new Set();
  const seances = [];
  const entrees = { apprentissage: 0, devoirs: 0, dictee: 0, autre: 0 };
  const serie = jours.map((j) => {
    const duJour = j.enfants.flatMap((c) => c.seances);
    j.enfants.forEach((c) => enfants.add(c.child_id));
    seances.push(...duJour);
    for (const s of duJour) if (s.mode !== 'dictee') entrees[s.mode === 'devoirs' ? 'devoirs' : 'apprentissage'] += 1;
    entrees.dictee += j.enfants.reduce((a, c) => a + c.dictees.length, 0);
    entrees.autre += j.enfants.filter((c) => !c.seances.length).length;
    return {
      jour: j.date,
      seances: duJour.length,
      enfants_actifs: j.enfants.length,
      minutes: Math.round(duJour.reduce((a, s) => a + (s.status === 'archivee' ? s.duration_seconds : 0), 0) / 60),
      ouvertures_app: j.technique.ouvertures_app,
    };
  });
  const ex = seances.reduce((a, s) => ({
    total: a.total + s.exercices.nb, succes: a.succes + s.exercices.succes,
    fragile: a.fragile + s.exercices.fragile, autres: a.autres + s.exercices.autres,
  }), { total: 0, succes: 0, fragile: 0, autres: 0 });
  const avecSeance = new Set(jours.flatMap((j) => j.enfants.filter((c) => c.seances.length).map((c) => c.child_id))).size;
  const j7 = Math.max(0, avecSeance - 1);
  const j30 = Math.max(0, avecSeance - 3);
  return {
    from: new Date(params.from).toISOString(),
    to: new Date(params.to).toISOString(),
    enfants_actifs: enfants.size,
    familles_actives: enfants.size,
    seances: {
      total: seances.length,
      par_mode: {
        devoirs: seances.filter((s) => s.mode === 'devoirs').length,
        entrainement: seances.filter((s) => s.mode === 'entrainement').length,
        dictee: seances.filter((s) => s.mode === 'dictee').length,
      },
    },
    seances_sans_echange: jours.reduce((a, j) => a + j.seances_sans_echange, 0),
    dictees: apercuDictees(jours.flatMap((j) => j.enfants.flatMap((c) => c.dictees))),
    minutes: serie.reduce((a, p) => a + p.minutes, 0),
    exercices: ex,
    ouvertures_app: serie.reduce((a, p) => a + p.ouvertures_app, 0),
    entrees_par_mode: entrees,
    retention: {
      j7: { eligibles: j7, revenus: Math.max(0, j7 - 1), taux: j7 ? Math.round((Math.max(0, j7 - 1) / j7) * 100) / 100 : null },
      j30: { eligibles: j30, revenus: j30 ? 1 : 0, taux: j30 ? Math.round((1 / j30) * 100) / 100 : null },
    },
    serie,
    couts: coutsDepuisIa(jours.map((j) => j.technique.ia)),
  };
}
