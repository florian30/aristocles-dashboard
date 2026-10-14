// DASH-DICTEE-FRONT : champs v2.6 d'une dictée (contrat-dashboard.md,
// « Ajouts DASH-DICTEE-EDGE ») — liste et provenance par mot,
// caractéristiques, mots douteux ; dictée ancienne et Edge d'avant.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { adapterDictee, creerApi } from '../api.js';
import { transportMock } from '../mock/transport.js';
import { caracteristiquesDictee, carteDictee, ligneDouteuse, resumeFautes, resumeListe } from '../ui/dictee.js';
import { decalerJour, hierParis } from '../ui/paris.js';

// Forme brute v2.6 (exemple fictif aux formes du contrat).
const BASE = {
  id: 'd-2', session_id: 's-2', ecran_id: 'e-2', origine: 'entrainement',
  texte_reference: 'Le petit chat gris dort sur le rebord de la fenêtre.',
  classe: 'CE2', etape: 'fin', finie_at: '2026-10-13T17:32:00Z', mots_cibles: ['gris'],
  niveau_difficulte: 'facile', validation_status: 'valide', validation_tentatives: 1, ecarts_detectes: null,
  created_at: '2026-10-13T17:15:00Z', nb_fautes_comptees: 1, nb_fautes_contestees: 1,
  regles_revues: ['accent_grave'], evenements_par_type: { ouverture: 1, etape: 6, verdict: 3, reglee: 1, cloture: 1 },
};
const DICTEE_V26 = {
  ...BASE,
  titre: 'Le chat à la fenêtre',
  refait_de: '0b8c1f7e-0000-4000-8000-000000000001',
  nb_phrases: 1,
  nb_mots: 11,
  liste: {
    nom: 'Ari a choisi', source: 'ari_choisit', provenance: 'enregistree',
    mots: [
      { mot: 'petit', provenance: 'dubois_buyse' }, { mot: 'gris', provenance: 'a_retravailler' },
      { mot: 'rebord', provenance: 'dubois_buyse' }, { mot: 'fenêtre', provenance: 'a_retravailler' },
    ],
  },
  fautes_douteuses: [
    { origine: 'doute', mot: 'gris', lecture_probable: 'grie', confiance: 0.48, verdict: 'infirme', verifie_par: 'tape',
      texte_tape: 'gris', reglee_par: null, essais: 0, regle_code: 'accord_adjectif', phrase_index: 0 },
    { origine: 'contestee', mot: 'rebord', lecture_probable: 'rebore', confiance: 0.93, verdict: 'conteste', verifie_par: null,
      texte_tape: null, reglee_par: null, essais: 0, regle_code: null, phrase_index: 0 },
    { origine: 'doute', mot: 'fenêtre', lecture_probable: 'fenetre', confiance: 0.61, verdict: 'confirme', verifie_par: null,
      texte_tape: null, reglee_par: 'avec_indice', essais: 2, regle_code: 'accent_grave', phrase_index: 1 },
  ],
};
// Dictée ancienne vue par l'Edge v2.6 : liste d'avant le lot.
const DICTEE_ANCIENNE = {
  ...BASE, id: 'd-1', titre: null, refait_de: null, nb_phrases: 1, nb_mots: 11,
  liste: { nom: 'Mes mots du 9 octobre', source: 'photo_enfant', provenance: 'inconnue',
    mots: [{ mot: 'demain', provenance: null }, { mot: 'musée', provenance: null }] },
  fautes_douteuses: [],
};

// Mini-DOM : assez pour carteDictee (el, lien, append, textContent).
function avecDom(f) {
  class Noeud {
    constructor(tag) { this.tag = tag; this.enfants = []; this.className = ''; this._texte = ''; }
    append(...n) { for (const x of n) this.enfants.push(typeof x === 'string' ? { textContent: x } : x); }
    set textContent(t) { this._texte = String(t); this.enfants = []; }
    get textContent() { return this._texte + this.enfants.map((e) => e.textContent).join(''); }
    get innerHTML() { throw new Error('innerHTML interdit'); }
  }
  const avant = globalThis.document;
  globalThis.document = { createElement: (tag) => new Noeud(tag) };
  try { return f(); } finally { globalThis.document = avant; }
}
const texteCarte = (brute) => avecDom(() => carteDictee(adapterDictee(brute), { env: 'prod' }).textContent);

Deno.test('v2.6 : adaptateur — liste, caractéristiques, mots douteux', () => {
  const d = adapterDictee(DICTEE_V26);
  assertEquals([d.titre, d.nbPhrases, d.nbMots, d.nbContestees], ['Le chat à la fenêtre', 1, 11, 1]);
  assertEquals(d.refaitDe, '0b8c1f7e-0000-4000-8000-000000000001');
  assertEquals(d.liste.mots[1], { mot: 'gris', provenance: 'a_retravailler' });
  assertEquals(d.fautesDouteuses.length, 3);
  assertEquals(d.fautesDouteuses[1], { origine: 'contestee', mot: 'rebord', lectureProbable: 'rebore', confiance: 0.93,
    verdict: 'conteste', verifiePar: null, texteTape: null, regleePar: null, essais: 0, regleCode: null, phraseIndex: 0 });
  assertEquals(resumeFautes(d), '1 faute comptée · 1 réglée · 1 contestée');
});

Deno.test('v2.6 : caractéristiques et liste groupée par provenance', () => {
  const d = adapterDictee(DICTEE_V26);
  assertEquals(caracteristiquesDictee(d), '1 phrase · 11 mots · texte validé · 1 essai de génération · reprise d’une dictée précédente');
  assertEquals(resumeListe(d), {
    titre: '« Ari a choisi » · choisie par Ari',
    groupes: [{ libelle: 'Dubois-Buyse', mots: ['petit', 'rebord'] }, { libelle: 'à retravailler', mots: ['gris', 'fenêtre'] }],
    note: null,
  });
  const devoir = adapterDictee({ ...DICTEE_V26, liste: { nom: 'Devoirs du mardi', source: 'donne_en_devoir', provenance: 'deduite',
    mots: [{ mot: 'marché', provenance: 'devoir' }, { mot: 'sauté', provenance: 'nouvelle' }, { mot: 'x', provenance: null }] } });
  assertEquals(resumeListe(devoir).groupes.map((g) => g.libelle), ['du devoir', 'nouvelle', 'provenance inconnue']);
  assertEquals(resumeListe(devoir).note, 'provenance déduite du devoir');
});

Deno.test('v2.6 : mots douteux — libellés lisibles, deux origines', () => {
  const [infirme, conteste, confirme] = adapterDictee(DICTEE_V26).fautesDouteuses.map(ligneDouteuse);
  assertEquals(infirme, { mot: 'gris', origine: { label: 'Ari a douté', cls: 'is-info' }, lu: 'Ari a lu « grie » (sûr à 48 %)',
    issue: { label: 'Ce n’était pas une faute', cls: 'is-success' }, suite: 'l’enfant a retapé « gris » · phrase 1', regle: 'accord_adjectif' });
  assertEquals(conteste.origine.label, 'L’enfant a contesté');
  assertEquals(conteste.issue.label, 'Contestée : « Ari a mal lu ma copie »');
  assertEquals(confirme.issue.label, 'Faute confirmée');
  assertEquals(confirme.suite, 'retrouvée avec un indice · 2 essais de correction · phrase 2');
  const vide = ligneDouteuse(adapterDictee({ ...BASE, fautes_douteuses: [{ origine: 'doute' }] }).fautesDouteuses[0]);
  assertEquals(vide, { mot: null, origine: { label: 'Ari a douté', cls: 'is-info' }, lu: null,
    issue: { label: 'Pas encore vérifiée', cls: 'is-muted' }, suite: '', regle: null });
  assertEquals(ligneDouteuse({ verdict: 'non_verifie', verifiePar: 'photo_pres', confiance: 0.7 }).suite, 'vérifiée sur une photo de près');
});

Deno.test('v2.6 : dictée ancienne — provenance inconnue, sobrement', () => {
  const d = adapterDictee(DICTEE_ANCIENNE);
  assertEquals(resumeListe(d), {
    titre: '« Mes mots du 9 octobre » · prise en photo par l’enfant',
    groupes: [{ libelle: null, mots: ['demain', 'musée'] }],
    note: 'provenance des mots inconnue (liste antérieure)',
  });
  const texte = texteCarte(DICTEE_ANCIENNE);
  assert(texte.includes('provenance des mots inconnue'));
  assert(texte.includes('demain, musée'));
  assert(!texte.includes('reprise'));
});

Deno.test('v2.6 : fautes_douteuses vide, liste null (mots libres)', () => {
  const d = adapterDictee({ ...DICTEE_V26, liste: null, fautes_douteuses: [] });
  assertEquals(d.fautesDouteuses, []);
  assertEquals(resumeListe(d), { titre: 'Mots saisis librement', groupes: [], note: null });
  const fin = texteCarte({ ...DICTEE_V26, liste: null, fautes_douteuses: [] });
  assert(fin.includes('Mots saisis librement'));
  assert(fin.includes('Aucun mot douteux.'));
  // Pas finie : rien à dire sur les douteux.
  assert(!texteCarte({ ...DICTEE_V26, etape: 'relecture', fautes_douteuses: [] }).includes('douteux'));
});

Deno.test('v2.6 : carte complète, et Edge d’avant (champs absents) sans erreur', () => {
  const texte = texteCarte(DICTEE_V26);
  for (const attendu of ['Le chat à la fenêtre', '1 phrase · 11 mots', '« Ari a choisi » · choisie par Ari',
    'à retravailler :', 'gris, fenêtre', '« rebord »', 'L’enfant a contesté', 'Ce n’était pas une faute',
    'l’enfant a retapé « gris »', 'Ari a lu « fenetre » (sûr à 61 %)']) assert(texte.includes(attendu), attendu);
  // Validation et essais ne sont pas répétés dans la ligne des paramètres.
  assertEquals(texte.split('texte validé').length, 2);

  const { titre: _t, refait_de: _r, nb_phrases: _p, nb_mots: _m, liste: _l, fautes_douteuses: _f, nb_fautes_contestees: _c, ...avant } = DICTEE_V26;
  const d = adapterDictee(avant);
  for (const k of ['titre', 'refaitDe', 'nbPhrases', 'nbMots', 'liste', 'fautesDouteuses', 'nbContestees']) assertEquals(d[k], null, k);
  assertEquals(resumeListe(d), null);
  const ancienTexte = texteCarte(avant);
  assert(!ancienTexte.includes('Mots saisis') && !ancienTexte.includes('douteux'));
  // Ancien flux (classe null) : rien de v2.6 n'est rendu.
  assert(!texteCarte({ ...DICTEE_V26, classe: null }).includes('Douteux'));
  // Valeurs bancales filtrées.
  const bancale = adapterDictee({ ...DICTEE_V26, nb_mots: 'onze', liste: { mots: [null, { mot: 3 }, { mot: 'ok' }] }, fautes_douteuses: [null, 'x'] });
  assertEquals([bancale.nbMots, bancale.liste.mots, bancale.fautesDouteuses], [null, [{ mot: 'ok', provenance: null }], []]);
  assertEquals(resumeListe(bancale).titre, 'Liste sans nom');
});

Deno.test('v2.6 : mock — récente avec provenance, douteuses des deux origines, ancienne sans provenance', async () => {
  const api = creerApi({ transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }) });
  const to = decalerJour(hierParis(), 1);
  const toutes = [];
  for (const c of ['c1', 'c2', 'c3', 'c4', 'c6']) toutes.push(...(await api.enfant('prod', c, decalerJour(to, -91), to)).dictees);
  const recente = toutes.find((d) => d.titre === 'Le chat à la fenêtre');
  assertEquals(new Set(recente.fautesDouteuses.map((f) => f.origine)), new Set(['doute', 'contestee']));
  assert(recente.liste.mots.every((m) => m.provenance));
  assert(toutes.some((d) => d.id === recente.refaitDe));
  assert(toutes.some((d) => d.liste?.provenance === 'inconnue' && d.liste.mots.every((m) => !m.provenance)));
  assert(toutes.some((d) => d.liste?.libre));
  // Ancien flux : pas de champ v2.6, et la journée se charge quand même.
  const hier = await api.journee('prod', hierParis());
  assert(hier.enfants.flatMap((e) => e.dictees).some((d) => d.classe == null && d.liste == null && d.fautesDouteuses == null));
});
