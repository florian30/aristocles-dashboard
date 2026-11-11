/* ============================================================
   Mock de l'action `questions_ari` (GAMIF-L15, contrat v2.11
   § 2.17) : le mot à mot de « Pose-moi des questions », un jour
   civil de Paris à la fois (`date`). Lina (c1) a posé quatre
   questions hier — une avec sa voix, une à la voix effacée, une sans
   prise retrouvée, une restée sans réponse d'Ari — et une il y a 35
   jours (ligne d'index déjà purgée : `prise_le` null). Aujourd'hui et
   les autres enfants : aucun échange. Enfant inconnu → 404. L'audio
   est le WAV muet factice de `voix_seance` (aucune voix réelle).
   ============================================================ */

import { decalerJour, debutJourParisMs, estDateCivile, hierParis } from '../ui/paris.js';
import { CHILDREN } from './donnees.js';
import { AUDIO } from './voix_seance.js';

const VALIDITE_S = 3600;

// Échanges de Lina : décalage du jour (par rapport à hier) et heure de Paris.
const GRAINES = [
  { jours: 0, h: 17, min: 2, question: 'Tu es un robot ?', reponse: 'Oui, je suis une IA : un programme qui t’aide à apprendre. Je ne suis pas une personne.', voix: 'ok', duree: 2.1 },
  { jours: 0, h: 17, min: 4, question: 'C’est quoi une étoile d’or ?', reponse: 'Quand tu réussis une notion plusieurs fois, ton tampon devient une étoile d’or.', voix: 'purgee', duree: 2.6 },
  { jours: 0, h: 17, min: 6, question: 'et les accessoires ça sert à quoi', reponse: 'Les accessoires habillent ton personnage. Tu en gagnes en avançant.', voix: null },
  { jours: 0, h: 17, min: 9, question: 'Tu as quel âge ?', reponse: null, voix: 'ok', duree: 1.4 },
  { jours: -35, h: 18, min: 15, question: 'Pourquoi tu t’appelles Ari ?', reponse: 'C’est le nom qu’on m’a donné. Il est court, facile à dire !', voix: 'ligne_purgee', duree: null },
];

const iso = (ms) => new Date(ms).toISOString();

function echangesDe(childId, maintenant) {
  if (childId !== 'c1') return [];
  const hier = hierParis(maintenant);
  return GRAINES.map((g, k) => {
    const jour = decalerJour(hier, g.jours);
    const posee = debutJourParisMs(jour) + (g.h * 60 + g.min) * 60000;
    let voix = null;
    if (g.voix === 'ok') voix = { etat: 'ok', url: AUDIO, duree_s: g.duree, prise_le: iso(posee - 4000) };
    if (g.voix === 'purgee') voix = { etat: 'purgee', url: null, duree_s: g.duree, prise_le: iso(posee - 3000) };
    if (g.voix === 'ligne_purgee') voix = { etat: 'purgee', url: null, duree_s: null, prise_le: null };
    return {
      jour,
      id: '90000000-0000-4000-8000-' + String(k + 1).padStart(12, '0'),
      posee_le: iso(posee),
      question: g.question,
      reponse: g.reponse,
      prompt_version: '1',
      voix,
    };
  });
}

export function questions_ari(params = {}, maintenant = new Date()) {
  if (!CHILDREN.some((c) => c.id === params.child_id)) return undefined;
  const date = estDateCivile(params.date) ? params.date : hierParis(maintenant);
  const from = debutJourParisMs(date);
  const to = debutJourParisMs(decalerJour(date, 1));
  const echanges = echangesDe(params.child_id, maintenant).filter((e) => e.jour === date);
  return {
    child_id: params.child_id,
    from: iso(from),
    to: iso(to),
    validite_s: VALIDITE_S,
    expire_le: iso(maintenant.getTime() + VALIDITE_S * 1000),
    nb_echanges: echanges.length,
    jours: echanges.length
      ? [{ jour: date, echanges: echanges.map(({ jour: _j, ...e }, k) => ({ ...e, rang: k + 1 })) }]
      : [],
  };
}
