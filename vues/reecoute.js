/* ============================================================
   Réécoute des prises de voix (REECOUTE-VOIX lot 108, actions
   `reecoute_liste` et `reecoute_evaluer`, contrat § 2.18-2.19).
   #/{env}/reecoute : en tête, l'avancement (total, évaluées, Pas OK,
   barre) et les filtres (non évaluées par défaut, `tout=1` ; mode ;
   contexte). Puis une carte par prise. Une seule carte est ouverte :
   ce qu'Ari venait de dire, l'exercice ouvert et la réponse attendue,
   ce que la machine a écrit (en gros), le lecteur, la grille.
   · OK : enregistré tout de suite, la carte suivante s'ouvre.
   · Pas OK : « Ce que l'enfant a vraiment dit » (pré-rempli avec la
     transcription) et un commentaire ; enregistré à la sortie de
     chaque champ ; Entrée dans le commentaire ou « Suivante » passe
     à la carte suivante.
   Raccourcis (hors champ de saisie) : Espace écouter, O OK, N Pas OK.
   L'audio de la carte ouverte et celui de la suivante sont préchargés.
   Les URLs signées (1 h) ne sont ni affichées, ni en cache, ni dans le
   hash ; un lecteur qui ne charge plus fait proposer « Recharger les
   enregistrements ». Jamais de prénom (`enfant` = « E-xxxxxx »),
   aucune donnée dans la console, tout en textContent.
   ============================================================ */

import { estAnnulation } from '../api.js';
import { construireHash, naviguer } from '../router.js';
import { el, etatErreur, lien } from '../ui/dom.js';
import { pluriel } from '../ui/format.js';
import { fmtInstantParis, heureParis } from '../ui/paris.js';
import {
  compteursApres, filtresDepuisQuery, fusionnerPrises, indexInitial, indexSuivant, LIBELLE_FILTRE_STT, LIBELLE_MODE_REECOUTE,
  libelleContexte, LIMITE_TEXTE, messageErreurReecoute, MODES_REECOUTE, optionsContexte, pageSuivante, paramsEvaluation,
  paramsListe, progression, queryDepuisFiltres, raccourci, texteReponseAttendue,
} from '../ui/reecoute.js';

export const titre = 'Réécoute';

const MARGE_EXPIRATION_MS = 60000;

export async function rendre({ route, api, signal }) {
  const filtres = filtresDepuisQuery(route.query);
  let premier;
  try {
    premier = await api.reecouteListe(route.env, paramsListe(filtres, 1), { signal });
  } catch (e) {
    if (estAnnulation(e)) throw e;
    if (e.status === 400 || e.status === 404) {
      const vue = el('div', 'vue vue-reecoute');
      vue.append(entetePage(null), etatErreur('Réécoute indisponible', messageErreurReecoute(e, route.env)));
      return vue;
    }
    throw e;
  }
  return new Page({ route, api, signal, filtres, premier }).noeud;
}

function entetePage(nb) {
  const tete = el('div', 'page-head');
  tete.append(el('h1', 'page-title', 'Réécoute des voix'));
  if (nb != null) tete.append(el('span', 'page-count', pluriel(nb, 'prise') + ' avec ce filtre'));
  return tete;
}

class Page {
  constructor({ route, api, signal, filtres, premier }) {
    Object.assign(this, { route, api, signal, filtres });
    this.prises = premier.prises;
    this.compteurs = premier.compteurs;
    this.page = premier.page;
    this.majLot(premier);
    this.pagesChargees = [premier.page];
    this.actif = null;
    this.brouillons = new Map(); // priseId → { verdict, bonTexte, commentaire }
    this.envoyes = new Map(); // priseId → JSON des derniers params enregistrés
    this.files = new Map(); // priseId → Promise (enregistrements à la suite)
    this.audios = new Map(); // priseId → <audio> préchargé
    this.cartes = new Map(); // priseId → { noeud, statut }
    this.chargementSuite = null;

    const vue = el('div', 'vue vue-reecoute');
    vue.append(entetePage(premier.nbResultats));
    vue.append(el('p', 'bloc-explication',
      'Chaque prise de voix gardée, de la plus ancienne à la plus récente. Écoutez, puis OK si la machine a bien écrit ce que l’enfant a dit, Pas OK sinon. La grille part tout de suite ; la carte suivante s’ouvre.'));
    this.avancement = el('section', 'reecoute-avancement');
    vue.append(this.avancement, this.blocFiltres());
    const aide = el('p', 'reecoute-aide', 'Clavier : Espace écouter · O OK · N Pas OK · Entrée dans le commentaire : suivante');
    this.annonce = el('p', 'reecoute-annonce');
    this.annonce.setAttribute('role', 'status');
    this.annonce.setAttribute('aria-live', 'polite');
    this.liste = el('ol', 'reecoute-liste');
    this.fin = el('div', 'reecoute-fin');
    vue.append(aide, this.annonce, this.liste, this.fin);
    this.noeud = vue;

    this.majAvancement();
    for (const p of this.prises) this.liste.append(this.creerCarte(p));
    this.ouvrir(indexInitial(this.prises), { focus: false });
    this.majFin();
    document.addEventListener('keydown', (e) => this.surTouche(e), { signal });
  }

  // ---------- En-tête ----------

  majAvancement() {
    const c = this.compteurs;
    const pct = progression(c);
    const chiffres = el('div', 'reecoute-chiffres');
    const chiffre = (libelle, valeur, classe) => {
      const b = el('div', 'reecoute-chiffre' + (classe ? ' ' + classe : ''));
      b.append(el('span', 'reecoute-chiffre-valeur', String(valeur)), el('span', 'eyebrow', libelle));
      return b;
    };
    chiffres.append(chiffre('Prises gardées', c.total), chiffre('Évaluées', c.evaluees), chiffre('Pas OK', c.pasOk, c.pasOk ? 'is-pas-ok' : ''));
    const barre = el('div', 'reecoute-barre');
    barre.setAttribute('role', 'progressbar');
    barre.setAttribute('aria-valuemin', '0');
    barre.setAttribute('aria-valuemax', String(c.total));
    barre.setAttribute('aria-valuenow', String(c.evaluees));
    barre.setAttribute('aria-label', 'Prises évaluées');
    const rempli = el('span', 'reecoute-barre-rempli');
    rempli.style.width = pct + '%';
    barre.append(rempli);
    const note = el('span', 'cell-note', c.evaluees + ' sur ' + c.total + ' · ' + String(pct).replace('.', ',') + ' %');
    this.avancement.replaceChildren(chiffres, barre, note);
  }

  blocFiltres() {
    const f = this.filtres;
    const bloc = el('div', 'chips-ligne reecoute-filtres');
    const aller = (nouveaux) => naviguer({ env: this.route.env, vue: 'reecoute', query: queryDepuisFiltres({ ...f, ...nouveaux }) });
    const bouton = (libelle, actif, nonEvaluees) => {
      const a = lien(construireHash({ env: this.route.env, vue: 'reecoute', query: queryDepuisFiltres({ ...f, nonEvaluees }) }),
        'bouton bouton-filtre' + (actif ? ' is-active' : ''), libelle);
      if (actif) a.setAttribute('aria-current', 'true');
      return a;
    };
    bloc.append(bouton('Non évaluées', f.nonEvaluees, true), bouton('Toutes', !f.nonEvaluees, false));

    const select = (libelle, valeurs, libelleDe, courant, cle) => {
      const champ = el('label', 'reecoute-select');
      const s = el('select', 'form-input');
      const tous = el('option', null, libelle + ' : tous');
      tous.value = '';
      s.append(tous);
      for (const v of valeurs) {
        const o = el('option', null, libelleDe(v));
        o.value = v;
        if (v === courant) o.selected = true;
        s.append(o);
      }
      s.setAttribute('aria-label', libelle);
      s.addEventListener('change', () => aller({ [cle]: s.value || null }));
      champ.append(s);
      return champ;
    };
    bloc.append(
      select('Mode', MODES_REECOUTE, (m) => LIBELLE_MODE_REECOUTE[m], f.mode, 'mode'),
      select('Contexte', optionsContexte(this.prises, f.contexte), libelleContexte, f.contexte, 'contexte'),
    );
    return bloc;
  }

  majFin() {
    this.fin.replaceChildren();
    if (!this.prises.length) {
      this.fin.append(el('p', 'reecoute-vide', this.filtres.nonEvaluees ? 'Plus aucune prise à réécouter avec ce filtre.' : 'Aucune prise avec ce filtre.'));
      return;
    }
    if (this.resteASuivre()) {
      const b = el('button', 'bouton', 'Charger les prises suivantes');
      b.type = 'button';
      b.addEventListener('click', () => this.chargerSuite());
      this.fin.append(b);
    } else if (this.prises.every((p) => p.evaluation)) {
      this.fin.append(el('p', 'reecoute-vide', 'Toutes les prises de la liste sont évaluées.'));
    } else {
      this.fin.append(el('p', 'cell-note', 'Fin de la liste.'));
    }
  }

  // Reste-t-il des prises au-delà de celles chargées ? Filtre « non
  // évaluées » : le serveur le dit (`nbResultats` > prises rendues) ;
  // sinon, page courante < nombre de pages.
  resteASuivre() {
    if (this.epuise) return false;
    if (this.filtres.nonEvaluees) return this.nbResultats > this.dernierLot;
    return this.page < this.nbPages;
  }

  majLot(r) {
    this.nbPages = r.nbPages;
    this.nbResultats = r.nbResultats;
    this.dernierLot = r.prises.length;
    this.compteurs = r.compteurs;
    this.expireLe = r.expireLe;
  }

  // Charge la suite et ajoute les cartes. Filtre « non évaluées » : les
  // prises notées sortent de la liste côté serveur, on repart de la
  // page 1 et on avance tant qu'une page ne rend rien de neuf.
  chargerSuite() {
    if (this.chargementSuite) return this.chargementSuite;
    this.fin.replaceChildren(el('p', 'cell-note', 'Chargement des prises suivantes…'));
    this.chargementSuite = (async () => {
      try {
        const avant = this.prises.length;
        let page = pageSuivante(this.filtres, this.page);
        for (;;) {
          const r = await this.api.reecouteListe(this.route.env, paramsListe(this.filtres, page), { signal: this.signal });
          this.prises = fusionnerPrises(this.prises, r.prises);
          this.majLot(r);
          this.page = page;
          if (!this.pagesChargees.includes(page)) this.pagesChargees.push(page);
          if (this.prises.length > avant || !this.filtres.nonEvaluees || page >= r.nbPages) break;
          page += 1;
        }
        for (const p of this.prises.slice(avant)) this.liste.append(this.creerCarte(p));
        this.majAvancement();
        if (this.prises.length === avant) this.epuise = true;
        this.majFin();
        return avant;
      } catch (e) {
        if (estAnnulation(e)) return null;
        this.fin.replaceChildren(el('p', 'form-erreur', messageErreurReecoute(e, this.route.env)));
        const b = el('button', 'bouton', 'Réessayer');
        b.type = 'button';
        b.addEventListener('click', () => this.chargerSuite());
        this.fin.append(b);
        return null;
      } finally {
        this.chargementSuite = null;
      }
    })();
    return this.chargementSuite;
  }

  // ---------- Cartes ----------

  // Numéro affiché : la place dans la liste chargée (le `rang` de l'Edge
  // repart de 1 à chaque appel quand les prises notées sortent du filtre).
  creerCarte(p) {
    p.numero = this.indexDe(p.priseId) + 1;
    const noeud = el('li', 'reecoute-carte');
    noeud.tabIndex = -1;
    noeud.dataset.prise = p.priseId;
    const carte = { noeud, statut: el('p', 'reecoute-statut') };
    carte.statut.setAttribute('role', 'status');
    this.cartes.set(p.priseId, carte);
    this.rendreFermee(p);
    return noeud;
  }

  indexDe(priseId) {
    return this.prises.findIndex((p) => p.priseId === priseId);
  }

  rendreFermee(p) {
    const { noeud } = this.cartes.get(p.priseId);
    noeud.classList.remove('is-open');
    const resume = el('button', 'reecoute-resume');
    resume.type = 'button';
    resume.setAttribute('aria-expanded', 'false');
    resume.append(
      el('span', 'reecoute-rang mono', '#' + p.numero),
      el('span', 'reecoute-resume-quand', fmtInstantParis(p.priseLe)),
      el('span', 'reecoute-resume-texte' + (p.transcription ? '' : ' is-empty'), p.transcription || '(aucun texte rendu)'),
      chipEvaluation(p.evaluation),
    );
    resume.addEventListener('click', () => this.ouvrir(this.indexDe(p.priseId)));
    noeud.replaceChildren(resume);
  }

  ouvrir(index, { focus = true } = {}) {
    if (index == null || index < 0 || index >= this.prises.length) return;
    const ancien = this.actif != null ? this.prises[this.actif] : null;
    if (ancien && this.actif !== index) {
      // Un champ encore ouvert enregistre à sa sortie (blur) ; on ferme après.
      this.rendreFermee(ancien);
    }
    this.actif = index;
    const p = this.prises[index];
    this.rendreOuverte(p);
    this.prechargerAudio(this.prises[index + 1]);
    const { noeud } = this.cartes.get(p.priseId);
    if (focus) {
      noeud.focus({ preventScroll: true });
      noeud.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    if (this.expireLe && Date.parse(this.expireLe) - Date.now() < MARGE_EXPIRATION_MS) this.rechargerUrls();
  }

  rendreOuverte(p) {
    const carte = this.cartes.get(p.priseId);
    const { noeud } = carte;
    noeud.classList.add('is-open');
    const contenu = [];

    const meta = el('div', 'reecoute-meta');
    const morceaux = [
      '#' + p.numero,
      fmtInstantParis(p.priseLe),
      p.mode ? LIBELLE_MODE_REECOUTE[p.mode] || p.mode : 'Hors séance',
      libelleContexte(p.contexte),
      p.enfant,
      p.dureeS != null ? p.dureeS.toFixed(1).replace('.', ',') + ' s' : null,
    ].filter(Boolean);
    meta.append(el('span', 'reecoute-meta-texte', morceaux.join(' · ')));
    const filtre = LIBELLE_FILTRE_STT[p.filtre] ?? (p.filtre !== 'aucun' ? 'filtre : ' + p.filtre : null);
    if (filtre) meta.append(el('span', 'chip is-fragile', filtre));
    if (p.sessionId) meta.append(lien(construireHash({ env: this.route.env, vue: 'seances', sessionId: p.sessionId }), 'reecoute-lien', 'Voir la séance'));
    contenu.push(meta);

    const ari = el('div', 'reecoute-bloc reecoute-ari');
    ari.append(el('span', 'eyebrow', 'Ari venait de dire' + (p.messageAriAvant?.le ? ' · ' + heureParis(p.messageAriAvant.le) : '')));
    ari.append(p.messageAriAvant
      ? el('p', 'reecoute-ari-texte', p.messageAriAvant.texte || '—')
      : el('p', 'reecoute-ari-texte is-empty', p.sessionId ? 'Ari n’avait encore rien dit.' : 'Prise hors séance.'));
    contenu.push(ari);

    if (p.exercice) {
      const ex = el('div', 'reecoute-bloc reecoute-exercice');
      const tete = el('span', 'eyebrow', 'Exercice ouvert');
      ex.append(tete);
      if (p.exercice.code) ex.append(el('span', 'mono reecoute-code', p.exercice.code));
      ex.append(el('p', 'reecoute-enonce', p.exercice.enonce || '—'));
      const attendue = texteReponseAttendue(p.exercice.reponseAttendue);
      if (attendue) {
        const r = el('p', 'reecoute-attendue');
        r.append(el('span', 'reecoute-attendue-libelle', 'Réponse attendue : '), el('span', null, attendue));
        ex.append(r);
      }
      contenu.push(ex);
    }

    const machine = el('div', 'reecoute-bloc reecoute-machine');
    machine.append(el('span', 'eyebrow', 'La machine a écrit'),
      el('p', 'reecoute-transcription' + (p.transcription ? '' : ' is-empty'), p.transcription || '(aucun texte rendu)'));
    contenu.push(machine);

    const ecoute = el('div', 'reecoute-ecoute');
    if (p.purgee || !p.url) {
      ecoute.append(el('span', 'voix-effacee', 'enregistrement effacé'));
    } else {
      ecoute.append(this.audioDe(p));
    }
    carte.ecoute = ecoute;
    contenu.push(ecoute);

    contenu.push(this.grille(p, carte));
    noeud.replaceChildren(...contenu);
  }

  // ---------- Audio ----------

  audioDe(p) {
    let audio = this.audios.get(p.priseId);
    if (!audio || audio.getAttribute('src') !== p.url) {
      audio = el('audio', 'voix-lecteur reecoute-lecteur');
      audio.setAttribute('controls', '');
      audio.preload = 'auto';
      audio.setAttribute('src', p.url);
      audio.addEventListener('error', () => this.surPanneAudio(), { once: true });
      this.audios.set(p.priseId, audio);
    }
    audio.setAttribute('aria-label', 'Écouter la prise' + ' ' + p.numero);
    return audio;
  }

  prechargerAudio(p) {
    if (!p || p.purgee || !p.url) return;
    const audio = this.audioDe(p);
    try { audio.load(); } catch (_) { /* navigateur sans load() */ }
  }

  audioActif() {
    if (this.actif == null) return null;
    const p = this.prises[this.actif];
    return p && !p.purgee && p.url ? this.audios.get(p.priseId) || null : null;
  }

  surPanneAudio() {
    if (this.panneSignalee) return;
    this.panneSignalee = true;
    const b = el('button', 'bouton voix-recharger', 'Recharger les enregistrements');
    b.type = 'button';
    b.addEventListener('click', () => {
      b.disabled = true;
      this.rechargerUrls();
    });
    this.annonce.replaceChildren(el('span', null, 'Un enregistrement ne charge plus (lien expiré ?). '), b);
  }

  // Redemande les pages déjà chargées (URLs signées d'1 h, jamais en cache)
  // et remplace les liens des prises qu'elles rendent.
  async rechargerUrls() {
    if (this.rechargeEnCours) return;
    this.rechargeEnCours = true;
    try {
      const lots = [];
      for (const page of this.pagesChargees) {
        lots.push(await this.api.reecouteListe(this.route.env, paramsListe(this.filtres, page), { signal: this.signal }));
      }
      const neuves = new Map(lots.flatMap((l) => l.prises).map((p) => [p.priseId, p]));
      this.expireLe = lots.length ? lots[lots.length - 1].expireLe : this.expireLe;
      for (const p of this.prises) {
        const n = neuves.get(p.priseId);
        if (!n) continue;
        p.url = n.url;
        p.purgee = n.purgee;
        this.audios.delete(p.priseId);
      }
      this.panneSignalee = false;
      this.annonce.textContent = 'Enregistrements rechargés.';
      if (this.actif != null) {
        const p = this.prises[this.actif];
        const carte = this.cartes.get(p.priseId);
        if (carte.ecoute) carte.ecoute.replaceChildren(p.purgee || !p.url ? el('span', 'voix-effacee', 'enregistrement effacé') : this.audioDe(p));
        this.prechargerAudio(this.prises[this.actif + 1]);
      }
    } catch (e) {
      if (!estAnnulation(e)) this.annonce.textContent = messageErreurReecoute(e, this.route.env);
    } finally {
      this.rechargeEnCours = false;
    }
  }

  // ---------- Grille ----------

  grille(p, carte) {
    const brouillon = this.brouillons.get(p.priseId) || {
      verdict: p.evaluation?.verdict || null,
      bonTexte: p.evaluation?.bonTexte ?? p.transcription,
      commentaire: p.evaluation?.commentaire || '',
    };
    this.brouillons.set(p.priseId, brouillon);
    const bloc = el('div', 'reecoute-grille');
    const boutons = el('div', 'reecoute-verdicts');
    const ok = el('button', 'bouton reecoute-verdict is-ok', 'OK');
    const pasOk = el('button', 'bouton reecoute-verdict is-pas-ok', 'Pas OK');
    for (const [b, v] of [[ok, 'ok'], [pasOk, 'pas_ok']]) {
      b.type = 'button';
      b.dataset.verdict = v;
      b.setAttribute('aria-pressed', String(brouillon.verdict === v));
    }
    boutons.append(ok, pasOk);
    bloc.append(boutons);

    const champs = el('div', 'reecoute-champs');
    champs.hidden = brouillon.verdict !== 'pas_ok';
    const champBon = el('label', 'form-champ');
    const bon = el('input', 'form-input reecoute-bon-texte');
    bon.type = 'text';
    bon.maxLength = LIMITE_TEXTE;
    bon.value = brouillon.bonTexte || '';
    bon.setAttribute('autocomplete', 'off');
    bon.setAttribute('autocapitalize', 'off');
    bon.setAttribute('spellcheck', 'false');
    champBon.append(el('span', 'form-label', 'Ce que l’enfant a vraiment dit'), bon);
    const champCom = el('label', 'form-champ');
    const com = el('input', 'form-input reecoute-commentaire');
    com.type = 'text';
    com.maxLength = LIMITE_TEXTE;
    com.value = brouillon.commentaire || '';
    com.setAttribute('enterkeyhint', 'next');
    champCom.append(el('span', 'form-label', 'Commentaire'), com);
    const suivante = el('button', 'bouton reecoute-suivante', 'Suivante →');
    suivante.type = 'button';
    champs.append(champBon, champCom, suivante);
    bloc.append(champs);

    carte.statut.textContent = p.evaluation ? texteEnregistre(p.evaluation) : '';
    carte.statut.className = 'reecoute-statut' + (p.evaluation ? ' is-enregistre' : '');
    bloc.append(carte.statut);
    carte.boutons = { ok, pasOk, bon, com };

    const marquer = (v) => {
      ok.setAttribute('aria-pressed', String(v === 'ok'));
      pasOk.setAttribute('aria-pressed', String(v === 'pas_ok'));
    };
    ok.addEventListener('click', async () => {
      brouillon.verdict = 'ok';
      marquer('ok');
      champs.hidden = true;
      if (await this.enregistrer(p, brouillon)) this.suivante(p);
    });
    pasOk.addEventListener('click', () => {
      brouillon.verdict = 'pas_ok';
      marquer('pas_ok');
      champs.hidden = false;
      carte.statut.className = 'reecoute-statut';
      carte.statut.textContent = 'Pas OK : corrigez le texte. L’enregistrement part à la sortie du champ.';
      bon.focus();
      try { bon.setSelectionRange(bon.value.length, bon.value.length); } catch (_) { /* type sans sélection */ }
    });
    const lire = () => {
      brouillon.bonTexte = bon.value;
      brouillon.commentaire = com.value;
    };
    bon.addEventListener('input', lire);
    com.addEventListener('input', lire);
    bon.addEventListener('blur', () => { lire(); this.enregistrer(p, brouillon); });
    com.addEventListener('blur', () => { lire(); this.enregistrer(p, brouillon); });
    bon.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); com.focus(); }
    });
    com.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      lire();
      if (await this.enregistrer(p, brouillon)) this.suivante(p);
    });
    suivante.addEventListener('click', async () => {
      lire();
      if (await this.enregistrer(p, brouillon)) this.suivante(p);
    });
    return bloc;
  }

  // Enregistre la grille si elle a changé depuis le dernier envoi. Les
  // envois d'une même prise partent à la suite (blur puis Entrée…).
  // Rend true si la grille est enregistrée.
  enregistrer(p, brouillon) {
    const precedent = this.files.get(p.priseId) || Promise.resolve(true);
    const suivant = precedent.then(() => this.envoyer(p, brouillon));
    this.files.set(p.priseId, suivant);
    return suivant;
  }

  async envoyer(p, brouillon) {
    if (!brouillon.verdict) return false;
    const params = paramsEvaluation(p, brouillon);
    const cle = JSON.stringify(params);
    if (this.envoyes.get(p.priseId) === cle) return true;
    const carte = this.cartes.get(p.priseId);
    carte.statut.className = 'reecoute-statut';
    carte.statut.textContent = 'Enregistrement…';
    try {
      const r = await this.api.reecouteEvaluer(this.route.env, params, { signal: this.signal });
      const avant = p.evaluation;
      p.evaluation = { verdict: r.verdict, bonTexte: r.bonTexte, commentaire: r.commentaire, evalueLe: r.evalueLe };
      this.envoyes.set(p.priseId, cle);
      this.compteurs = compteursApres(this.compteurs, avant, r.verdict);
      this.majAvancement();
      carte.statut.className = 'reecoute-statut is-enregistre';
      carte.statut.textContent = texteEnregistre(p.evaluation);
      this.annonce.textContent = 'Prise ' + p.numero + ' enregistrée : ' + (r.verdict === 'ok' ? 'OK' : 'Pas OK') + '.';
      if (!carte.noeud.classList.contains('is-open')) this.rendreFermee(p);
      return true;
    } catch (e) {
      if (estAnnulation(e)) return false;
      carte.statut.className = 'reecoute-statut is-erreur';
      carte.statut.textContent = 'Non enregistré. ' + messageErreurReecoute(e, this.route.env);
      if (!carte.noeud.classList.contains('is-open')) {
        this.annonce.textContent = 'Prise ' + p.numero + ' non enregistrée : rouvrez-la.';
        this.rendreFermee(p);
      }
      return false;
    }
  }

  async suivante(p) {
    const index = this.indexDe(p.priseId);
    let k = indexSuivant(this.prises, index);
    if (k == null && this.resteASuivre()) {
      await this.chargerSuite();
      k = indexSuivant(this.prises, index);
    }
    if (k == null) {
      this.rendreFermee(p);
      this.actif = null;
      this.majFin();
      this.fin.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    this.ouvrir(k);
  }

  // ---------- Clavier ----------

  surTouche(e) {
    if (!this.noeud.isConnected || this.actif == null) return;
    const action = raccourci(e);
    if (!action) return;
    const p = this.prises[this.actif];
    const carte = this.cartes.get(p.priseId);
    e.preventDefault();
    if (action === 'ecouter') {
      const audio = this.audioActif();
      if (!audio) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    } else if (action === 'ok') {
      carte.boutons?.ok.click();
    } else if (action === 'pas_ok') {
      carte.boutons?.pasOk.click();
    }
  }
}

function chipEvaluation(ev) {
  if (!ev) return el('span', 'chip is-muted', 'à écouter');
  return ev.verdict === 'ok' ? el('span', 'chip is-success', 'OK') : el('span', 'chip is-failure', 'Pas OK');
}

function texteEnregistre(ev) {
  return 'Enregistré · ' + (ev.verdict === 'ok' ? 'OK' : 'Pas OK') + (ev.evalueLe ? ' · ' + heureParis(ev.evalueLe) : '');
}
