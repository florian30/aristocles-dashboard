/* ============================================================
   Mocks des actions `enfants` (§ 2.6) et `enfant` (§ 2.7) —
   formes brutes de l'Edge. Familles, e-mails et contenus parent
   sont fictifs. Sans plage : toutes les séances factices (elles
   tiennent dans les 92 derniers jours).
   ============================================================ */

import { aujourdhuiParis, debutJourParisMs, decalerJour, jourParis } from '../ui/paris.js';
import { ACQUISITIONS, CHILDREN, SESSIONS } from './donnees.js';
import { devoirBrut, dicteeBrute, photosSeance } from './fil.js';
import { resumeSeance } from './journee.js';
import { dansPlage } from './outils.js';

// childId → [genre, créé il y a N jours, parent_id, e-mail parent]
const FAMILLES = {
  c1: ['fille', 61, 'p-0001', 'famille.moreau@example.org'],
  c2: ['garcon', 45, 'p-0002', 'k.benali@example.org'],
  c3: ['garcon', 40, 'p-0003', 'adam.parents@example.org'],
  c4: ['fille', 45, 'p-0002', 'k.benali@example.org'], // fratrie de Maël
  c5: ['fille', 30, 'p-0004', 'n.rossi@example.org'],
  c6: ['non_precise', 20, 'p-0005', null], // compte parent introuvable
  c7: ['garcon', 12, 'p-0006', 'leon.dupuis@example.org'],
  c8: ['garcon', 5, 'p-0007', 'jules.martin@example.org'],
};

const ACQUISES = ['acquise', 'parfaitement_acquise'];

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const aHeure = (jour, h, min = 0) => new Date(debutJourParisMs(jour) + (h * 60 + min) * 60000).toISOString();

function identite(c) {
  const [genre, joursAvant, parentId, email] = FAMILLES[c.id];
  return {
    child_id: c.id,
    first_name: c.name,
    classe: c.classe,
    genre,
    created_at: aHeure(decalerJour(aujourdhuiParis(), -joursAvant), 18, 12),
    parent_id: parentId,
    parent_email: email,
  };
}

const seancesDe = (childId, params) => SESSIONS
  .map((s, i) => ({ s, i }))
  .filter(({ s }) => s.childId === childId && dansPlage(s, params))
  .sort((a, b) => b.s.startedAt.localeCompare(a.s.startedAt));

const nbAcquises = (childId) => (ACQUISITIONS[childId] || []).filter((a) => ACQUISES.includes(a.maitrise)).length;

export function enfants(params = {}) {
  return {
    from: params.from || null,
    to: params.to || null,
    enfants: CHILDREN.map((c) => {
      const miennes = seancesDe(c.id, params);
      return {
        ...identite(c),
        derniere_activite: miennes[0]?.s.startedAt || null,
        seances: miennes.length,
        notions_acquises: nbAcquises(c.id),
      };
    }).sort((a, b) => a.first_name.localeCompare(b.first_name)),
  };
}

// Clé d'un bilan hebdomadaire factice : le lundi de la semaine passée.
function lundiPrecedent() {
  const jour = decalerJour(aujourdhuiParis(), -7);
  const [y, m, d] = jour.split('-').map(Number);
  return decalerJour(jour, -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7));
}

function bilans(c, miennes) {
  const jours = [...new Set(miennes.map(({ s }) => jourParis(s.startedAt)))].slice(0, 3);
  const liste = jours.map((jour, k) => ({
    id: 'bilan-' + c.id + '-' + jour,
    type: 'quotidien',
    periode_cle: jour,
    statut: 'genere',
    contenu: {
      titre: k === 0 ? c.name + ' a bien avancé aujourd’hui' : 'Une séance régulière',
      resume: c.name + ' a travaillé avec Ari sur « ' + miennes.find(({ s }) => jourParis(s.startedAt) === jour).s.theme + ' ». ' +
        'Les explications sont venues de ' + c.name + ', Ari a surtout posé des questions.',
      points_forts: ['Persévérance quand la première réponse était fausse', 'Justifie ses réponses à voix haute'],
      a_travailler: ['Reprendre la règle sans rappel'],
      question_du_soir: 'Demandez-lui d’expliquer la règle avec ses mots : c’est < 2 minutes & très efficace.',
    },
    modele: 'anthropic/claude-haiku-4.5',
    genere_at: aHeure(jour, 20),
    regenere_at: k === 1 ? aHeure(jour, 21, 5) : null,
    lu_at: k === 0 ? null : aHeure(decalerJour(jour, 1), 7, 48),
  }));
  if (miennes.length <= 2) {
    liste.push({
      id: 'bilan-' + c.id + '-hebdo',
      type: 'hebdomadaire',
      periode_cle: lundiPrecedent(),
      statut: 'matiere_insuffisante',
      contenu: null,
      modele: null,
      genere_at: aHeure(decalerJour(aujourdhuiParis(), -1), 19),
      regenere_at: null,
      lu_at: null,
    });
  }
  return liste.sort((a, b) => b.genere_at.localeCompare(a.genere_at));
}

function conversations(c, bilansEnfant) {
  const premier = bilansEnfant.find((b) => b.statut === 'genere');
  if (!premier || !['c1', 'c2', 'c5'].includes(c.id)) return [];
  const debut = Date.parse(premier.genere_at) + 45 * 60000;
  return [{
    id: 'conv-' + c.id,
    entree_type: premier.type,
    entree_periode_cle: premier.periode_cle,
    messages: [
      { role: 'user', content: 'Bonsoir, ' + c.name + ' dit que c’était « trop facile ». Vous confirmez ?' },
      { role: 'assistant', content: 'Bonsoir ! ' + c.name + ' a réussi la plupart des exercices, mais a eu besoin d’une question pour démarrer le dernier. Je dirais plutôt « à sa portée ».' },
      { role: 'user', content: 'Ok. Est-ce que je dois lui faire refaire des exercices <ce week-end> ?' },
      { role: 'assistant', content: 'Pas besoin de fiches : lui demander d’expliquer la règle à voix haute suffit. Ari reprendra la notion à la prochaine séance.' },
    ],
    modele: 'anthropic/claude-haiku-4.5',
    cree_at: new Date(debut).toISOString(),
    maj_at: new Date(debut + 6 * 60000).toISOString(),
  }];
}

function memoire(c, miennes) {
  if (c.id === 'c6' || c.id === 'c8') return null;
  return {
    intelligences_emergentes: ['logico-mathématique', 'verbale'],
    preferences_pedagogiques: { rythme: 'calme', visuels: 'aime les schémas', encouragements: 'sobres' },
    interets_personnels: c.id === 'c1' ? ['chats', 'dessin', 'pâtisserie'] : ['football', 'dinosaures'],
    contexte_personnel: { fratrie: c.id === 'c2' || c.id === 'c4' ? 'frère et sœur tous deux inscrits' : 'non précisé' },
    niveau_dictee: 'moyen',
    derniere_extraction_at: miennes[0]?.s.startedAt || null,
    updated_at: miennes[0]?.s.startedAt || aHeure(decalerJour(aujourdhuiParis(), -10), 18),
  };
}

export function enfant(params = {}) {
  const c = CHILDREN.find((x) => x.id === params.child_id);
  if (!c) return undefined;
  const miennes = seancesDe(c.id, params);
  const derniere = miennes[0]?.s.startedAt || null;
  const bilansEnfant = bilans(c, miennes);
  const maitrise = (ACQUISITIONS[c.id] || []).map((a) => ({
    concept_id: slug(a.notion),
    notion: a.notion,
    statut_maitrise: a.maitrise,
    statut_vu_en_classe: a.vuEnClasse,
    derniere_mise_a_jour: a.majDate + 'T16:30:00Z',
  })).sort((a, b) => b.derniere_mise_a_jour.localeCompare(a.derniere_mise_a_jour));

  return {
    from: params.from || null,
    to: params.to || null,
    identite: identite(c),
    seances: miennes.map(({ s, i }) => resumeSeance(s, i)),
    maitrise,
    notions_acquises: nbAcquises(c.id),
    devoirs: miennes.map(({ s }) => devoirBrut(s)).filter(Boolean),
    dictees: miennes.map(({ s }) => dicteeBrute(s)).filter(Boolean),
    bilans: bilansEnfant,
    conversations_parent: conversations(c, bilansEnfant),
    memory_profile: memoire(c, miennes),
    ecrans: miennes.length
      ? [
        { ecran: 'accueil', nb: miennes.length + 2, duree_totale_ms: 14000 * (miennes.length + 2) },
        { ecran: 'espace_parent', nb: 2, duree_totale_ms: 126000 },
        { ecran: 'bilan_parent', nb: 1, duree_totale_ms: 58000 },
      ]
      : [],
    versions: derniere
      ? [
        { app_version: '1.4.0', app_build: 142, plateforme: c.id === 'c5' ? 'android' : 'ios', enfants: 1, lancements: miennes.length + 1, dernier_vu: derniere },
        ...(miennes.length > 1 ? [{ app_version: '1.3.2', app_build: 131, plateforme: 'ios', enfants: 1, lancements: 1, dernier_vu: miennes[miennes.length - 1].s.startedAt }] : []),
      ]
      : [],
    photos: miennes.flatMap(({ s }) => photosSeance(s)).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}
