/* ============================================================
   Aristocles — Déroulé d'une séance, tour par tour (DEROULE-COMPLET)
   L'Edge rend `deroule[]` (contrat v2.10, § 2.3) : à chaque tour,
   l'étape du parcours, les boutons touchés par l'enfant, les outils
   appelés par Ari et ceux qui lui ont été refusés. Rien de l'enfant :
   des codes et des libellés de l'app.
   Dans le fil, le déroulé d'un tour se pose, replié, devant le premier
   message d'Ari de ce tour ; un tour sans message (outil seul, refus,
   bouton sans tour qui suive) se glisse à son heure comme une ligne
   à part.
   ============================================================ */

// Raisons d'un refus (`outils_refuses[].raison`) en clair.
export const LIBELLE_RAISON_REFUS = {
  hors_regime: 'hors du mode Devoirs',
  illisible: 'arguments illisibles',
  illisible_grille: 'grille illisible',
  sans_numero: 'sans numéro de consigne utilisable',
  sans_texte: 'sans texte',
  sans_mot: 'sans mot',
  sans_consigne: 'sans consigne',
  sans_nombre: 'sans nombre',
};

const tableau = (v) => (Array.isArray(v) ? v : []);

// Une entrée de `deroule[]` → la forme du front.
export function adapterTourDeroule(t) {
  return {
    tour: Number.isInteger(t?.tour) ? t.tour : null,
    // 1, puis 2… à chaque reprise de la séance (le compteur de tours repart).
    passage: Number.isInteger(t?.passage) && t.passage > 0 ? t.passage : 1,
    debutAt: t?.debut_at || null,
    origine: t?.origine || null,
    typeTrigger: t?.type_trigger || null,
    etape: t?.etape && t.etape.etape ? { type: t.etape.type || null, etape: t.etape.etape } : null,
    boutons: tableau(t?.boutons).map((b) => ({ id: b.id, libelle: b.libelle ?? null })),
    // null : pas de trace des outils sur ce tour (séance antérieure au
    // build qui l'émet) — à ne pas afficher « aucun ».
    outils: Array.isArray(t?.outils) ? t.outils.filter((o) => typeof o === 'string') : null,
    outilsRefuses: tableau(t?.outils_refuses).map((r) => ({ outil: r.outil, raison: r.raison || null, type: r.type || null })),
    interactionIds: tableau(t?.interaction_ids),
  };
}

// Un tour dit-il quelque chose de plus que son numéro ?
export function tourParlant(t) {
  return Boolean(t.etape || t.boutons.length || t.outils?.length || t.outilsRefuses.length);
}

// → { parInteraction: Map(id du 1er message d'Ari → tour), extras: [{ createdAt, deroule }] }.
// Les tours sans message mais parlants deviennent des lignes du fil, à
// leur heure (`debutAt`) ; à défaut d'heure, ils ne s'affichent pas dans
// le fil (ils restent dans la chronologie technique).
export function placerDeroule(deroule) {
  const parInteraction = new Map();
  const extras = [];
  for (const t of deroule) {
    if (t.interactionIds.length) parInteraction.set(t.interactionIds[0], t);
    else if (tourParlant(t) && t.debutAt) extras.push({ createdAt: t.debutAt, deroule: t });
  }
  return { parInteraction, extras };
}

// Les lignes du déroulé d'un tour : [libellé, valeur] — rien de vide.
export function lignesDeroule(t) {
  const lignes = [];
  if (t.etape) lignes.push(['Étape', t.etape.etape + (t.etape.type ? ' (' + t.etape.type + ')' : '')]);
  for (const b of t.boutons) lignes.push(['Bouton touché', b.libelle ? '« ' + b.libelle + ' »' : b.id]);
  if (t.origine === 'trigger') lignes.push(['Déclencheur', t.typeTrigger || '—']);
  lignes.push(['Outils appelés', t.outils == null ? 'non tracé' : t.outils.length ? t.outils.join(', ') : 'aucun']);
  for (const r of t.outilsRefuses) {
    const raison = LIBELLE_RAISON_REFUS[r.raison] || r.raison || '—';
    lignes.push(['Outil refusé', r.outil + ' — ' + raison]);
  }
  return lignes;
}

// Le résumé replié : « Déroulé · tour 3 · 2 outils · 1 refusé » ; sur
// une séance reprise, « Déroulé · tour 1 · reprise · … ». « non tracé »
// reste un texte neutre (séance ancienne, tour abandonné) : pas un défaut.
export function resumeDeroule(t) {
  const morceaux = ['Déroulé', t.tour == null ? 'hors tour' : 'tour ' + t.tour];
  if (t.passage > 1) morceaux.push(t.passage === 2 ? 'reprise' : 'reprise ' + (t.passage - 1));
  if (t.etape) morceaux.push(t.etape.etape);
  if (t.boutons.length) morceaux.push(t.boutons.length === 1 ? '1 bouton' : t.boutons.length + ' boutons');
  if (t.outils?.length) morceaux.push(t.outils.length === 1 ? '1 outil' : t.outils.length + ' outils');
  if (t.outilsRefuses.length) morceaux.push(t.outilsRefuses.length === 1 ? '1 refusé' : t.outilsRefuses.length + ' refusés');
  return morceaux.join(' · ');
}
