// DASH-PHOTOS-DICTEE (22-11-2026) — trois copies d'une même dictée : un
// clic sur une vignette ouvre CETTE photo, pas une voisine. Les copies
// de dictée n'ont pas d'interaction_id et partagent le même dictee_id ;
// la clé d'une photo doit donc aussi tenir compte de l'instant de prise.

import { assertEquals } from 'jsr:@std/assert@1';
import { adapterPhotosSeance } from '../api.js';
import { creerLotPhotos, galeriePhotos, nomFichierDictee } from '../ui/photo.js';

// Mini-DOM : el(), classList, événements, <dialog>.showModal().
function avecMiniDom(f) {
  class Noeud {
    constructor(tag) {
      this.tag = tag;
      this.enfants = [];
      this.className = '';
      this.textContent = '';
      this.attributs = {};
      this.ecouteurs = {};
      const n = this;
      this.classList = {
        add: (...c) => { n.className = [...n.className.split(' '), ...c].filter(Boolean).join(' '); },
        remove: (...c) => { n.className = n.className.split(' ').filter((x) => !c.includes(x)).join(' '); },
        contains: (c) => n.className.split(' ').includes(c),
      };
    }
    append(...e) { this.enfants.push(...e); }
    setAttribute(k, v) { this.attributs[k] = v; }
    addEventListener(type, f) { (this.ecouteurs[type] ||= []).push(f); }
    declencher(type) { for (const f of this.ecouteurs[type] || []) f({ target: this }); }
    querySelector() { return null; }
    showModal() {}
    close() {}
    remove() {}
  }
  const corps = new Noeud('body');
  const avant = globalThis.document;
  globalThis.document = { createElement: (tag) => new Noeud(tag), body: corps };
  const remettre = () => { globalThis.document = avant; };
  let r;
  try { r = f(corps); } catch (e) { remettre(); throw e; }
  if (r && typeof r.then === 'function') return r.finally(remettre);
  remettre();
  return r;
}

const tous = (n, classe) => [
  ...(String(n.className).split(' ').includes(classe) ? [n] : []),
  ...(n.enfants || []).flatMap((e) => tous(e, classe)),
];

// Trois photos de copie de la même dictée (12:50, 13:11, 13:14 à Paris),
// telles que l'action `photos_seance` les rend.
const reponse = {
  session_id: 's1',
  validite_s: 3600,
  photos: [
    { rang: 1, source: 'dictee', ecran_id: 'e1', interaction_id: null, dictee_id: 'd1', redressee: false, prise_le: '2026-11-22T11:50:00.000Z', etat: 'disponible', url: 'https://x/1.jpg' },
    { rang: 2, source: 'dictee', ecran_id: 'e1', interaction_id: null, dictee_id: 'd1', redressee: false, prise_le: '2026-11-22T12:11:00.000Z', etat: 'disponible', url: 'https://x/2.jpg' },
    { rang: 3, source: 'dictee', ecran_id: 'e1', interaction_id: null, dictee_id: 'd1', redressee: false, prise_le: '2026-11-22T12:14:00.000Z', etat: 'disponible', url: 'https://x/3.jpg' },
  ],
};

Deno.test('photos : un clic sur chacune des trois copies de dictée ouvre cette copie', () => {
  avecMiniDom((corps) => {
    const { photos } = adapterPhotosSeance(reponse);
    const lot = creerLotPhotos({ api: {}, env: 'prod', sessionId: 's1', photos });
    const boutons = tous(galeriePhotos(photos, lot), 'photo-miniature');
    assertEquals(boutons.length, 3);
    const ouvertes = boutons.map((b) => {
      b.declencher('click');
      const dialogue = corps.enfants.at(-1);
      return tous(dialogue, 'photo-grande')[0].src;
    });
    assertEquals(ouvertes, ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg']);
  });
});

Deno.test('photos : deux pages d’un même envoi (même instant) ouvrent chacune la leur', () => {
  avecMiniDom((corps) => {
    const meme = { ...reponse, photos: reponse.photos.map((p) => ({ ...p, prise_le: '2026-11-22T12:14:00.000Z' })) };
    const { photos } = adapterPhotosSeance(meme);
    const lot = creerLotPhotos({ api: {}, env: 'prod', sessionId: 's1', photos });
    const boutons = tous(galeriePhotos(photos, lot), 'photo-miniature');
    const ouvertes = boutons.map((b) => {
      b.declencher('click');
      return tous(corps.enfants.at(-1), 'photo-grande')[0].src;
    });
    assertEquals(ouvertes, ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg']);
  });
});

Deno.test('photos : après un rechargement du lot, la 3e vignette ouvre la 3e copie (nouvelle URL)', async () => {
  await avecMiniDom(async (corps) => {
    const { photos } = adapterPhotosSeance(reponse);
    const neuves = { ...reponse, photos: reponse.photos.map((p) => ({ ...p, url: p.url.replace('x/', 'y/') })) };
    const api = { photosSeance: async () => adapterPhotosSeance(neuves) };
    const lot = creerLotPhotos({ api, env: 'prod', sessionId: 's1', photos });
    const boutons = tous(galeriePhotos(photos, lot), 'photo-miniature');
    await lot.rafraichir();
    boutons[2].declencher('click');
    assertEquals(tous(corps.enfants.at(-1), 'photo-grande')[0].src, 'https://y/3.jpg');
  });
});

// La photo de la liste de mots (source « liste », DASH-5) n'est pas un devoir.
Deno.test('photos : la photo de la liste de mots garde sa source et sa légende', () => {
  avecMiniDom((corps) => {
    const { photos } = adapterPhotosSeance({ ...reponse, photos: [
      { ...reponse.photos[0], source: 'liste' },
      reponse.photos[1],
      { ...reponse.photos[2], source: 'devoirs', interaction_id: 'i1', dictee_id: null },
    ] });
    assertEquals(photos.map((p) => p.source), ['liste', 'dictee', 'devoirs']);
    const lot = creerLotPhotos({ api: {}, env: 'prod', sessionId: 's1', photos });
    const boutons = tous(galeriePhotos(photos, lot), 'photo-miniature');
    const legendes = boutons.map((b) => {
      b.declencher('click');
      return tous(corps.enfants.at(-1), 'photo-dialogue-legende')[0].textContent.split(' · ')[0];
    });
    assertEquals(legendes, ['Photo de la liste de mots', 'Copie de dictée', 'Photo de devoir']);
    assertEquals(nomFichierDictee(photos[0]), 'liste-de-mots-2026-11-22-p1.jpg');
    assertEquals(nomFichierDictee(photos[1]), 'dictee-2026-11-22-p2.jpg');
  });
});
