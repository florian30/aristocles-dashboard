/* ============================================================
   Mock de l'action `sante` — forme brute de l'Edge (§ 2.8),
   agrégée à partir du mock `journee` sur la plage demandée.
   ============================================================ */

import { hierParis } from '../ui/paris.js';
import { joursDeLaPlage } from './apercu.js';
import { journeeBrute } from './journee.js';

export function sante(params = {}) {
  const dates = joursDeLaPlage(params);
  const jours = dates.map((d) => journeeBrute(d));

  // Erreurs client groupées par (type, zone, écran, version, plateforme).
  const erreurs = new Map();
  for (const e of jours.flatMap((j) => j.technique.erreurs_client)) {
    const cle = [e.type, e.zone, e.ecran, e.app_version, e.plateforme].join('|');
    const g = erreurs.get(cle);
    if (!g) erreurs.set(cle, { ...e });
    else {
      g.nb += e.nb;
      if (e.derniere_occurrence > g.derniere_occurrence) {
        g.derniere_occurrence = e.derniere_occurrence;
        g.exemple_pile = e.exemple_pile;
      }
    }
  }

  const versions = new Map();
  for (const v of jours.flatMap((j) => j.technique.versions)) {
    const cle = [v.app_version, v.app_build, v.plateforme].join('|');
    const g = versions.get(cle);
    if (!g) versions.set(cle, { ...v });
    else {
      g.lancements += v.lancements;
      g.enfants = Math.max(g.enfants, v.enfants);
      if (v.dernier_vu > g.dernier_vu) g.dernier_vu = v.dernier_vu;
    }
  }

  const parRole = new Map();
  for (const r of jours.flatMap((j) => j.technique.ia.par_role)) {
    const g = parRole.get(r.role);
    if (!g) parRole.set(r.role, { ...r });
    else {
      g.appels += r.appels;
      g.echecs += r.echecs;
      g.appels_cout_inconnu += r.appels_cout_inconnu;
      g.cout_eur = r.cout_eur == null && g.cout_eur == null ? null : Math.round(((g.cout_eur || 0) + (r.cout_eur || 0)) * 10000) / 10000;
      g.volume_input += r.volume_input;
      g.volume_output += r.volume_output;
    }
  }
  const roles = [...parRole.values()].sort((a, b) => b.appels - a.appels);

  const incidents = { par_type: [], recents: [] };
  for (const j of jours) {
    for (const t of j.technique.incidents.par_type) {
      const g = incidents.par_type.find((x) => x.type === t.type);
      if (g) g.nb += t.nb;
      else incidents.par_type.push({ ...t });
    }
    incidents.recents.push(...j.technique.incidents.recents);
  }
  incidents.recents.sort((a, b) => b.client_ts.localeCompare(a.client_ts)).splice(20);

  const hier = hierParis();
  return {
    from: new Date(params.from).toISOString(),
    to: new Date(params.to).toISOString(),
    erreurs_client: [...erreurs.values()].sort((a, b) => b.nb - a.nb),
    versions: [...versions.values()].sort((a, b) => b.lancements - a.lancements),
    ia: {
      appels: roles.reduce((a, r) => a + r.appels, 0),
      echecs: roles.reduce((a, r) => a + r.echecs, 0),
      cout_total_eur: Math.round(roles.reduce((a, r) => a + (r.cout_eur || 0), 0) * 10000) / 10000,
      appels_cout_inconnu: roles.reduce((a, r) => a + r.appels_cout_inconnu, 0),
      par_role: roles,
    },
    echecs_ia: jours.flatMap((j) => j.technique.echecs_ia)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20),
    incidents,
    quotas: {
      plafond: 300,
      au_plafond: dates.includes(hier) ? [{ parent_id: '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', jour: hier, unites: 300 }] : [],
    },
  };
}
