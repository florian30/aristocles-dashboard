/* ============================================================
   Aristocles — Briques DOM : nœuds, tableaux, états
   (chargement / erreur / vide / à venir), cartes repliables.
   ============================================================ */

export function el(tag, className, texte) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (texte !== undefined && texte !== null) e.textContent = texte;
  return e;
}

export function lien(href, className, texte) {
  const a = el('a', className, texte);
  a.href = href;
  return a;
}

// Tableau en grille CSS. colonnes : [{ titre, classe?, largeur }],
// lignes : tableau de tableaux de cellules (Node ou texte), ou
// { cellules, href?, classe? } pour une ligne cliquable.
export function tableau({ classe = '', colonnes, lignes, vide = 'Aucune donnée.' }) {
  const table = el('div', 'data-table ' + classe);
  table.style.setProperty('--colonnes', colonnes.map((c) => c.largeur || '1fr').join(' '));

  const tete = el('div', 'table-head');
  for (const c of colonnes) tete.append(el('span', 'eyebrow ' + (c.classe || ''), c.titre));
  table.append(tete);

  if (lignes.length === 0) {
    table.append(el('div', 'table-empty', vide));
    return table;
  }
  for (const ligne of lignes) {
    const def = Array.isArray(ligne) ? { cellules: ligne } : ligne;
    const rangee = def.href ? lien(def.href, 'table-row is-link') : el('div', 'table-row');
    if (def.classe) rangee.classList.add(...def.classe.split(' '));
    def.cellules.forEach((cellule, i) => {
      const noeud = cellule instanceof Node ? cellule : el('span', null, cellule);
      if (colonnes[i].classe) noeud.classList.add(...colonnes[i].classe.split(' '));
      rangee.append(noeud);
    });
    table.append(rangee);
  }
  return table;
}

export function carteKpi(libelle, valeur, note) {
  const carte = el('div', 'kpi-card');
  carte.append(el('div', 'eyebrow', libelle), el('div', 'kpi-value', valeur));
  if (note) carte.append(el('div', 'kpi-note', note));
  return carte;
}

export function etatChargement(texte = 'Chargement…') {
  const bloc = el('div', 'etat etat-chargement');
  bloc.setAttribute('role', 'status');
  bloc.append(el('span', 'spinner'), el('span', null, texte));
  return bloc;
}

export function etatErreur(titre, detail, actions = []) {
  const bloc = el('div', 'etat etat-erreur');
  bloc.setAttribute('role', 'alert');
  bloc.append(el('p', 'etat-titre', titre));
  if (detail) bloc.append(el('p', 'etat-detail', detail));
  if (actions.length) {
    const rangee = el('div', 'etat-actions');
    rangee.append(...actions);
    bloc.append(rangee);
  }
  return bloc;
}

export function etatAVenir(titre, description, lot) {
  const bloc = el('section', 'etat etat-a-venir');
  bloc.append(el('span', 'eyebrow', 'À venir' + (lot ? ' · ' + lot : '')), el('h2', 'etat-grand-titre', titre));
  if (description) bloc.append(el('p', 'etat-detail', description));
  return bloc;
}

// Carte repliable (role=button, aria-expanded, Entrée/Espace).
export function repliable({ classe, entete, contenu, ouvert = false }) {
  const carte = el('section', 'repliable ' + (classe || ''));
  const resume = el('div', 'repliable-resume');
  resume.setAttribute('role', 'button');
  resume.setAttribute('tabindex', '0');
  resume.append(...entete, el('span', 'caret'));
  const corps = el('div', 'repliable-corps');
  corps.append(...contenu);
  carte.append(resume, corps);

  const appliquer = (etat) => {
    carte.classList.toggle('is-open', etat);
    corps.hidden = !etat;
    resume.setAttribute('aria-expanded', String(etat));
  };
  appliquer(ouvert);
  const basculer = () => appliquer(!carte.classList.contains('is-open'));
  resume.addEventListener('click', basculer);
  resume.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      basculer();
    }
  });
  return carte;
}
