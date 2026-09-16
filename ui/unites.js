/* ============================================================
   Aristocles — Unités de facturation et coûts IA (pures)
   Contrat Edge (D37) : `tokens_input` d'un rôle n'est un nombre de
   tokens que si `par_role[].unite === 'token'` ; stt compte des
   SECONDES d'audio, tts des CARACTÈRES. Un coût null est INCONNU :
   il n'entre jamais dans un total comme un zéro.
   ============================================================ */

import { fmtDureeSec, fmtEntier, fmtEuros } from './format.js';

export const LIBELLE_UNITE = {
  token: 'tokens',
  seconde: 'secondes d’audio',
  caractere: 'caractères',
};

// Volume d'un rôle ou d'un poste, dans son unité.
export function fmtVolume(total, unite) {
  if (total == null) return '—';
  if (unite === 'seconde') return fmtDureeSec(total) + ' d’audio';
  if (unite === 'caractere') return fmtEntier(total) + (total > 1 ? ' caractères' : ' caractère');
  if (unite === 'token' || unite == null) return fmtEntier(total) + (total > 1 ? ' tokens' : ' token');
  return fmtEntier(total) + ' ' + unite; // unité future : affichée brute
}

function annotationInconnus(n) {
  if (!n) return null;
  return 'dont ' + n + (n > 1 ? ' appels' : ' appel') + ' au coût inconnu';
}

// Coût affichable + annotation. `bloc` : le bloc llm ou une ligne
// par_role, forme Edge adaptée ({ eur, appelsCoutInconnu }).
export function coutAffiche(bloc) {
  return {
    valeur: fmtEuros(bloc.eur),
    note: annotationInconnus(bloc.appelsCoutInconnu),
  };
}

// Adaptation du bloc `llm` de l'action `stats` (forme Edge →
// forme vue). Tolérant : les champs du contrat v2 (cout_eur null,
// appels_cout_inconnu) peuvent être absents.
export function adapterLlm(llm) {
  if (!llm) return null;
  const nombreOuNull = (v) => (v == null ? null : Number(v));
  return {
    eur: nombreOuNull(llm.cout_total_eur),
    appels: llm.appels || 0,
    appelsCoutInconnu: llm.appels_cout_inconnu || 0,
    tokensEntree: llm.tokens_input || 0,
    tokensSortie: llm.tokens_output || 0,
    volumesHorsTokens: (llm.volumes_hors_tokens || []).map((v) => ({
      unite: v.unite,
      total: v.total,
      appels: v.appels || 0,
    })),
    parRole: (llm.par_role || []).map((r) => ({
      role: r.role,
      unite: r.unite || 'token',
      eur: nombreOuNull(r.cout_eur),
      appels: r.appels || 0,
      appelsCoutInconnu: r.appels_cout_inconnu || 0,
      tokensEntree: r.tokens_input || 0,
      tokensSortie: r.tokens_output || 0,
    })),
  };
}

// Colonnes volume d'une ligne par rôle : entrée / sortie en tokens
// pour un rôle LLM ; volume unique dans son unité sinon.
export function volumesRole(r) {
  if (r.unite === 'token') {
    return { entree: fmtVolume(r.tokensEntree, 'token'), sortie: fmtVolume(r.tokensSortie, 'token') };
  }
  return { entree: fmtVolume(r.tokensEntree, r.unite), sortie: '—' };
}

