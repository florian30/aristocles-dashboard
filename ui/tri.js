/* ============================================================
   Aristocles — Tri de tableau par colonne (pur, testé sous Deno)
   L'état vit dans la query du hash (`tri=<clé>&sens=asc|desc`) :
   un clic sur l'en-tête trie en croissant, un second en décroissant.
   Les valeurs absentes restent en fin de liste dans les deux sens ;
   à égalité, l'ordre d'arrivée est gardé (tri stable).
   ============================================================ */

// colonnes : { cle: { type: 'texte' | 'nombre' | 'date', valeur: (x) => … } }
export function triDepuisQuery(query = {}, colonnes, defaut) {
  if (Object.hasOwn(colonnes, query.tri) && (query.sens === 'asc' || query.sens === 'desc')) {
    return { cle: query.tri, sens: query.sens };
  }
  return defaut;
}

const absente = (v) => v == null || v === '' || Number.isNaN(v);

function comparable(type, v) {
  if (absente(v)) return null;
  if (type === 'nombre') return Number(v);
  if (type === 'date') {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : ms;
  }
  return String(v);
}

export function trier(liste, colonnes, { cle, sens }) {
  const col = colonnes[cle];
  if (!col) return [...liste];
  const signe = sens === 'desc' ? -1 : 1;
  return liste
    .map((x, i) => ({ x, i, v: comparable(col.type, col.valeur(x)) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return (a.v === null) - (b.v === null) || a.i - b.i;
      const c = col.type === 'texte'
        ? a.v.localeCompare(b.v, 'fr', { sensitivity: 'base', numeric: true })
        : a.v - b.v;
      return c * signe || a.i - b.i;
    })
    .map(({ x }) => x);
}

// Query après un clic sur l'en-tête `cle`.
export function queryTri(query = {}, cle, triCourant) {
  const sens = triCourant && triCourant.cle === cle && triCourant.sens === 'asc' ? 'desc' : 'asc';
  return { ...query, tri: cle, sens };
}
