// Réécoute des voix (REECOUTE-VOIX lot 108, contrat § 2.18-2.19) :
// adaptateur (exemples du contrat recopiés), jamais en cache, écriture,
// filtres du hash, grille, compteurs, carte suivante, raccourcis,
// réponse attendue brute, route, mock à état (aucune vraie voix,
// aucun prénom). Données factices.
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { creerApi } from '../api.js';
import { CHILDREN } from '../mock/donnees.js';
import { creerReecouteMock } from '../mock/reecoute.js';
import { transportMock } from '../mock/transport.js';
import { analyserHash, construireHash } from '../router.js';
import {
  adapterReecouteListe, compteursApres, filtresDepuisQuery, fusionnerPrises, indexInitial, indexSuivant, optionsContexte,
  pageSuivante, paramsEvaluation, paramsListe, progression, queryDepuisFiltres, raccourci, texteReponseAttendue,
} from '../ui/reecoute.js';
import { EXEMPLE_REECOUTE_EVALUER, EXEMPLE_REECOUTE_LISTE } from './contrat_reecoute_exemples.js';

Deno.test('reecoute : adaptateur — exemple du contrat § 2.18', () => {
  const l = adapterReecouteListe(EXEMPLE_REECOUTE_LISTE);
  assertEquals(l.compteurs, { total: 5, evaluees: 2, pasOk: 1 });
  assertEquals([l.nbResultats, l.page, l.parPage, l.nbPages, l.validiteS, l.expireLe], [5, 1, 2, 3, 3600, '2026-12-20T10:00:00.000Z']);
  const [a, b] = l.prises;
  assertEquals(a.priseId, '50000000-0000-4000-8000-000000000001');
  assertEquals([a.rang, a.enfant, a.mode, a.contexte, a.filtre, a.dureeS, a.transcription], [1, 'E-aaaaaa', 'devoirs', null, 'aucun', 2.4, 'cinquante-six']);
  assertEquals(a.messageAriAvant, { texte: 'Combien font 7 × 8 ?', le: '2026-12-19T17:00:00Z' });
  assertEquals(a.exercice, { code: 'ex-mult-7x8', enonce: 'Combien font 7 × 8 ?', reponseAttendue: { valeur: 56 } });
  assertEquals([a.purgee, a.url, a.evaluation], [false, EXEMPLE_REECOUTE_LISTE.prises[0].url, null]);
  assertEquals(b.exercice, null);
  assertEquals(b.evaluation, { verdict: 'ok', bonTexte: null, commentaire: null, evalueLe: '2026-12-20T08:00:00Z' });
});

Deno.test('reecoute : adaptateur — purgée, formes vides, verdict inconnu', () => {
  const l = adapterReecouteListe({ prises: [
    { prise_id: 'x', etat: 'purgee', url: 'https://ne-doit-pas-sortir', transcription: 3, evaluation: { verdict: 'peut_etre' } },
    { prise_id: 'y', etat: 'ok', url: null, evaluation: { verdict: 'ok', bon_texte: 'ignoré en OK' } },
    null,
  ] });
  assertEquals(l.prises.length, 2);
  assertEquals([l.prises[0].purgee, l.prises[0].url, l.prises[0].transcription, l.prises[0].evaluation], [true, null, '', null]);
  assertEquals([l.prises[1].purgee, l.prises[1].evaluation.bonTexte], [true, null]);
  const vide = adapterReecouteListe({});
  assertEquals([vide.compteurs, vide.prises, vide.nbPages], [{ total: 0, evaluees: 0, pasOk: 0 }, [], 0]);
});

Deno.test('api : reecouteListe jamais en cache ; reecouteEvaluer → exemple § 2.19 ; 404 propagé', async () => {
  const vus = [];
  const api = creerApi({
    transport: (_env, action, params) => Promise.resolve().then(() => {
      vus.push([action, params]);
      if (action === 'reecoute_liste') return EXEMPLE_REECOUTE_LISTE;
      if (params.prise_id === 'purgee') throw Object.assign(new Error('Unknown prise_id'), { status: 404 });
      return EXEMPLE_REECOUTE_EVALUER;
    }),
  });
  const p = paramsListe(filtresDepuisQuery({}), 1);
  await api.reecouteListe('prod', p);
  await api.reecouteListe('prod', p);
  assertEquals(vus.filter(([a]) => a === 'reecoute_liste').length, 2);
  const r = await api.reecouteEvaluer('prod', { prise_id: EXEMPLE_REECOUTE_EVALUER.prise_id, verdict: 'pas_ok', bon_texte: 'cinquante six' });
  assertEquals(r, { priseId: EXEMPLE_REECOUTE_EVALUER.prise_id, verdict: 'pas_ok', bonTexte: 'cinquante six', commentaire: null, evalueLe: '2026-12-20T09:00:00.000Z' });
  await assertRejects(() => api.reecouteEvaluer('prod', { prise_id: 'purgee', verdict: 'ok' }), Error, 'Unknown prise_id');
});

Deno.test('reecoute : filtres du hash ↔ params de l’Edge', () => {
  assertEquals(filtresDepuisQuery({}), { nonEvaluees: true, mode: null, contexte: null });
  const f = filtresDepuisQuery({ tout: '1', mode: 'sans_seance', contexte: 'questions_ari' });
  assertEquals(f, { nonEvaluees: false, mode: 'sans_seance', contexte: 'questions_ari' });
  assertEquals(queryDepuisFiltres(f), { tout: '1', mode: 'sans_seance', contexte: 'questions_ari' });
  assertEquals(queryDepuisFiltres(filtresDepuisQuery({})), {});
  // Valeurs inconnues ou douteuses : ignorées.
  assertEquals(filtresDepuisQuery({ mode: 'peinture', contexte: 'x y<' }), { nonEvaluees: true, mode: null, contexte: null });
  assertEquals(paramsListe(filtresDepuisQuery({})), { page: 1, par_page: 50, non_evaluees: true });
  assertEquals(paramsListe(f, 3), { page: 3, par_page: 50, non_evaluees: false, mode: 'sans_seance', contexte: 'questions_ari' });
  // Non évaluées : la suite est toujours en page 1 ; toutes : page + 1.
  assertEquals([pageSuivante({ nonEvaluees: true }, 1), pageSuivante({ nonEvaluees: false }, 2)], [1, 3]);
});

Deno.test('reecoute : route #/{env}/reecoute', () => {
  const r = analyserHash('#/dev/reecoute?tout=1&mode=dictee');
  assertEquals([r.env, r.vue, r.canonique, r.query], ['dev', 'reecoute', true, { tout: '1', mode: 'dictee' }]);
  assertEquals(analyserHash('#/prod/reecoute/xyz').canonique, false);
  assertEquals(construireHash({ env: 'prod', vue: 'reecoute', query: { contexte: 'correction_dictee' } }), '#/prod/reecoute?contexte=correction_dictee');
});

Deno.test('reecoute : grille — bon texte seulement en Pas OK et s’il corrige, vides retirés', () => {
  const prise = { priseId: 'p1', transcription: 'soixante  trois' };
  assertEquals(paramsEvaluation(prise, { verdict: 'ok', bonTexte: 'autre chose', commentaire: '' }), { prise_id: 'p1', verdict: 'ok' });
  // Laissé tel que pré-rempli (aux espaces près) : rien n'est envoyé.
  assertEquals(paramsEvaluation(prise, { verdict: 'pas_ok', bonTexte: ' soixante trois ', commentaire: '   ' }), { prise_id: 'p1', verdict: 'pas_ok' });
  assertEquals(paramsEvaluation(prise, { verdict: 'pas_ok', bonTexte: '  soixante-trois  ', commentaire: ' tiret ' }),
    { prise_id: 'p1', verdict: 'pas_ok', bon_texte: 'soixante-trois', commentaire: 'tiret' });
  assertEquals(paramsEvaluation(prise, { verdict: 'ok', commentaire: 'c' }).commentaire, 'c');
  assertEquals(paramsEvaluation(prise, { verdict: 'pas_ok', bonTexte: 'x'.repeat(2500) }).bon_texte.length, 2000);
});

Deno.test('reecoute : compteurs et barre après une évaluation', () => {
  const c = { total: 10, evaluees: 2, pasOk: 1 };
  assertEquals(compteursApres(c, null, 'ok'), { total: 10, evaluees: 3, pasOk: 1 });
  assertEquals(compteursApres(c, null, 'pas_ok'), { total: 10, evaluees: 3, pasOk: 2 });
  assertEquals(compteursApres(c, { verdict: 'pas_ok' }, 'ok'), { total: 10, evaluees: 2, pasOk: 0 });
  assertEquals(compteursApres(c, { verdict: 'ok' }, 'pas_ok'), { total: 10, evaluees: 2, pasOk: 2 });
  assertEquals([progression(c), progression({ total: 3, evaluees: 1 }), progression({ total: 0, evaluees: 0 })], [20, 33.3, 0]);
});

Deno.test('reecoute : carte à ouvrir — 1re non évaluée, puis la suivante non évaluée', () => {
  const p = (ev) => ({ priseId: Math.random().toString(), evaluation: ev ? { verdict: 'ok' } : null });
  const liste = [p(true), p(false), p(true), p(false)];
  assertEquals(indexInitial(liste), 1);
  assertEquals(indexSuivant(liste, 1), 3);
  assertEquals(indexSuivant(liste, 3), null);
  const toutes = [p(true), p(true)];
  assertEquals([indexInitial(toutes), indexSuivant(toutes, 0), indexSuivant(toutes, 1), indexInitial([])], [0, 1, null, null]);
  const a = [{ priseId: 'a' }, { priseId: 'b' }];
  assertEquals(fusionnerPrises(a, [{ priseId: 'b' }, { priseId: 'c' }]).map((x) => x.priseId), ['a', 'b', 'c']);
});

Deno.test('reecoute : raccourcis — Espace, O, N ; rien dans un champ ni avec Ctrl/Cmd', () => {
  const t = (key, tagName = 'LI', mod = {}) => raccourci({ key, target: { tagName }, ...mod });
  assertEquals([t(' '), t('o'), t('O'), t('n'), t('N'), t('x')], ['ecouter', 'ok', 'ok', 'pas_ok', 'pas_ok', null]);
  assertEquals([t('o', 'INPUT'), t('n', 'TEXTAREA'), t(' ', 'SELECT'), t(' ', 'BUTTON'), t(' ', 'AUDIO')], [null, null, null, null, null]);
  assertEquals([t('o', 'BUTTON'), t('o', 'LI', { metaKey: true }), t('n', 'LI', { ctrlKey: true })], ['ok', null, null]);
  assertEquals(raccourci({ key: 'o', target: { tagName: 'DIV', isContentEditable: true } }), null);
});

Deno.test('reecoute : réponse attendue brute → texte lisible', () => {
  assertEquals(texteReponseAttendue({ valeur: 56 }), '56');
  assertEquals(texteReponseAttendue('la Seine'), 'la Seine');
  assertEquals(texteReponseAttendue(['12', 'douze']), '12 · douze');
  assertEquals(texteReponseAttendue({ 1: 'la Seine', 2: 'la Loire' }), '1 : la Seine · 2 : la Loire');
  assertEquals([texteReponseAttendue(null), texteReponseAttendue({}), texteReponseAttendue('')], [null, null, null]);
  assertEquals(optionsContexte([{ contexte: 'tour' }, { contexte: null }], 'neuf'), ['correction_dictee', 'consigne_devoirs', 'questions_ari', 'tour', 'neuf']);
});

Deno.test('mock : liste, filtres, évaluation gardée, erreurs du contrat ; aucune vraie voix, aucun prénom', async () => {
  const api = creerApi({ transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }) });
  const tout = await api.reecouteListe('prod', paramsListe(filtresDepuisQuery({ tout: '1' })));
  assertEquals(tout.compteurs, { total: 12, evaluees: 2, pasOk: 1 });
  assertEquals(tout.prises.map((p) => p.rang), [...Array(12)].map((_, k) => k + 1));
  assert(tout.prises.every((p, k) => !k || p.priseLe > tout.prises[k - 1].priseLe), 'de la plus ancienne à la plus récente');
  assert(tout.prises.every((p) => p.purgee || p.url.startsWith('data:audio/wav;base64,')), 'audio factice seulement');
  assert(tout.prises.some((p) => p.purgee) && tout.prises.some((p) => p.filtre === 'silence' && p.transcription === ''));
  assert(tout.prises.some((p) => !p.sessionId && p.mode === null && p.contexte === 'questions_ari' && !p.messageAriAvant));
  const json = JSON.stringify(tout);
  for (const c of CHILDREN) assert(!json.includes(c.prenom), 'prénom ' + c.prenom + ' absent');
  assert(tout.prises.every((p) => /^E-[0-9a-f]{6}$/.test(p.enfant)));

  const non = await api.reecouteListe('prod', paramsListe(filtresDepuisQuery({})));
  assertEquals(non.nbResultats, 10);
  const dictee = await api.reecouteListe('prod', paramsListe(filtresDepuisQuery({ tout: '1', mode: 'dictee' })));
  assertEquals(dictee.prises.map((p) => p.contexte), ['correction_dictee', 'correction_dictee']);
  const hors = await api.reecouteListe('prod', paramsListe(filtresDepuisQuery({ tout: '1', mode: 'sans_seance' })));
  assertEquals(hors.prises.length, 1);
  const page2 = await api.reecouteListe('prod', { page: 2, par_page: 5, non_evaluees: false });
  assertEquals([page2.nbPages, page2.prises.map((p) => p.rang)], [3, [6, 7, 8, 9, 10]]);

  const cible = non.prises[0];
  const r = await api.reecouteEvaluer('prod', { prise_id: cible.priseId, verdict: 'pas_ok', bon_texte: '  soixante-trois ', commentaire: '  ' });
  assertEquals([r.verdict, r.bonTexte, r.commentaire], ['pas_ok', 'soixante-trois', null]);
  const apres = await api.reecouteListe('prod', paramsListe(filtresDepuisQuery({})));
  assertEquals([apres.nbResultats, apres.compteurs.evaluees, apres.compteurs.pasOk], [9, 3, 2]);
  // Remplacement : OK efface le bon texte.
  const r2 = await api.reecouteEvaluer('prod', { prise_id: cible.priseId, verdict: 'ok', bon_texte: 'ignoré' });
  assertEquals([r2.verdict, r2.bonTexte], ['ok', null]);

  const m = creerReecouteMock();
  const erreur = (f) => { try { f(); } catch (e) { return [e.status, e.message]; } return null; };
  assertEquals(erreur(() => m.reecoute_evaluer({ prise_id: 'abc', verdict: 'ok' })), [400, "'prise_id' is required and must be a uuid"]);
  assertEquals(erreur(() => m.reecoute_evaluer({ prise_id: cible.priseId, verdict: 'bof' })), [400, "'verdict' must be one of 'ok', 'pas_ok'"]);
  assertEquals(erreur(() => m.reecoute_evaluer({ prise_id: cible.priseId, verdict: 'ok', commentaire: 'x'.repeat(2001) })), [400, "'commentaire' must be a string of at most 2000 characters"]);
  assertEquals(erreur(() => m.reecoute_evaluer({ prise_id: '50000000-0000-4000-8000-999999999999', verdict: 'ok' })), [404, 'Unknown prise_id']);
  assertEquals(erreur(() => m.reecoute_liste({ mode: 'peinture' }))[0], 400);
  assertEquals(erreur(() => m.reecoute_liste({ non_evaluees: 'oui' }))[0], 400);
  assertEquals(m.reecoute_liste({ page: 9 }).prises, []);
});

// ---------- La vue entière sur un faux DOM (clavier, clics, mock) ----------
class Elt {
  constructor(tag) {
    Object.assign(this, { tagName: tag.toUpperCase(), enfants: [], className: '', _texte: '', attrs: {}, style: {}, dataset: {}, ecouteurs: {}, hidden: false, value: '', paused: true });
    this.classList = {
      add: (c) => { if (!this.classList.contains(c)) this.className = (this.className + ' ' + c).trim(); },
      remove: (c) => { this.className = this.className.split(' ').filter((x) => x && x !== c).join(' '); },
      contains: (c) => this.className.split(' ').includes(c),
    };
  }
  get isConnected() { return true; }
  append(...n) { for (const x of n) this.enfants.push(typeof x === 'string' ? Object.assign(new Elt('#text'), { _texte: x }) : x); }
  replaceChildren(...n) { this.enfants = []; this._texte = ''; this.append(...n); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(type, f) { (this.ecouteurs[type] ||= []).push(f); }
  emettre(type, ev = {}) { return Promise.all((this.ecouteurs[type] || []).map((f) => f({ key: '', target: this, preventDefault() {}, ...ev }))); }
  click() { return this.emettre('click'); }
  focus() { globalThis.document.activeElement = this; }
  scrollIntoView() {}
  setSelectionRange() {}
  load() {}
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  set textContent(t) { this._texte = String(t); this.enfants = []; }
  get textContent() { return this._texte + this.enfants.map((e) => e.textContent).join(''); }
  get innerHTML() { throw new Error('innerHTML interdit'); }
  tous(pred) { return [...(pred(this) ? [this] : []), ...this.enfants.flatMap((e) => e.tous(pred))]; }
  un(classe) { return this.tous((e) => e.classList.contains(classe))[0]; }
}
const attendre = async () => { for (let k = 0; k < 20; k++) await new Promise((r) => setTimeout(r, 0)); };

Deno.test('vue Réécoute : 1re non évaluée ouverte, O enregistre et ouvre la suivante, N puis champs, compteurs à jour', async () => {
  const { rendre } = await import('../vues/reecoute.js');
  const avant = globalThis.document;
  const doc = { ecouteurs: {}, createElement: (t) => new Elt(t), activeElement: null, addEventListener(type, f) { (this.ecouteurs[type] ||= []).push(f); } };
  globalThis.document = doc;
  const touche = (key, tagName = 'LI') => Promise.all(doc.ecouteurs.keydown.map((f) => f({ key, target: { tagName }, preventDefault() {} })));
  try {
    const api = creerApi({ transport: transportMock({ estConnecte: () => true, estAutorise: () => true, delaiMs: 0 }) });
    const vue = await rendre({ route: { env: 'prod', vue: 'reecoute', query: {} }, api, signal: new AbortController().signal });
    const ouverte = () => vue.un('is-open');
    const chiffres = () => vue.tous((e) => e.classList.contains('reecoute-chiffre-valeur')).map((e) => e.textContent).join('/');
    assertEquals(chiffres(), '12/2/1');
    assertEquals(vue.tous((e) => e.classList.contains('reecoute-carte')).length, 10);
    // 1re non évaluée = 2e prise du mock, avec exercice et réponse attendue.
    assertEquals(ouverte().un('reecoute-transcription').textContent, 'soixante trois');
    assert(ouverte().textContent.includes('Bravo ! Et 7 × 9 ?'));
    assert(ouverte().textContent.includes('Réponse attendue : 63'));
    assert(ouverte().textContent.includes('ex-mult-7x9'));
    assertEquals(ouverte().tous((e) => e.tagName === 'AUDIO').length, 1);
    for (const c of CHILDREN) assert(!vue.textContent.includes(c.prenom));
    assert(!vue.textContent.includes('data:'), 'URL jamais affichée');

    await touche(' ');
    assertEquals(ouverte().tous((e) => e.tagName === 'AUDIO')[0].paused, false);
    await touche('o');
    await attendre();
    assertEquals(chiffres(), '12/3/1');
    assert(vue.un('reecoute-annonce').textContent.includes('enregistrée : OK'));
    // Carte suivante : la prise filtrée « silence », texte vide.
    assertEquals(ouverte().un('reecoute-transcription').textContent, '(aucun texte rendu)');
    assertEquals(ouverte().un('reecoute-statut').textContent, '');

    await touche('n');
    const bon = ouverte().un('reecoute-bon-texte');
    assertEquals([doc.activeElement, ouverte().un('reecoute-champs').hidden], [bon, false]);
    assertEquals(await touche('o', 'INPUT'), [undefined]); // rien dans un champ
    bon.value = 'oui';
    await bon.emettre('input');
    await bon.emettre('blur');
    await attendre();
    assertEquals(chiffres(), '12/4/2');
    assert(ouverte().un('reecoute-statut').textContent.startsWith('Enregistré · Pas OK'));
    const com = ouverte().un('reecoute-commentaire');
    com.value = 'silence mal filtré';
    await com.emettre('input');
    await com.emettre('keydown', { key: 'Enter' });
    await attendre();
    // Entrée dans le commentaire : enregistré (même prise, pas de double compte), puis suivante.
    assertEquals(chiffres(), '12/4/2');
    assertEquals(ouverte().un('reecoute-transcription').textContent, 'le rône');

    const toutes = await api.reecouteListe('prod', paramsListe(filtresDepuisQuery({ tout: '1' })));
    const silence = toutes.prises.find((p) => p.filtre === 'silence');
    assertEquals(silence.evaluation.verdict, 'pas_ok');
    assertEquals([silence.evaluation.bonTexte, silence.evaluation.commentaire], ['oui', 'silence mal filtré']);
    const resumes = vue.tous((e) => e.classList.contains('reecoute-resume')).map((e) => e.textContent);
    assert(resumes.some((t) => t.startsWith('#1') && t.endsWith('OK')) && resumes.some((t) => t.startsWith('#2') && t.endsWith('Pas OK')));
  } finally {
    globalThis.document = avant;
  }
});
