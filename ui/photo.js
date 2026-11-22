/* ============================================================
   Aristocles — Photos de séance
   Miniatures (action `photos_seance`, URLs d'affichage d'1 h signées
   en lot) agrandies dans un <dialog>, et téléchargement (action
   `photo`) : chaque clic redemande une URL signée (5 min, jamais en
   cache), puis déclenche le téléchargement par un lien <a download>
   créé à la volée. Aucune URL n'est affichée ni mise dans le hash.
   ============================================================ */

import { estAnnulation, etatErreurPhoto } from '../api.js';
import { el } from './dom.js';
import { fmtInstantParis, heureParis, jourParis } from './paris.js';

// Lance le téléchargement sans quitter la page : l'URL signée est en
// mode « téléchargement » (le serveur impose l'enregistrement).
export function declencherTelechargement(url, nomFichier) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier || '';
  a.rel = 'noopener';
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
}

// Bouton + message d'état (en cours, effacée, erreur).
export function boutonPhoto({ api, env, interactionId, libelle = 'Télécharger la photo' }) {
  const bloc = el('span', 'photo-action');
  const bouton = el('button', 'bouton bouton-photo', libelle);
  bouton.type = 'button';
  const etat = el('span', 'photo-etat');
  etat.setAttribute('role', 'status');
  bloc.append(bouton, etat);

  bouton.addEventListener('click', async () => {
    bouton.disabled = true;
    bouton.textContent = 'Téléchargement…';
    etat.textContent = '';
    etat.className = 'photo-etat';
    try {
      const photo = await api.photo(env, interactionId);
      declencherTelechargement(photo.url, photo.nomFichier);
      bouton.textContent = libelle;
      bouton.disabled = false;
      etat.textContent = photo.nomFichier ? 'Téléchargée : ' + photo.nomFichier : 'Téléchargée';
    } catch (e) {
      if (estAnnulation(e)) return;
      const { code, message } = etatErreurPhoto(e);
      etat.textContent = message;
      etat.classList.add(code === 'purgee' ? 'is-purgee' : 'is-failure');
      bouton.textContent = code === 'purgee' ? 'Photo effacée' : libelle;
      bouton.disabled = code === 'purgee';
    }
  });
  return bloc;
}

// Nom du fichier d'une page de copie de dictée : dictee-AAAA-MM-JJ-p2.jpg
// (jour de Paris de la prise ; rang 1-based de la photo dans la séance) ;
// liste-de-mots-AAAA-MM-JJ-p1.jpg pour la photo de la liste de mots.
export function nomFichierDictee(p) {
  const jour = p.priseLe ? jourParis(new Date(p.priseLe)) : null;
  return [p.source === 'liste' ? 'liste-de-mots' : 'dictee', jour, 'p' + (p.rang ?? 1)].filter(Boolean).join('-') + '.jpg';
}

// Photo sans `interaction_id` (copie de dictée : l'action `photo` ne la
// connaît pas) : on télécharge l'URL signée d'affichage qu'on a déjà,
// lue en blob pour que le navigateur l'enregistre au lieu de l'ouvrir.
// Même gabarit et même déclencheur que boutonPhoto. `chercher` est
// injectable pour les tests.
export function boutonPhotoUrl({ url, nomFichier, libelle = 'Télécharger', chercher = (...a) => fetch(...a) }) {
  const bloc = el('span', 'photo-action');
  const bouton = el('button', 'bouton bouton-photo', libelle);
  bouton.type = 'button';
  const etat = el('span', 'photo-etat');
  etat.setAttribute('role', 'status');
  bloc.append(bouton, etat);

  bouton.addEventListener('click', async () => {
    bouton.disabled = true;
    bouton.textContent = 'Téléchargement…';
    etat.textContent = '';
    etat.className = 'photo-etat';
    let lien = null;
    try {
      const reponse = await chercher(url);
      if (!reponse.ok) throw new Error('http ' + reponse.status);
      lien = URL.createObjectURL(await reponse.blob());
      declencherTelechargement(lien, nomFichier);
      etat.textContent = 'Téléchargée : ' + nomFichier;
    } catch {
      etat.textContent = 'Lien expiré — fermer et rouvrir';
      etat.classList.add('is-failure');
    } finally {
      if (lien) URL.revokeObjectURL(lien);
      bouton.textContent = libelle;
      bouton.disabled = false;
    }
  });
  return bloc;
}

// ---------- Miniatures (DASH-3, action `photos_seance`) ----------
// Les URLs signées en lot valent 1 h et ne forcent pas le
// téléchargement : elles vont dans <img>, jamais dans le hash.

// Les copies d'une même dictée n'ont pas d'interaction_id et partagent
// leur dictee_id : l'instant de prise les distingue. Deux pages d'un même
// envoi peuvent avoir le même instant (`{ts}_{seq}`, seq non rendu) :
// le rang parmi les photos de même clé départage (DASH-PHOTOS-DICTEE).
const clePhoto = (p) => [p.source, p.interactionId || p.dicteeId || p.ecranId, p.priseLe, p.redressee ? 'r' : 'o'].join(':');
const memesCle = (photos, p) => photos.filter((x) => clePhoto(x) === clePhoto(p));

// Lot de photos d'une séance, avec rafraîchissement partagé : quand une
// miniature ne charge plus (URL expirée), on redemande le lot une fois.
export function creerLotPhotos({ api, env, sessionId, photos }) {
  let enCours = null;
  const lot = {
    api,
    env,
    photos,
    async rafraichir() {
      enCours ||= api.photosSeance(env, sessionId).finally(() => { enCours = null; });
      const r = await enCours;
      if (r) lot.photos = r.photos;
      return lot.photos;
    },
  };
  return lot;
}

const LEGENDE_SOURCE = {
  dictee: 'Copie de dictée',
  liste: 'Photo de la liste de mots',
  devoirs: 'Photo de devoir',
};

function legendePhoto(p) {
  return [
    LEGENDE_SOURCE[p.source] || LEGENDE_SOURCE.devoirs,
    p.redressee ? 'redressée' : null,
    p.priseLe ? fmtInstantParis(p.priseLe) : null,
  ].filter(Boolean).join(' · ');
}

// Une tuile : miniature cliquable, ou « Photo effacée » si purgée.
export function miniaturePhoto(p, lot) {
  const tuile = el('figure', 'photo-tuile' + (p.redressee ? ' is-redressee' : ''));
  if (p.purgee) {
    tuile.classList.add('is-purgee');
    tuile.append(el('span', 'photo-effacee', 'Photo effacée'));
    tuile.append(el('figcaption', 'photo-legende', legendePhoto(p)));
    return tuile;
  }
  const bouton = el('button', 'photo-miniature');
  bouton.type = 'button';
  bouton.setAttribute('aria-label', 'Agrandir : ' + legendePhoto(p));
  const img = el('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = legendePhoto(p);
  img.src = p.url;
  bouton.append(img);
  const legende = el('figcaption', 'photo-legende', p.redressee ? 'redressée' : (heureParis(p.priseLe) || ''));
  tuile.append(bouton, legende);

  const occurrence = Math.max(0, memesCle(lot.photos, p).indexOf(p));
  const courante = () => memesCle(lot.photos, p)[occurrence] || p;
  bouton.addEventListener('click', () => ouvrirPhoto(courante(), lot));
  img.addEventListener('error', () => {
    if (tuile.querySelector('.photo-recharger')) return;
    tuile.classList.add('is-expiree');
    const recharger = el('button', 'bouton photo-recharger', 'Recharger');
    recharger.type = 'button';
    recharger.addEventListener('click', async () => {
      recharger.disabled = true;
      recharger.textContent = 'Rechargement…';
      try {
        await lot.rafraichir();
        const nouvelle = courante();
        if (nouvelle.purgee || !nouvelle.url) {
          tuile.replaceWith(miniaturePhoto(nouvelle, lot));
          return;
        }
        tuile.classList.remove('is-expiree');
        recharger.remove();
        img.src = nouvelle.url;
      } catch (e) {
        if (estAnnulation(e)) return;
        recharger.disabled = false;
        recharger.textContent = 'Échec — réessayer';
      }
    });
    tuile.append(recharger);
  });
  return tuile;
}

export function galeriePhotos(photos, lot) {
  const galerie = el('div', 'photo-galerie');
  for (const p of photos) galerie.append(miniaturePhoto(p, lot));
  return galerie;
}

// Agrandissement dans un <dialog> modal, retiré du DOM à la fermeture.
export function ouvrirPhoto(p, lot) {
  const dialogue = el('dialog', 'photo-dialogue');
  const img = el('img', 'photo-grande');
  img.alt = legendePhoto(p);
  img.src = p.url;
  const actions = el('div', 'photo-dialogue-actions');
  if (p.interactionId) {
    actions.append(boutonPhoto({
      api: lot.api, env: lot.env, interactionId: p.interactionId,
      libelle: p.redressee ? 'Télécharger l’original' : 'Télécharger',
    }));
  }
  else if (p.url) {
    actions.append(boutonPhotoUrl({ url: p.url, nomFichier: nomFichierDictee(p), libelle: 'Télécharger' }));
  }
  const fermer = el('button', 'bouton', 'Fermer');
  fermer.type = 'button';
  fermer.addEventListener('click', () => dialogue.close());
  actions.append(fermer);
  dialogue.append(img, el('p', 'photo-dialogue-legende', legendePhoto(p)), actions);
  dialogue.addEventListener('close', () => dialogue.remove());
  // Clic sur le fond (hors contenu) : fermer.
  dialogue.addEventListener('click', (e) => { if (e.target === dialogue) dialogue.close(); });
  document.body.append(dialogue);
  dialogue.showModal();
  return dialogue;
}
