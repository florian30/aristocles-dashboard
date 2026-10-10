/* ============================================================
   Fiche enfant (action `enfant`) : identité et e-mail du parent,
   puis, sur la période choisie (≤ 92 jours, 92 par défaut) :
   séances (sans échange masquées sauf `sans_echange=1`), photos de
   devoirs en miniatures par séance, maîtrise par notion
   (état courant), devoirs, dictées, bilans et conversations parent,
   mémoire, écrans consultés, versions d'app.
   Tout contenu serveur (messages parent, sorties IA) passe par
   textContent.
   ============================================================ */

import { construireHash } from '../router.js';
import { champsLibres, tableVersions } from '../ui/blocs.js';
import { listeDictees } from '../ui/dictee.js';
import { boutonCopier, el, etatErreur, lien, repliable, tableau } from '../ui/dom.js';
import { barrePeriode } from '../ui/filtres.js';
import { fmtDureeSec, fmtEntier, pluriel } from '../ui/format.js';
import {
  LIBELLE_BILAN,
  LIBELLE_GENRE,
  LIBELLE_MAITRISE,
  LIBELLE_MEMOIRE,
  LIBELLE_MODE,
  LIBELLE_STATUT_BILAN,
  LIBELLE_VU_EN_CLASSE,
  libelleCloture,
} from '../ui/libelles.js';
import { fmtInstantParis, fmtJourCourt, jourParis } from '../ui/paris.js';
import { periodeDepuisQuery } from '../ui/periode.js';
import { estAnnulation } from '../api.js';
import { boutonPhoto, creerLotPhotos, galeriePhotos } from '../ui/photo.js';
import { avecSansEchange, bandeauSansEchange, puceSansEchange } from '../ui/sans-echange.js';
import { etoiles } from './familles.js';

export const titre = 'Fiche enfant';

export async function rendre({ route, api, signal }) {
  const periode = periodeDepuisQuery(route.query, new Date(), { defaut: '92j' });
  const fiche = await api.enfant(route.env, route.childId, periode.from, periode.to, { signal, avecSansEchange: avecSansEchange(route) });

  const vue = el('div', 'vue vue-familles vue-enfant');
  vue.append(lien(construireHash({ env: route.env, vue: 'familles' }), 'reader-back', '← Retour aux familles'));
  if (!fiche) {
    vue.append(etatErreur('Enfant introuvable', 'Aucun enfant « ' + route.childId + ' » sur ' + route.env + '.'));
    return vue;
  }
  const { identite: id } = fiche;
  document.title = id.prenom + ' · ' + route.env + ' · Aristocles';

  vue.append(entete(fiche), barrePeriode(route, periode));

  const env = route.env;
  const seances = section('Séances', fiche.seances.length, tableSeances(fiche.seances, env));
  const bandeau = bandeauSansEchange(route, fiche.sansEchange);
  if (bandeau) seances.querySelector('.section-title').after(bandeau);
  vue.append(
    seances,
    section('Photos de devoirs', fiche.photos.length, listePhotos(fiche.photos, api, env, signal),
      'Une photo est effacée automatiquement au bout de 90 jours : elle s’affiche alors « Photo effacée ».'),
    section('Maîtrise par notion', fiche.maitrise.length, tableMaitrise(fiche.maitrise), 'État courant, quelle que soit la période.'),
    section('Devoirs', fiche.devoirs.length, listeDevoirs(fiche.devoirs, env)),
    section('Dictées', fiche.dictees.length, blocDictees(fiche.dictees, env),
      'Chaque passage de dictée ouvre une séance en mode Dictée ; le compteur de séances de Familles ne les compte pas.'),
    section('Bilans parent', fiche.bilans.length, listeBilans(fiche.bilans)),
    section('Conversations parent', fiche.conversationsParent.length, listeConversations(fiche.conversationsParent, id.prenom)),
    section('Mémoire', null, blocMemoire(fiche.memoire), 'Profil extrait par l’IA au fil des séances (état courant).'),
    section('Écrans consultés', fiche.ecrans.length, tableEcrans(fiche.ecrans), 'D’après le journal d’usage : écrans hors séance.'),
    section('Versions d’app', null, tableVersions(fiche.versions, { vide: 'Aucun lancement sur la période.' })),
  );
  return vue;
}

// ---------- En-tête ----------

function entete(fiche) {
  const id = fiche.identite;
  const tete = el('div', 'fiche-head');
  const nom = el('div', 'fiche-nom');
  nom.append(el('h1', 'page-title', id.prenom));
  if (id.classe) nom.append(el('span', 'chip is-muted', id.classe));
  if (id.genre) nom.append(el('span', 'chip is-muted', LIBELLE_GENRE[id.genre] || id.genre));
  nom.append(etoiles(fiche.notionsAcquises));

  const parent = el('div', 'fiche-parent');
  parent.append(el('span', 'eyebrow', 'Parent'));
  if (id.parentEmail) {
    parent.append(el('span', 'mono email', id.parentEmail), boutonCopier(id.parentEmail, 'Copier l’e-mail'));
  } else {
    parent.append(el('span', 'row-muted', 'e-mail introuvable'));
  }
  if (id.parentId) parent.append(el('span', 'mono row-muted', id.parentId));

  tete.append(nom, parent, el('p', 'reader-sub',
    'Inscrit le ' + (id.createdAt ? fmtJourCourt(jourParis(id.createdAt)) + ' ' + jourParis(id.createdAt).slice(0, 4) : '—') +
    ' · ' + pluriel(fiche.notionsAcquises, 'notion acquise', 'notions acquises') + ' (tout l’historique)'));
  return tete;
}

function section(titreSection, n, contenu, explication) {
  const bloc = el('section', 'fiche-section');
  const titre = el('h2', 'section-title', titreSection);
  if (n != null) titre.append(el('span', 'section-count', fmtEntier(n)));
  bloc.append(titre);
  if (explication) bloc.append(el('p', 'bloc-explication', explication));
  bloc.append(contenu);
  return bloc;
}

const vide = (texte) => el('p', 'reader-empty', texte);

// ---------- Séances ----------

function tableSeances(seances, env) {
  return tableau({
    classe: 'seances-enfant',
    colonnes: [
      { titre: 'Début', largeur: '120px' },
      { titre: 'Séance', largeur: 'minmax(160px, 1.6fr)' },
      { titre: 'Durée', classe: 'cell-right', largeur: '80px' },
      { titre: 'Exercices', largeur: 'minmax(110px, 1fr)' },
      { titre: 'Pouces', largeur: '84px' },
      { titre: 'Clôture', largeur: '112px' },
    ],
    lignes: seances.map((s) => {
      const nom = el('span', 'row-name');
      const mode = el('span', 'row-mode');
      mode.append(el('span', 'mode-dot is-' + s.mode), document.createTextNode(LIBELLE_MODE[s.mode] || s.mode));
      nom.append(mode, el('span', 'cell-note', s.theme || 'Sans thème'));
      if (s.sansEchange) nom.append(puceSansEchange());
      const x = s.exercices;
      const cloture = libelleCloture(s.status, s.cloture);
      return {
        href: construireHash({ env, vue: 'seances', sessionId: s.id }),
        classe: s.sansEchange ? 'is-sans-echange' : '',
        cellules: [
          el('span', 'row-date', fmtInstantParis(s.startedAt)),
          nom,
          el('span', s.dureeSec == null ? 'row-open' : '', s.dureeSec == null ? 'En cours' : fmtDureeSec(s.dureeSec)),
          el('span', x.nb ? '' : 'row-muted', x.nb ? x.succes + ' réussi' + (x.succes > 1 ? 's' : '') + ' sur ' + x.nb + (x.fragile ? ' · ' + x.fragile + ' fragile' + (x.fragile > 1 ? 's' : '') : '') : 'Aucun'),
          el('span', s.pouces.haut || s.pouces.bas ? 'pouces' : 'row-muted', s.pouces.haut || s.pouces.bas ? '👍 ' + s.pouces.haut + '  👎 ' + s.pouces.bas : '—'),
          el('span', 'chip ' + cloture.cls, cloture.label),
        ],
      };
    }),
    vide: 'Aucune séance sur la période.',
  });
}

// ---------- Photos ----------

// Groupées par séance (plus récente d'abord) ; miniatures chargées par
// `photos_seance`, quelques séances à la fois. Si l'action manque ou
// échoue, la séance retombe sur la liste à télécharger.
const PHOTOS_EN_PARALLELE = 4;

function listePhotos(photos, api, env, signal) {
  if (!photos.length) return vide('Aucune photo de devoir sur la période.');
  const groupes = new Map();
  for (const p of photos) {
    const cle = p.sessionId || '';
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(p);
  }
  const bloc = el('div', 'photos-par-seance');
  const aCharger = [];
  for (const [sessionId, liste] of groupes) {
    const groupe = el('section', 'photos-groupe');
    const tete = el('div', 'photos-groupe-tete');
    tete.append(el('span', 'row-name', 'Séance du ' + fmtInstantParis(liste[liste.length - 1].createdAt)));
    if (sessionId) tete.append(lien(construireHash({ env, vue: 'seances', sessionId }), 'cell-note', 'Voir la séance'));
    const contenu = el('div', 'photos-groupe-contenu', sessionId ? 'Chargement des photos…' : null);
    groupe.append(tete, contenu);
    bloc.append(groupe);
    if (sessionId) aCharger.push({ sessionId, liste, contenu });
    else contenu.append(lignesPhotos(liste, api, env));
  }
  (async () => {
    let suivant = 0;
    const ouvrier = async () => {
      while (suivant < aCharger.length && !(signal && signal.aborted)) {
        const { sessionId, liste, contenu } = aCharger[suivant++];
        let lot = null;
        try {
          const r = await api.photosSeance(env, sessionId, { signal });
          if (r) lot = creerLotPhotos({ api, env, sessionId, photos: r.photos });
        } catch (e) {
          if (estAnnulation(e)) return;
        }
        contenu.textContent = '';
        contenu.append(lot ? galeriePhotos(lot.photos, lot) : lignesPhotos(liste, api, env));
      }
    };
    await Promise.all(Array.from({ length: Math.min(PHOTOS_EN_PARALLELE, aCharger.length) }, ouvrier));
  })();
  return bloc;
}

function lignesPhotos(photos, api, env) {
  const liste = el('ul', 'photo-liste');
  for (const p of photos) {
    const li = el('li', 'photo-ligne');
    const infos = el('span', 'photo-infos');
    infos.append(el('span', 'row-name', 'Photo du ' + fmtInstantParis(p.createdAt)));
    li.append(infos, boutonPhoto({ api, env, interactionId: p.interactionId, libelle: 'Télécharger' }));
    liste.append(li);
  }
  return liste;
}

// ---------- Maîtrise, devoirs, dictées ----------

function tableMaitrise(maitrise) {
  return tableau({
    classe: 'acq-table',
    colonnes: [
      { titre: 'Notion' },
      { titre: 'Maîtrise', largeur: '180px' },
      { titre: 'Vu en classe', largeur: '140px' },
      { titre: 'Mise à jour', classe: 'cell-right', largeur: '130px' },
    ],
    lignes: maitrise.map((a) => {
      const m = LIBELLE_MAITRISE[a.maitrise];
      const notion = el('span', 'row-name', a.notion || a.conceptId || '—');
      if (a.conceptId) notion.append(el('span', 'cell-note mono', a.conceptId));
      return [
        notion,
        el('span', 'acq-maitrise ' + (m ? m.cls : ''), (m ? m.label : a.maitrise) + (a.maitrise === 'acquise' || a.maitrise === 'parfaitement_acquise' ? ' ★' : '')),
        LIBELLE_VU_EN_CLASSE[a.vuEnClasse] || a.vuEnClasse || '—',
        el('span', 'row-muted', a.majAt ? fmtInstantParis(a.majAt) : '—'),
      ];
    }),
    vide: 'Aucune notion travaillée pour cet enfant.',
  });
}

function listeDevoirs(devoirs, env) {
  if (!devoirs.length) return vide('Aucun devoir sur la période.');
  const liste = el('ul', 'liste-simple');
  for (const d of devoirs) {
    const li = el('li');
    const titre = d.titre || 'Devoir';
    li.append(d.sessionId ? lien(construireHash({ env, vue: 'seances', sessionId: d.sessionId }), 'row-name', titre) : el('span', 'row-name', titre));
    li.append(el('span', 'row-muted', [
      d.matiere,
      d.pourLe ? 'pour le ' + fmtJourCourt(d.pourLe) : null,
      d.nbConsignes != null ? pluriel(d.nbConsignes, 'consigne') : null,
    ].filter(Boolean).join(' · ')));
    liste.append(li);
  }
  return liste;
}

function blocDictees(dictees, env) {
  if (!dictees.length) return vide('Aucune dictée sur la période.');
  return listeDictees(dictees, { env, avecJour: true });
}

// ---------- Bilans et conversations parent ----------

function listeBilans(bilans) {
  if (!bilans.length) return vide('Aucun bilan parent sur la période.');
  const liste = el('div', 'fils');
  for (const b of bilans) {
    const statut = LIBELLE_STATUT_BILAN[b.statut];
    const titre = el('span', 'fil-titre');
    titre.append(
      el('span', 'row-name', (LIBELLE_BILAN[b.type] || b.type || 'Bilan') + (b.periodeCle ? ' · ' + b.periodeCle : '')),
      el('span', 'cell-note', 'généré ' + fmtInstantParis(b.genereAt) + (b.regenereAt ? ' · régénéré ' + fmtInstantParis(b.regenereAt) : '')),
    );
    const drapeaux = el('span', 'ecran-flags');
    drapeaux.append(
      el('span', 'chip ' + (statut ? statut.cls : 'is-muted'), statut ? statut.label : b.statut || '—'),
      el('span', 'chip ' + (b.luAt ? 'is-success' : 'is-fragile'), b.luAt ? 'Lu' : 'Non lu'),
    );
    const corps = el('div', 'fil-corps');
    corps.append(champsLibres(b.contenu, { vide: 'Aucun contenu.' }));
    corps.append(el('p', 'cell-note', [
      b.modele ? 'Modèle : ' + b.modele : null,
      b.luAt ? 'Lu le ' + fmtInstantParis(b.luAt) : 'Pas encore lu par le parent',
    ].filter(Boolean).join(' · ')));
    liste.append(repliable({ classe: 'fil-card', entete: [titre, drapeaux], contenu: [corps] }));
  }
  return liste;
}

function listeConversations(conversations, prenom) {
  if (!conversations.length) return vide('Aucune conversation parent sur la période.');
  const liste = el('div', 'fils');
  for (const c of conversations) {
    const titre = el('span', 'fil-titre');
    titre.append(
      el('span', 'row-name', 'À propos du ' + (LIBELLE_BILAN[c.entreeType] || c.entreeType || 'bilan').toLowerCase() + (c.entreePeriodeCle ? ' · ' + c.entreePeriodeCle : '')),
      el('span', 'cell-note', pluriel(c.messages.length, 'message') + ' · dernier échange ' + fmtInstantParis(c.majAt)),
    );
    const fil = el('ol', 'bulles');
    for (const m of c.messages) {
      const parent = m.role === 'user';
      const bulle = el('li', 'bulle ' + (parent ? 'is-parent' : 'is-ari'));
      bulle.append(
        el('span', 'bulle-qui', parent ? 'Parent de ' + prenom : m.role === 'assistant' ? 'Ari' : m.role || '?'),
        el('p', 'bulle-texte', typeof m.contenu === 'string' ? m.contenu : JSON.stringify(m.contenu, null, 2)),
      );
      fil.append(bulle);
    }
    const corps = el('div', 'fil-corps');
    corps.append(fil, el('p', 'cell-note', [c.modele ? 'Modèle : ' + c.modele : null, 'ouverte ' + fmtInstantParis(c.creeAt)].filter(Boolean).join(' · ')));
    liste.append(repliable({ classe: 'fil-card', entete: [titre], contenu: [corps] }));
  }
  return liste;
}

// ---------- Mémoire, écrans ----------

function blocMemoire(memoire) {
  if (!memoire) return vide('Aucun profil mémoire pour cet enfant.');
  const { derniereExtractionAt, updatedAt, ...champs } = memoire;
  const bloc = el('div', 'memoire');
  bloc.append(champsLibres(champs, { libelles: LIBELLE_MEMOIRE }),
    el('p', 'cell-note', 'Dernière extraction : ' + fmtInstantParis(derniereExtractionAt) + ' · mis à jour ' + fmtInstantParis(updatedAt)));
  return bloc;
}

function tableEcrans(ecrans) {
  return tableau({
    classe: 'ecrans-table',
    colonnes: [
      { titre: 'Écran', largeur: 'minmax(140px, 1fr)' },
      { titre: 'Vues', classe: 'cell-right', largeur: '64px' },
      { titre: 'Durée', classe: 'cell-right', largeur: '110px' },
    ],
    lignes: ecrans.map((x) => [el('span', 'mono', x.ecran), fmtEntier(x.nb), x.dureeMs ? fmtDureeSec(x.dureeMs / 1000) : '—']),
    vide: 'Aucun écran consulté sur la période.',
  });
}
