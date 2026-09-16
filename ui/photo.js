/* ============================================================
   Aristocles — Téléchargement d'une photo de devoir (action `photo`)
   Chaque clic redemande une URL signée (5 min, jamais en cache),
   puis déclenche le téléchargement par un lien <a download> créé
   à la volée. L'URL n'est ni affichée, ni mise dans le hash.
   ============================================================ */

import { estAnnulation, etatErreurPhoto } from '../api.js';
import { el } from './dom.js';

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
