/* ============================================================
   Trace IA d'un tour (action `tour`) : la génération (rôle,
   modèle, version de prompt, latence, volumes, coût — inconnu
   jamais compté 0 —, succès ou erreur), le prompt système, la
   requête et la réponse brutes. `trace: null` = purgée après
   90 jours (ou jamais tracée). La réplique d'Ari et le message
   de l'enfant qui la précède sont repris de `session_detail`.
   Tout passe par textContent (<pre> pour le brut).
   ============================================================ */

import { construireHash } from '../router.js';
import { nomRole } from '../ui/blocs.js';
import { boutonCopier, carteKpi, el, etatErreur, lien, repliable } from '../ui/dom.js';
import { fmtEuros } from '../ui/format.js';
import { fmtInstantParis } from '../ui/paris.js';
import { fmtLatence } from '../ui/sante.js';
import { fmtVolume } from '../ui/unites.js';

export const titre = 'Trace IA';

export async function rendre({ route, api, signal }) {
  const [tour, seance] = await Promise.all([
    api.tour(route.env, route.generationId, { signal }),
    api.detail(route.env, route.sessionId, { signal }),
  ]);

  const vue = el('div', 'vue reader vue-tour');
  const retour = construireHash({ env: route.env, vue: 'seances', sessionId: route.sessionId, query: route.query });
  vue.append(lien(retour, 'reader-back', '← Retour à la séance' + (seance ? ' de ' + seance.childName : '')));
  if (!tour) {
    vue.append(etatErreur('Tour introuvable', 'Aucun appel IA « ' + route.generationId + ' » sur ' + route.env + '.'));
    return vue;
  }

  const g = tour.generation;
  const tete = el('div', 'reader-head');
  const titres = el('div', 'reader-titles');
  titres.append(el('span', 'eyebrow', 'Trace IA d’un tour'), el('h1', 'page-title', seance ? 'Séance de ' + seance.childName : 'Tour IA'));
  tete.append(titres, el('div', 'reader-meta', fmtInstantParis(g.createdAt)));
  vue.append(tete);

  const corps = el('div', 'reader-body');
  vue.append(corps);

  const echange = replique(seance, g.id);
  if (echange) corps.append(echange);

  corps.append(blocGeneration(g));

  if (!tour.trace) {
    const purgee = el('section', 'etat etat-vide trace-purgee');
    purgee.append(
      el('p', 'etat-titre-neutre', 'Trace purgée (conservée 90 jours)'),
      el('p', 'etat-detail', 'La requête et la réponse brutes ne sont plus disponibles. Une trace peut aussi n’avoir jamais existé : seuls les appels du tuteur postérieurs au 14 septembre 2026 sont tracés.'),
    );
    corps.append(purgee);
    return vue;
  }

  corps.append(blocPrompt(tour.promptSysteme));
  corps.append(blocJson('Requête envoyée au modèle', tour.trace.requete,
    [tour.trace.fournisseur, tour.trace.modele, tour.trace.promptVersion != null ? 'prompt v' + tour.trace.promptVersion : null].filter(Boolean).join(' · ')));
  corps.append(blocJson('Réponse du modèle', tour.trace.reponse, 'reçue ' + fmtInstantParis(tour.trace.createdAt)));
  return vue;
}

// Réplique d'Ari liée à cette génération, et le message de l'enfant juste avant.
function replique(seance, generationId) {
  if (!seance) return null;
  for (const ecran of seance.ecrans) {
    const k = ecran.interactions.findIndex((i) => i.generationId === generationId);
    if (k < 0) continue;
    const avant = ecran.interactions.slice(0, k).reverse().find((i) => i.locuteur === 'enfant' && i.texte);
    const bloc = el('section', 'resume-card');
    bloc.append(el('span', 'eyebrow', 'Écran ' + ecran.position));
    const fil = el('ol', 'bulles');
    if (avant) {
      const b = el('li', 'bulle is-enfant');
      b.append(el('span', 'bulle-qui', seance.childName), el('p', 'bulle-texte', avant.texte));
      fil.append(b);
    }
    const b = el('li', 'bulle is-ari');
    b.append(el('span', 'bulle-qui', 'Ari'), el('p', 'bulle-texte', ecran.interactions[k].texte || '(sans texte)'));
    fil.append(b);
    bloc.append(fil);
    return bloc;
  }
  return null;
}

function blocGeneration(g) {
  const section = el('section', 'trace-generation');
  const tete = el('div', 'trace-generation-tete');
  tete.append(nomRole(g.role), el('span', 'chip ' + (g.succes ? 'is-success' : 'is-failure'), g.succes ? 'Succès' : 'Échec'));
  section.append(tete);

  const volumes = g.unite === 'token'
    ? fmtVolume(g.volumeEntree, 'token') + ' → ' + fmtVolume(g.volumeSortie, 'token')
    : fmtVolume(g.volumeEntree, g.unite);
  const grille = el('div', 'kpi-grid kpi-grid-compact');
  const cout = carteKpi('Coût estimé', fmtEuros(g.eur), g.eur == null ? 'prix absent du catalogue' : null);
  if (g.eur == null) cout.querySelector('.kpi-value').classList.add('is-unknown');
  grille.append(
    carteKpi('Modèle', g.modele || '—'),
    carteKpi('Version du prompt', g.promptVersion != null ? 'v' + g.promptVersion : '—'),
    carteKpi('Latence', fmtLatence(g.latenceMs)),
    carteKpi('Volumes', volumes, 'entrée → sortie'),
    cout,
  );
  section.append(grille);
  if (g.erreur) section.append(el('pre', 'json-bloc is-failure', g.erreur));
  if (g.metadata) section.append(el('p', 'cell-note mono', 'metadata : ' + JSON.stringify(g.metadata)));
  section.append(el('p', 'cell-note mono', 'llm_generation_id : ' + g.id));
  return section;
}

function blocPrompt(p) {
  if (!p) {
    const bloc = el('section', 'etat etat-vide');
    bloc.append(el('p', 'etat-detail', 'Prompt système indisponible pour ce tour.'));
    return bloc;
  }
  const titre = el('span', 'fil-titre');
  titre.append(el('span', 'row-name', 'Prompt système'),
    el('span', 'cell-note', [p.regime, p.promptVersion != null ? 'v' + p.promptVersion : null, p.taille != null ? p.taille + ' caractères' : null, p.sha256 ? 'sha256 ' + p.sha256 : null].filter(Boolean).join(' · ')));
  const corps = el('div', 'fil-corps');
  corps.append(el('pre', 'trace-pre', p.texte || ''),
    el('p', 'cell-note', 'Vu pour la première fois ' + fmtInstantParis(p.premiereVueAt) + '. Le contexte de séance est dans la requête (session_context).'));
  return repliable({ classe: 'fil-card', entete: [titre, boutonCopier(() => p.texte || '')], contenu: [corps] });
}

function blocJson(libelle, valeur, note) {
  const texte = valeur == null ? 'null' : JSON.stringify(valeur, null, 2);
  const titre = el('span', 'fil-titre');
  titre.append(el('span', 'row-name', libelle));
  if (note) titre.append(el('span', 'cell-note', note));
  return repliable({ classe: 'fil-card', entete: [titre, boutonCopier(texte)], contenu: [el('pre', 'trace-pre', texte)] });
}
