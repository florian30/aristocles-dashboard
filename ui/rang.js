/* ============================================================
   Aristocles — Rang d'une consigne en Devoirs (DASH-CONSIGNE-RANG)
   L'enfant vit « consigne 3 », pas « écran 5 » : en Devoirs, le rang
   est la place de l'écran parmi les écrans de type `exercice`
   (1..n, dans l'ordre de position). Fonctions pures, sans DOM.
   ============================================================ */

// Rang (1..n) de l'écran `ecran` parmi les écrans `exercice` de la séance,
// ou null : hors Devoirs, écran d'un autre type, ou écran introuvable.
export function rangConsigne(seance, ecran) {
  if (!seance || seance.mode !== 'devoirs' || !ecran || ecran.type !== 'exercice') return null;
  const exercices = (seance.ecrans || []).filter((e) => e.type === 'exercice')
    .sort((a, b) => a.position - b.position);
  const k = exercices.findIndex((e) => e.position === ecran.position);
  return k < 0 ? null : k + 1;
}

// Libellé court d'un écran : « Consigne k » en Devoirs pour un écran
// exercice, sinon « Écran n » (inchangé).
export function libelleEcran(seance, ecran) {
  const k = rangConsigne(seance, ecran);
  return k ? 'Consigne ' + k : 'Écran ' + ecran.position;
}
