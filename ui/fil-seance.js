/* ============================================================
   Aristocles — Mot à mot d'une séance en un seul fil (DASH-FIL-ORDRE)
   L'Edge range les tours par écran (`ecrans[].interactions[]`, triés
   par position). En Devoirs, l'enfant revient sur un écran déjà
   ouvert : lu écran par écran, une phrase plus récente remonte. Ici
   les tours de tous les écrans sont fusionnés et triés par
   `createdAt` (comme l'app, D23), avec un intertitre à chaque
   changement d'écran.
   À égalité d'heure, l'ordre reçu (écrans puis position) est gardé.
   Un tour sans heure prend celle du tour qui le précède dans l'ordre
   reçu : il reste à côté de ses voisins.
   ============================================================ */

// → [{ ecran, retour } | { ecran, interaction }] : un intertitre
// (`retour` : l'écran a déjà paru plus haut) puis ses tours.
export function filChronologique(ecrans) {
  const tours = [];
  let precedent = -Infinity;
  for (const ecran of ecrans) {
    for (const interaction of ecran.interactions) {
      const t = interaction.createdAt ? Date.parse(interaction.createdAt) : NaN;
      if (!Number.isNaN(t)) precedent = t;
      tours.push({ ecran, interaction, t: precedent, rang: tours.length });
    }
  }
  tours.sort((a, b) => a.t - b.t || a.rang - b.rang);

  const fil = [];
  const vus = new Set();
  let courant = null;
  for (const { ecran, interaction } of tours) {
    if (ecran !== courant) {
      fil.push({ ecran, retour: vus.has(ecran) });
      vus.add(ecran);
      courant = ecran;
    }
    fil.push({ ecran, interaction });
  }
  return fil;
}
