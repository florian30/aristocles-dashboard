/* ============================================================
   Mock de l'action `veille` — forme brute de l'Edge
   (veille-prod.md § 7) : familles F1-F8, série par jour, lignes
   de la vue `v_veille_jour`. Données fictives, sans identifiant.

   Scénario (en jours avant aujourd'hui) : hier est ROUGE, journée
   « recopie refusée » (le fournisseur refuse de lire la photo des
   devoirs, le second lecteur rate aussi, un tour n'aboutit pas) ;
   puis des jours orange et rouges répartis sur 92 jours. Aujourd'hui
   est partiel. Le coût de la lecture des devoirs est parfois inconnu.
   ============================================================ */

import { ApiError } from '../api.js';
import { aujourdhuiParis, debutJourParisMs, decalerJour } from '../ui/paris.js';

const SEUILS = {
  F1: { orange: null, rouge: 'dès 1' },
  F2: { orange: 'dès 1', rouge: 'dès 3, ou ≥ 2 % des appels quand il y en a au moins 50' },
  F3: { orange: null, rouge: 'dès 1' },
  F4: { orange: null, rouge: 'dès 1' },
  F5: { orange: 'p95 d’un rôle > 2 × sa médiane des 14 jours précédents, ou p95 du tuteur > 20 s', rouge: null },
  F6: { orange: 'coût du jour > 5 €, ou > 2 × la moyenne des 14 jours précédents', rouge: null },
  F7: { orange: 'jour ouvré sans appel IA après une semaine active', rouge: 'deux jours ouvrés muets de suite' },
  F8: { orange: 'un code jamais vu dans la fenêtre lue', rouge: 'plus de 5 le même jour' },
};

const LIBELLES = {
  F1: "Un enfant n'a pas eu ce qu'il demandait",
  F2: 'Un fournisseur refuse ou tombe',
  F3: 'Le filet de secours a aussi raté',
  F4: 'Un automate ne tourne plus',
  F5: 'Pic de latence',
  F6: 'Hausse de coût',
  F7: 'Silence anormal',
  F8: "Plantages de l'app",
};

const FAMILLES = Object.keys(LIBELLES);
const RANG_NIVEAU = { vert: 0, orange: 1, rouge: 2 };
const pire = (a, b) => (RANG_NIVEAU[b] > RANG_NIVEAU[a] ? b : a);

// Pseudo-aléa déterministe par (jour, sel).
function alea(jour, sel) {
  let h = 2166136261;
  for (const c of jour + '|' + sel) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function instant(jour, heure, minute = 0) {
  const ms = debutJourParisMs(jour) + (heure * 60 + minute) * 60000;
  return new Date(Math.min(ms, Date.now())).toISOString().replace('.000Z', 'Z');
}

function ligne(jour, famille, fonction, code, nb, champs = {}) {
  return {
    jour, famille, fonction, role: null, modele: null, code, nb, nb_total: null,
    latence_p50_ms: null, latence_p95_ms: null, cout_eur: null,
    premier_at: instant(jour, 8, 5), dernier_at: instant(jour, 19, 40),
    ...champs,
  };
}

const ROLES = [
  { role: 'tutor', modele: 'anthropic/claude-sonnet', base: 70, p50: 3200, p95: 7400, cout: 0.0065 },
  { role: 'stt', modele: 'openai/whisper', base: 55, p50: 900, p95: 1800, cout: 0.0012 },
  { role: 'tts', modele: 'elevenlabs/flash', base: 60, p50: 700, p95: 1500, cout: 0.0009 },
  { role: 'vision_devoirs', modele: 'google/gemini-flash', base: 8, p50: 5200, p95: 9800, cout: 0.004 },
];

// Lignes et motifs propres à un jour, selon son écart à aujourd'hui.
function scenario(jour, ecart) {
  const lignes = [];
  const motifs = {}; // F5 / F6 / F7 : comparaisons entre jours
  const dow = new Date(jour + 'T12:00:00Z').getUTCDay();
  const weekend = dow === 0 || dow === 6;
  const muet = ecart === 47; // F7 : un jour ouvré sans appel IA
  const echelle = ecart === 0 ? 0.35 : weekend ? 0.45 : 1;

  if (!muet) {
    for (const r of ROLES) {
      const total = Math.max(1, Math.round(r.base * echelle * (0.8 + alea(jour, r.role) * 0.4)));
      const lent = ecart === 4 && r.role === 'tutor';
      const inconnu = r.role === 'vision_devoirs' && alea(jour, 'prix') < 0.3;
      const cher = ecart === 9 ? 9 : 1;
      lignes.push(ligne(jour, 'mesure', 'llm', 'appels', 0, {
        role: r.role, modele: r.modele, nb_total: total,
        latence_p50_ms: Math.round(r.p50 * (lent ? 2.4 : 0.9 + alea(jour, r.role + 'l') * 0.2)),
        latence_p95_ms: Math.round(r.p95 * (lent ? 2.9 : 0.9 + alea(jour, r.role + 'p') * 0.2)),
        cout_eur: inconnu ? null : Math.round(total * r.cout * cher * 10000) / 10000,
      }));
    }
    lignes.push(ligne(jour, 'mesure', 'app', 'client_event', Math.round(420 * echelle)));
  }
  lignes.push(ligne(jour, 'mesure', 'cron:purge-photos', 'cron_executions', 1, { nb_total: 1, premier_at: instant(jour, 3), dernier_at: instant(jour, 3) }));
  if (alea(jour, 'relance') < 0.35 && !muet) {
    lignes.push(ligne(jour, 'info', 'llm', 'relance_reussie', 1, { role: 'vision_devoirs', modele: 'google/gemini-flash', premier_at: instant(jour, 17, 12), dernier_at: instant(jour, 17, 12) }));
  }
  if (alea(jour, 'anomalie') < 0.25 && !muet) {
    lignes.push(ligne(jour, 'info', 'app', 'tour_anomalie:silence_long', 1, { premier_at: instant(jour, 18, 3), dernier_at: instant(jour, 18, 3) }));
  }

  const appelVision = { role: 'vision_devoirs', modele: 'google/gemini-flash' };
  switch (ecart) {
    case 1: // Rouge — « recopie refusée »
      lignes.push(
        ligne(jour, 'F2', 'llm', 'content_filter', 4, { ...appelVision, premier_at: instant(jour, 17, 2), dernier_at: instant(jour, 18, 26) }),
        ligne(jour, 'F3', 'llm', 'relance_echouee', 2, { ...appelVision, premier_at: instant(jour, 17, 3), dernier_at: instant(jour, 18, 27) }),
        ligne(jour, 'F1', 'app', 'tour_erreur', 1, { premier_at: instant(jour, 18, 27), dernier_at: instant(jour, 18, 27) }),
      );
      break;
    case 3:
      lignes.push(ligne(jour, 'F2', 'llm', 'delai_depasse', 1, { role: 'tutor', modele: 'anthropic/claude-sonnet', premier_at: instant(jour, 19, 15), dernier_at: instant(jour, 19, 15) }));
      break;
    case 4:
      motifs.F5 = ['p95 du tuteur au-dessus de 20 s (seuil : 20 s)'];
      break;
    case 6:
      lignes.push(
        ligne(jour, 'F4', 'cron:bilans-hebdo', 'cron_en_retard', 1, { premier_at: instant(jour, 6), dernier_at: instant(jour, 6) }),
        ligne(jour, 'F8', 'app', 'erreur_client:dictee/TimeoutException', 1, { premier_at: instant(jour, 18, 44), dernier_at: instant(jour, 18, 44) }),
      );
      break;
    case 9:
      motifs.F6 = ['coût du jour au-dessus de 5 € (seuil : 5 €)'];
      break;
    case 12:
      lignes.push(
        ligne(jour, 'F1', 'quiz', 'quiz_repli_simple', 2, { premier_at: instant(jour, 17, 40), dernier_at: instant(jour, 18, 5) }),
        ligne(jour, 'F1', 'dictee', 'dictee_echec', 1, { premier_at: instant(jour, 18, 20), dernier_at: instant(jour, 18, 20) }),
      );
      break;
    case 20:
      lignes.push(ligne(jour, 'F8', 'app', 'erreur_client:accueil/StateError', 6, { premier_at: instant(jour, 7, 58), dernier_at: instant(jour, 8, 31) }));
      break;
    case 33:
      lignes.push(ligne(jour, 'F2', 'llm', 'amont_5xx', 3, { role: 'stt', modele: 'openai/whisper', premier_at: instant(jour, 18, 1), dernier_at: instant(jour, 18, 9) }));
      break;
    case 47:
      motifs.F7 = ['aucun appel IA ce jour ouvré (5 des 7 jours précédents actifs)'];
      break;
    case 61:
      lignes.push(ligne(jour, 'F2', 'llm', 'limite_debit', 1, { role: 'tts', modele: 'elevenlabs/flash', premier_at: instant(jour, 17, 30), dernier_at: instant(jour, 17, 30) }));
      break;
  }
  return { lignes, motifs };
}

function evaluer(famille, nb, motifs) {
  if (motifs) {
    return famille === 'F7' && motifs.length > 1 ? 'rouge' : 'orange';
  }
  if (!nb) return 'vert';
  if (famille === 'F2') return nb >= 3 ? 'rouge' : 'orange';
  if (famille === 'F8') return nb > 5 ? 'rouge' : 'orange';
  return 'rouge'; // F1, F3, F4 : dès 1
}

function seuilTexte(famille, nb, niveau) {
  if (niveau === 'vert') return [];
  const seuil = niveau === 'rouge' && famille === 'F8' ? 5 : niveau === 'rouge' && famille === 'F2' ? 3 : 1;
  return [nb + ' ce jour (seuil : ' + seuil + ')'];
}

const cmp = (a, b) => (a == null ? '' : String(a)).localeCompare(b == null ? '' : String(b));

export function veille(params = {}) {
  const jours = params.jours === undefined ? 14 : params.jours;
  if (!Number.isInteger(jours) || jours < 1 || jours > 92) {
    throw new ApiError("'jours' must be an integer between 1 and 92", 400);
  }
  const aujourdhui = aujourdhuiParis();
  const premier = decalerJour(aujourdhui, -(jours - 1));

  const serie = [];
  const lignes = [];
  for (let ecart = jours - 1; ecart >= 0; ecart--) {
    const jour = decalerJour(aujourdhui, -ecart);
    const s = scenario(jour, ecart);
    lignes.push(...s.lignes);
    const familles = {};
    let niveau = 'vert';
    for (const f of FAMILLES) {
      const motifsF = s.motifs[f];
      const nb = motifsF ? 1 : s.lignes.filter((l) => l.famille === f).reduce((a, l) => a + l.nb, 0);
      const n = evaluer(f, nb, motifsF);
      familles[f] = { niveau: n, nb, motifs: motifsF || seuilTexte(f, nb, n) };
      niveau = pire(niveau, n);
    }
    const appels = s.lignes.filter((l) => l.code === 'appels');
    serie.push({
      jour,
      partiel: ecart === 0,
      niveau,
      appels_llm: appels.reduce((a, l) => a + l.nb_total, 0),
      cout_eur: Math.round(appels.reduce((a, l) => a + (l.cout_eur || 0), 0) * 10000) / 10000,
      familles,
    });
  }

  const familles = FAMILLES.map((f) => {
    const points = serie.map((p) => ({ jour: p.jour, ...p.familles[f] }));
    const signales = points.filter((p) => p.niveau !== 'vert');
    return {
      famille: f,
      libelle: LIBELLES[f],
      niveau: points.reduce((n, p) => pire(n, p.niveau), 'vert'),
      nb: points.reduce((a, p) => a + p.nb, 0),
      jours_rouges: points.filter((p) => p.niveau === 'rouge').length,
      jours_orange: points.filter((p) => p.niveau === 'orange').length,
      dernier_jour_signale: signales.length ? signales[signales.length - 1].jour : null,
      seuil: SEUILS[f],
    };
  });

  lignes.sort((a, b) => cmp(a.jour, b.jour) || cmp(a.famille, b.famille) || cmp(a.fonction, b.fonction) ||
    cmp(a.role, b.role) || cmp(a.modele, b.modele) || cmp(a.code, b.code));

  return {
    genere_le: new Date().toISOString(),
    aujourdhui,
    jours,
    premier_jour: premier,
    niveau: serie.reduce((n, p) => pire(n, p.niveau), 'vert'),
    familles,
    serie,
    lignes,
  };
}
