/* ============================================================
   Aristocles — Sérialisation du `detail` d'un événement client
   Les valeurs scalaires tiennent sur la ligne (`cle:valeur`) ;
   les valeurs imbriquées (objets, tableaux) sortent en JSON
   indenté lisible, jamais en « [object Object] ».
   ============================================================ */

export function estScalaire(v) {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}

// → { ligne: 'tour:7 origine:ptt', blocs: [{ cle, json }] }
export function serialiserDetail(detail) {
  if (detail == null) return { ligne: '', blocs: [] };
  if (estScalaire(detail)) return { ligne: String(detail), blocs: [] };
  if (Array.isArray(detail)) return { ligne: '', blocs: [{ cle: null, json: JSON.stringify(detail, null, 2) }] };

  const paires = [];
  const blocs = [];
  for (const [cle, valeur] of Object.entries(detail)) {
    if (estScalaire(valeur)) paires.push(cle + ':' + valeur);
    else if (valeur !== undefined) blocs.push({ cle, json: JSON.stringify(valeur, null, 2) });
  }
  return { ligne: paires.join(' '), blocs };
}

// Version texte d'un seul tenant (utile aux tests et au copier-coller).
export function detailEnTexte(detail) {
  const { ligne, blocs } = serialiserDetail(detail);
  const parties = ligne ? [ligne] : [];
  for (const b of blocs) parties.push((b.cle ? b.cle + ': ' : '') + b.json);
  return parties.join('\n');
}
