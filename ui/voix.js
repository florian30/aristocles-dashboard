/* ============================================================
   Aristocles — Voix de l'enfant dans le mot à mot
   (STOCKAGE-AUDIO-STT lot 2, action `voix_seance`, contrat v2.9
   § 2.16). Chaque tour `message_enfant_vocal` qui a une prise gardée
   reçoit un petit lecteur <audio controls> ; une prise purgée (30
   jours), ou un tour listé dans `toursEffaces`, affiche « enregistrement
   effacé », sans erreur. Les prises sans tour (filtrées : silence,
   amorce… ou texte retouché) vont à part, « Autres prises de voix ».
   Les URLs signées valent 1 h : jamais affichées, jamais en cache,
   jamais dans le hash ; si un lecteur ne charge plus, « Recharger »
   redemande le lot. Si l'action manque (Edge pas à jour) ou échoue :
   rien n'est affiché, pas d'erreur. Texte en textContent seulement.
   ============================================================ */

import { estAnnulation } from '../api.js';
import { el } from './dom.js';
import { heureParis } from './paris.js';

export const TEXTE_EFFACE = 'enregistrement effacé';

// Filtres de l'Edge `stt` (pourquoi une prise n'a rendu aucun texte, ou
// un texte nettoyé).
export const LIBELLE_FILTRE = {
  aucun: null,
  silence: 'silence',
  pattern: 'phrase parasite',
  pattern_retire: 'phrase parasite retirée',
  court: 'trop court',
  amorce: 'amorce',
};

// Répartition PURE (testée sous Deno) : pour chaque tour vocal du fil,
// sa prise (`ok`) ou « effacé » ; le reste des prises va dans `autres`.
// Une prise rattachée à un tour absent du fil va aussi dans `autres`.
export function repartirVoix(lot, idsVocaux) {
  const vocaux = new Set(idsVocaux);
  const parInteraction = new Map();
  const autres = [];
  for (const p of lot.prises) {
    if (p.interactionId && vocaux.has(p.interactionId) && !parInteraction.has(p.interactionId)) {
      parInteraction.set(p.interactionId, p.purgee ? { etat: 'effacee', prise: p } : { etat: 'ok', prise: p });
    } else {
      autres.push(p);
    }
  }
  for (const id of lot.toursEffaces) {
    if (vocaux.has(id) && !parInteraction.has(id)) parInteraction.set(id, { etat: 'effacee', prise: null });
  }
  return { parInteraction, autres };
}

export function legendePrise(p) {
  return [
    LIBELLE_FILTRE[p.filtre] ?? (p.filtre === 'aucun' ? null : p.filtre),
    p.dureeS != null && Number.isFinite(p.dureeS) ? p.dureeS.toFixed(1).replace('.', ',') + ' s' : null,
    p.priseLe ? heureParis(p.priseLe) : null,
  ].filter(Boolean).join(' · ');
}

const mentionEffacee = () => el('span', 'voix-effacee', TEXTE_EFFACE);

// Un lecteur. `onPanne` : appelé une fois si l'audio ne charge plus.
function lecteur(p, onPanne) {
  const audio = el('audio', 'voix-lecteur');
  audio.setAttribute('controls', '');
  audio.setAttribute('preload', 'none');
  audio.setAttribute('src', p.url);
  audio.setAttribute('aria-label', 'Écouter la prise' + (p.priseLe ? ' de ' + heureParis(p.priseLe) : ''));
  audio.addEventListener('error', () => onPanne(), { once: true });
  return audio;
}

// Remplit les emplacements (bulles des tours vocaux) et le bloc
// « Autres prises de voix ». `voix` : { parInteraction: Map(id →
// élément), autres: élément } ; `charger()` rend le lot ou null.
export async function remplirVoix(voix, charger) {
  let lot = null;
  try {
    lot = await charger();
  } catch (e) {
    if (estAnnulation(e)) return;
    lot = null;
  }
  if (!lot) {
    // Action absente ou en panne : rien, sans erreur. Un « Recharger »
    // resté en suspens redevient cliquable.
    const enSuspens = voix.autres.querySelector('.voix-recharger');
    if (enSuspens) enSuspens.disabled = false;
    return;
  }

  let rechargeEnCours = false;
  const surPanne = () => {
    if (rechargeEnCours || voix.autres.querySelector('.voix-recharger')) return;
    const bouton = el('button', 'bouton voix-recharger', 'Recharger les enregistrements');
    bouton.type = 'button';
    bouton.addEventListener('click', () => {
      rechargeEnCours = true;
      bouton.disabled = true;
      remplirVoix(voix, charger);
    });
    voix.autres.prepend(bouton);
  };

  const { parInteraction, autres } = repartirVoix(lot, voix.parInteraction.keys());
  for (const [id, emplacement] of voix.parInteraction) {
    emplacement.textContent = '';
    const r = parInteraction.get(id);
    if (!r) continue;
    emplacement.append(r.etat === 'ok' ? lecteur(r.prise, surPanne) : mentionEffacee());
  }

  voix.autres.textContent = '';
  if (!autres.length) return;
  voix.autres.append(el('span', 'eyebrow', 'Autres prises de voix'),
    el('p', 'cell-note', 'Prises sans tour dans le mot à mot : filtrées par la transcription, ou texte retouché.'));
  const liste = el('ol', 'voix-autres-liste');
  for (const p of autres) {
    const item = el('li', 'voix-autre');
    item.append(el('span', 'bulle-heure', legendePrise(p)),
      el('p', 'bulle-texte' + (p.transcription ? '' : ' is-empty'), p.transcription || '(aucun texte rendu)'));
    item.append(p.purgee ? mentionEffacee() : lecteur(p, surPanne));
    liste.append(item);
  }
  voix.autres.append(liste);
}
