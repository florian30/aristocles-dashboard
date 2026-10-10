/* ============================================================
   Mock de l'Edge `notifs_console` (rubrique Messages, `?mock=1`).
   Formes brutes de l'Edge (plan-n6 § 3, plan-n7 § 4). Contrairement
   aux autres mocks, celui-ci a un ÉTAT : une campagne envoyée ou un
   message écrit restent visibles jusqu'au rechargement de la page.
   Familles, téléphones et textes sont fictifs ; les parents sont
   ceux de mock/familles.js (p-0001…p-0007, pas des UUID).

   Pour essayer les cas difficiles depuis l'écran :
   · un texte contenant « coupure » : la campagne part, puis la
     réponse se perd (erreur réseau) ; réessayer rend `deja: true` ;
   · un texte contenant « bloque » : l'envoi reste « en cours », la
     réponse se perd ; réessayer rend 409 en_cours, « reprendre »
     le termine ;
   · renvoyer le même message sous un autre numéro : 409 doublon.
   ============================================================ */

import { ApiError } from '../api.js';
import { heureParis } from '../ui/paris.js';

const TYPES = ['nouveautes', 'actualites'];
const DESTINATIONS = ['aucune', 'accueil_enfant', 'apprentissage', 'devoirs', 'dictee', 'espace_parent',
  'bilan_semaine', 'bilan_jour', 'notifications', 'url'];
const DESTINATIONS_PARENT = ['espace_parent', 'bilan_semaine', 'bilan_jour', 'notifications'];
const CLASSES = ['CE1', 'CE2', 'CM1', 'CM2'];
const REPERE_MENSUEL = { nouveautes: 2, actualites: 1 };
const MIN = 60000;
const HEURE = 60 * MIN;
const JOUR = 24 * HEURE;

// Parents fictifs : classes des enfants, téléphones, types coupés,
// notifications reçues ces 7 derniers jours (pour le repère hebdo).
const PARENTS = [
  { id: 'p-0001', classes: ['CE2'], coupe: [], recus7j: 3, appareils: [['ios', '1.4.0', 142, 2]] },
  { id: 'p-0002', classes: ['CM1', 'CE1'], coupe: [], recus7j: 1, appareils: [['android', '1.4.0', 142, 1], ['ios', '1.3.2', 131, 9]] },
  { id: 'p-0003', classes: ['CM2'], coupe: ['actualites'], recus7j: 0, appareils: [['ios', '1.4.0', 142, 3]] },
  { id: 'p-0004', classes: ['CE2'], coupe: [], recus7j: 2, appareils: [['android', '1.3.2', 131, 6]] },
  { id: 'p-0005', classes: ['CM1'], coupe: [], recus7j: 0, appareils: [] },
  { id: 'p-0006', classes: ['CE1'], coupe: [], recus7j: 0, appareils: [['ios', '1.4.0', 142, 0]] },
  { id: 'p-0007', classes: ['CM2'], coupe: ['nouveautes'], recus7j: 0, appareils: [['android', '1.4.0', 142, 4]] },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_ZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const URL_RE = /^https:\/\/\S+$/;

const refus = (champ, attendu) => new ApiError("Invalid body: '" + champ + "' must be " + attendu, 400);
const conflit = (error, campagne) => new ApiError(error, 409, { error, campagne });
const entier = (v) => Number.isInteger(v);
const estTexte = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

function uuidFactice(n) {
  return '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
}

// ---------- Lecture des demandes (sous-ensemble fidèle des refus) ----------

function lireMessage(m) {
  if (!m || typeof m !== 'object') throw refus('message', 'an object');
  if (!TYPES.includes(m.type)) throw refus('message.type', 'one of ' + TYPES.join(', '));
  if (!estTexte(m.titre, 80)) throw refus('message.titre', 'a non-empty string of at most 80 characters');
  if (!estTexte(m.texte, 240)) throw refus('message.texte', 'a non-empty string of at most 240 characters');
  const destination = m.destination ?? 'aucune';
  if (!DESTINATIONS.includes(destination)) throw refus('message.destination', 'one of the fixed destinations');
  if (destination === 'url' && !(typeof m.url === 'string' && URL_RE.test(m.url) && m.url.length <= 500)) {
    throw refus('message.url', 'an https URL of at most 500 characters');
  }
  if (destination !== 'url' && m.url != null) throw refus('message.url', 'absent unless destination is url');
  return { type: m.type, titre: m.titre, texte: m.texte, destination, url: destination === 'url' ? m.url : null };
}

function lireCible(c, { familles = true, maxExclu = false } = {}) {
  const cible = { plateforme: null, classes: null, build_min: null, build_max: null, parent_ids: null };
  if (c == null) return cible;
  if (typeof c !== 'object') throw refus('cible', 'an object');
  if (c.plateforme != null) {
    if (!['ios', 'android'].includes(c.plateforme)) throw refus('cible.plateforme', 'ios or android');
    cible.plateforme = c.plateforme;
  }
  if (c.classes != null) {
    if (!Array.isArray(c.classes) || !c.classes.length || c.classes.some((x) => !CLASSES.includes(x))) {
      throw refus('cible.classes', 'a non-empty list of ' + CLASSES.join(', '));
    }
    cible.classes = [...new Set(c.classes)];
  }
  for (const b of ['build_min', 'build_max']) {
    if (c[b] != null) {
      if (!entier(c[b]) || c[b] < 1) throw refus('cible.' + b, 'an integer >= 1');
      cible[b] = c[b];
    }
  }
  if (cible.build_min && cible.build_max && (maxExclu ? cible.build_max <= cible.build_min : cible.build_max < cible.build_min)) {
    throw refus('cible.build_max', maxExclu ? 'greater than build_min' : 'at least build_min');
  }
  if (c.parent_ids != null) {
    if (!familles) throw refus('cible.parent_ids', 'absent (use parent_ids beside message)');
    // Le vrai serveur exige des UUID ; les parents factices n'en sont pas.
    if (!Array.isArray(c.parent_ids) || !c.parent_ids.length || c.parent_ids.length > 200) {
      throw refus('cible.parent_ids', 'a list of 1 to 200 parent ids');
    }
    cible.parent_ids = [...new Set(c.parent_ids)];
  }
  return cible;
}

function lireDate(v, champ) {
  if (v == null) return null;
  if (typeof v !== 'string' || !ISO_ZONE_RE.test(v) || Number.isNaN(Date.parse(v))) {
    throw refus(champ, 'an ISO date with a time zone');
  }
  return new Date(Date.parse(v)).toISOString();
}

// ---------- Audience ----------

function audience(cible, type) {
  const visees = PARENTS.filter((p) =>
    (!cible.parent_ids || cible.parent_ids.includes(p.id)) &&
    (!cible.classes || p.classes.some((c) => cible.classes.includes(c))));
  const telephones = (p) => p.appareils.filter(([plateforme, , build]) =>
    (!cible.plateforme || plateforme === cible.plateforme) &&
    (!cible.build_min || build >= cible.build_min) &&
    (!cible.build_max || build <= cible.build_max));
  const avecAppareil = visees.filter((p) => telephones(p).length);
  const joignables = avecAppareil.filter((p) => !p.coupe.includes(type));
  const appareils = joignables.flatMap(telephones);
  return {
    parents: joignables,
    resume: {
      familles: visees.length,
      avec_appareil: avecAppareil.length,
      joignables: joignables.length,
      type_coupe: avecAppareil.length - joignables.length,
      appareils: appareils.length,
      par_plateforme: {
        ios: appareils.filter(([p]) => p === 'ios').length,
        android: appareils.filter(([p]) => p === 'android').length,
      },
    },
  };
}

// ---------- L'Edge factice ----------

export function creerConsoleMock({ maintenant = () => new Date() } = {}) {
  const t0 = maintenant().getTime();
  const iso = (ms) => new Date(ms).toISOString();
  const campagnes = new Map();
  const messages = new Map();
  const recus = new Map(PARENTS.map((p) => [p.id, p.recus7j]));

  // ----- Campagnes de départ -----
  const graine = (c) => campagnes.set(c.id, {
    destination: 'aucune', url: null, cible: { plateforme: null, classes: null, build_min: null, build_max: null, familles: null },
    envoyer_a: null, parents: 0, appareils: 0, envoyes: 0, perimes: 0, echecs: 0, ouverts: 0, codes_echec: {},
    terminee_at: null, annulee_at: null, ...c,
  });
  graine({
    id: uuidFactice(9001), type: 'nouveautes', titre: 'La dictée arrive dans Aristocles',
    texte: 'Votre enfant peut maintenant s’entraîner à la dictée avec Ari. Essayez ce soir !',
    destination: 'dictee', etat: 'terminee', created_at: iso(t0 - 6 * JOUR), terminee_at: iso(t0 - 6 * JOUR + 2 * MIN),
    parents: 5, appareils: 6, envoyes: 5, perimes: 1, echecs: 0, ouverts: 3,
  });
  graine({
    id: uuidFactice(9002), type: 'actualites', titre: 'Bonne rentrée des vacances',
    texte: 'Ari a préparé de quoi reprendre en douceur.', etat: 'annulee',
    envoyer_a: iso(t0 - 2 * JOUR), created_at: iso(t0 - 4 * JOUR), annulee_at: iso(t0 - 3 * JOUR),
  });
  graine({
    id: uuidFactice(9003), type: 'nouveautes', titre: 'Nouveaux exercices de CM2',
    texte: 'Des exercices de fractions sont disponibles.', etat: 'programmee',
    cible: { plateforme: null, classes: ['CM2'], build_min: null, build_max: null, familles: null },
    envoyer_a: iso(t0 + 2 * JOUR + 3 * HEURE), created_at: iso(t0 - 2 * HEURE),
  });
  graine({
    id: uuidFactice(9004), type: 'actualites', titre: 'Petit sondage',
    texte: 'Dites-nous ce que vous pensez de l’espace parent.', destination: 'url', url: 'https://example.org/sondage',
    etat: 'programmee', envoyer_a: iso(t0 - 5 * HEURE), created_at: iso(t0 - JOUR),
  });
  graine({
    id: uuidFactice(9005), type: 'nouveautes', titre: 'Mise à jour iOS',
    texte: 'La nouvelle version corrige le micro sur iPad.', etat: 'terminee',
    cible: { plateforme: 'ios', classes: null, build_min: null, build_max: 141, familles: null },
    created_at: iso(t0 - 20 * JOUR), terminee_at: iso(t0 - 20 * JOUR + MIN),
    parents: 2, appareils: 2, envoyes: 1, perimes: 0, echecs: 1, ouverts: 1, codes_echec: { UNREGISTERED: 1 },
  });

  // ----- Messages dans l'app de départ -----
  const messageBase = {
    actif: false, format: 'feuille', emplacement: 'accueil_enfant', declencheur: 'prochaine_ouverture', declencheur_n: null,
    surtitre: null, titre: null, texte: null, points: [], image_chemin: null, bouton_libelle: null,
    destination: 'aucune', url: null, cible: { plateforme: null, classes: null, build_min: null, build_max: null, familles: null },
    priorite: 0, debut_at: null, fin_at: null, max_affichages: 1,
  };
  const graineMessage = (m) => messages.set(m.id, { ...messageBase, ...m, updated_at: m.updated_at || m.created_at });
  graineMessage({
    id: uuidFactice(8001), nom: 'Annonce dictée (enfant)', actif: true, surtitre: 'Nouveau',
    texte: 'Tu peux maintenant faire des dictées avec moi ! On essaie ?', bouton_libelle: 'Essayer', destination: 'dictee',
    priorite: 10, max_affichages: 2, debut_at: iso(t0 - 5 * JOUR), fin_at: iso(t0 + 10 * JOUR), created_at: iso(t0 - 6 * JOUR),
  });
  graineMessage({
    id: uuidFactice(8002), nom: 'Découvrir le bilan de la semaine', format: 'plein_ecran', emplacement: 'espace_parent',
    declencheur: 'nieme_entree_parent', declencheur_n: 3, surtitre: 'Espace parent', titre: 'Chaque lundi, un bilan',
    texte: 'Ari résume la semaine de votre enfant : ce qui est acquis, ce qui reste à travailler.',
    points: ['Les notions vues', 'Les réussites', 'Une question pour le soir'], image_chemin: 'annonces/bilan.png',
    bouton_libelle: 'Voir le bilan', destination: 'bilan_semaine', created_at: iso(t0 - 3 * JOUR),
  });
  graineMessage({
    id: uuidFactice(8003), nom: 'Essai depuis une notification', emplacement: 'espace_parent', declencheur: 'ouverture_notif',
    texte: 'Un message ouvert par une notification.', created_at: iso(t0 - JOUR),
    cible: { plateforme: null, classes: null, build_min: null, build_max: null, familles: 2 },
  });

  // ----- Avertissements -----
  function avertissements(message, cible, quand, sauf) {
    const liste = [];
    const heure = heureParis(quand);
    if (heure >= '20:30' || heure < '08:00') liste.push({ code: 'horaire_nuit', heure_paris: heure, debut: '20:30', fin: '08:00' });
    const { parents } = audience(cible, message.type);
    const charges = parents.filter((p) => recus.get(p.id) >= 3).length;
    if (charges) liste.push({ code: 'repere_hebdo', parents: charges, repere: 3 });
    const now = maintenant().getTime();
    const memeType = [...campagnes.values()].filter((c) => c.type === message.type && c.etat !== 'annulee' &&
      c.id !== sauf && now - Date.parse(c.created_at) < 30 * JOUR).length;
    if (memeType >= REPERE_MENSUEL[message.type]) {
      liste.push({ code: 'repere_mensuel', envois: memeType, repere: REPERE_MENSUEL[message.type], jours: 30 });
    }
    const doublon = doublonDe(message, sauf);
    if (doublon) liste.push({ code: 'doublon_probable', campagne_id: doublon.id, envoye_at: doublon.created_at });
    return liste;
  }

  function doublonDe(message, sauf) {
    const now = maintenant().getTime();
    return [...campagnes.values()].find((c) => c.id !== sauf && c.etat !== 'annulee' && c.type === message.type &&
      c.titre === message.titre && c.texte === message.texte && now - Date.parse(c.created_at) < JOUR) || null;
  }

  const pourEcran = (c) => {
    const { codes_echec: _codes, ouverts: _ouverts, cibleEnvoi: _cible, reponsePerdue: _perdue, ...reste } = c;
    return structuredClone(reste);
  };

  function servir(c, cible) {
    const { parents, resume } = audience(cible, c.type);
    for (const p of parents) recus.set(p.id, recus.get(p.id) + 1);
    Object.assign(c, {
      parents: resume.joignables, appareils: resume.appareils,
      envoyes: Math.max(0, resume.appareils - (resume.appareils > 3 ? 1 : 0)),
      perimes: resume.appareils > 3 ? 1 : 0, echecs: 0,
      etat: 'terminee', terminee_at: maintenant().toISOString(),
    });
  }

  const actions = {
    apercu(params) {
      const message = lireMessage(params.message);
      const cible = lireCible(params.cible);
      const envoyerA = lireDate(params.envoyer_a, 'envoyer_a');
      const quand = envoyerA && Date.parse(envoyerA) > maintenant().getTime() ? envoyerA : maintenant().toISOString();
      return {
        message: { ...message, pin: DESTINATIONS_PARENT.includes(message.destination), limites: { titre: 80, texte: 240 } },
        audience: audience(cible, message.type).resume,
        avertissements: avertissements(message, cible, quand, params.campagne_id),
      };
    },

    appareils(params) {
      const p = PARENTS.find((x) => x.id === params.parent_id);
      if (typeof params.parent_id !== 'string' || !params.parent_id) throw refus('parent_id', 'a uuid');
      const n = PARENTS.indexOf(p) + 1;
      return {
        appareils: (p ? p.appareils : []).map(([plateforme, version_app, build, joursAvant], k) => ({
          appareil_id: uuidFactice(n * 100 + k + 1), plateforme, version_app, build,
          dernier_vu_at: iso(t0 - joursAvant * JOUR - (k + 1) * HEURE),
        })).sort((a, b) => b.dernier_vu_at.localeCompare(a.dernier_vu_at)),
      };
    },

    envoyer_test(params) {
      if (!UUID_RE.test(params.appareil_id || '')) throw refus('appareil_id', 'a uuid');
      const message = lireMessage(params.message);
      const parent = PARENTS.find((p, i) => p.appareils.some((_, k) => uuidFactice((i + 1) * 100 + k + 1) === params.appareil_id));
      if (!parent) return undefined;
      if (parent.coupe.includes(message.type)) return { statut: 'non_envoye', code: null, raison: 'type_coupe' };
      return { statut: 'envoye', code: null };
    },

    envoyer(params) {
      if (!UUID_RE.test(params.campagne_id || '')) throw refus('campagne_id', 'a uuid');
      const message = lireMessage(params.message);
      const cible = lireCible(params.cible);
      const envoyerA = lireDate(params.envoyer_a, 'envoyer_a');
      const programmee = envoyerA && Date.parse(envoyerA) > maintenant().getTime();
      if (programmee && cible.parent_ids) throw refus('cible.parent_ids', 'absent when envoyer_a is in the future');

      const existante = campagnes.get(params.campagne_id);
      if (existante) {
        if (existante.etat === 'en_cours') {
          if (!params.reprendre) throw conflit('en_cours', pourEcran(existante));
          servir(existante, existante.cibleEnvoi);
          return { campagne: pourEcran(existante), deja: false, avertissements: [] };
        }
        return { campagne: pourEcran(existante), deja: true, avertissements: [] };
      }
      const doublon = doublonDe(message, params.campagne_id);
      if (doublon && !params.confirmer_doublon) throw conflit('doublon_probable', pourEcran(doublon));

      const quand = programmee ? envoyerA : maintenant().toISOString();
      const alertes = avertissements(message, cible, quand, params.campagne_id);
      const { parent_ids: ids, ...reste } = cible;
      const c = {
        id: params.campagne_id, ...message,
        cible: { ...reste, familles: ids ? ids.length : null }, cibleEnvoi: cible,
        etat: programmee ? 'programmee' : 'en_cours', envoyer_a: programmee ? envoyerA : null,
        parents: 0, appareils: 0, envoyes: 0, perimes: 0, echecs: 0, ouverts: 0, codes_echec: {},
        created_at: maintenant().toISOString(), terminee_at: null, annulee_at: null,
      };
      campagnes.set(c.id, c);
      if (!programmee && !message.texte.toLowerCase().includes('bloque')) servir(c, cible);
      // Cas d'essai : l'écriture a eu lieu, la réponse se perd.
      if (!programmee && /coupure|bloque/i.test(message.texte) && !c.reponsePerdue) {
        c.reponsePerdue = true;
        throw new ApiError('Impossible de contacter le serveur (mock).', 0);
      }
      return { campagne: pourEcran(c), deja: false, avertissements: alertes };
    },

    annuler(params) {
      if (!UUID_RE.test(params.campagne_id || '')) throw refus('campagne_id', 'a uuid');
      const c = campagnes.get(params.campagne_id);
      if (!c) return undefined;
      if (c.etat === 'annulee') return { campagne: pourEcran(c), deja: true };
      if (c.etat !== 'programmee') throw conflit('deja_partie', pourEcran(c));
      Object.assign(c, { etat: 'annulee', annulee_at: maintenant().toISOString() });
      return { campagne: pourEcran(c), deja: false };
    },

    resultats(params) {
      const jours = params.jours ?? 30;
      if (!entier(jours) || jours < 1 || jours > 90) throw refus('jours', 'an integer between 1 and 90');
      const now = maintenant().getTime();
      return {
        jours,
        campagnes: [...campagnes.values()]
          .filter((c) => now - Date.parse(c.created_at) <= jours * JOUR)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((c) => {
            const { cibleEnvoi: _c, reponsePerdue: _r, ...reste } = c;
            return {
              ...structuredClone(reste),
              en_retard: c.etat === 'programmee' && c.envoyer_a && Date.parse(c.envoyer_a) < now - 120 * MIN,
            };
          }),
        automatiques: [
          { type: 'bilan_semaine', envoyes: 9, perimes: 1, echecs: 0 },
          { type: 'bilan_jour', envoyes: 41, perimes: 2, echecs: 1 },
          { type: 'petits_rappels', envoyes: 12, perimes: 0, echecs: 0 },
        ].map((a) => (jours < 7 ? { ...a, envoyes: Math.ceil(a.envoyes / 4) } : a)),
      };
    },

    messages() {
      return {
        messages: [...messages.values()]
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .map((m) => structuredClone(m)),
      };
    },

    message_ecrire(params) {
      if (!UUID_RE.test(params.message_id || '')) throw refus('message_id', 'a uuid');
      const m = lireMessageInApp(params.message);
      if (params.parent_ids != null && params.toutes_les_familles) throw refus('parent_ids', 'absent with toutes_les_familles');
      if (params.parent_ids != null && (!Array.isArray(params.parent_ids) || !params.parent_ids.length || params.parent_ids.length > 200)) {
        throw refus('parent_ids', 'a list of 1 to 200 parent ids');
      }
      const avant = messages.get(params.message_id);
      const famillesAvant = avant ? avant.cible.familles : null;
      const familles = params.parent_ids ? new Set(params.parent_ids).size : params.toutes_les_familles ? null : famillesAvant;
      const now = maintenant().toISOString();
      const ecrit = {
        ...m, id: params.message_id, actif: avant ? avant.actif : false,
        cible: { ...m.cible, familles }, created_at: avant ? avant.created_at : now, updated_at: now,
      };
      messages.set(ecrit.id, ecrit);
      return { message: structuredClone(ecrit) };
    },

    message_activer(params) {
      if (!UUID_RE.test(params.message_id || '')) throw refus('message_id', 'a uuid');
      if (typeof params.actif !== 'boolean') throw refus('actif', 'a boolean');
      const m = messages.get(params.message_id);
      if (!m) return undefined;
      Object.assign(m, { actif: params.actif, updated_at: maintenant().toISOString() });
      return { message: structuredClone(m) };
    },
  };

  return actions;
}

// Les règles de `lireMessageInApp` et de la table, telles que le
// serveur les applique (le mock les vérifie lui-même, sans reprendre
// le code de l'écran : un oubli de l'écran se verrait au refus).
function lireMessageInApp(m) {
  if (!m || typeof m !== 'object') throw refus('message', 'an object');
  if (!estTexte(m.nom, 80)) throw refus('message.nom', 'a non-empty string of at most 80 characters');
  const format = m.format ?? 'feuille';
  const emplacement = m.emplacement ?? 'accueil_enfant';
  const declencheur = m.declencheur ?? 'prochaine_ouverture';
  if (!['feuille', 'plein_ecran'].includes(format)) throw refus('message.format', 'feuille or plein_ecran');
  if (!['accueil_enfant', 'espace_parent'].includes(emplacement)) throw refus('message.emplacement', 'accueil_enfant or espace_parent');
  if (!['prochaine_ouverture', 'nieme_entree_parent', 'fin_de_seance', 'ouverture_notif'].includes(declencheur)) {
    throw refus('message.declencheur', 'a known trigger');
  }
  const texte = (champ, max) => {
    const v = m[champ];
    if (v == null || v === '') return null;
    if (typeof v !== 'string' || v.length > max) throw refus('message.' + champ, 'a string of at most ' + max + ' characters');
    return v;
  };
  const r = {
    nom: m.nom, format, emplacement, declencheur, declencheur_n: m.declencheur_n ?? null,
    surtitre: texte('surtitre', 40), titre: texte('titre', 80), texte: texte('texte', 400),
    image_chemin: texte('image_chemin', 200), bouton_libelle: texte('bouton_libelle', 30),
    destination: m.destination ?? 'aucune', url: null,
    priorite: m.priorite ?? 0, max_affichages: m.max_affichages ?? 1,
    debut_at: lireDate(m.debut_at, 'message.debut_at'), fin_at: lireDate(m.fin_at, 'message.fin_at'),
  };
  const points = m.points ?? [];
  if (!Array.isArray(points) || points.length > 3 || points.some((p) => typeof p !== 'string' || !p.trim() || p.length > 120)) {
    throw refus('message.points', 'at most 3 strings of at most 120 characters');
  }
  r.points = points;
  if (r.image_chemin && /^[a-z]+:|^\/|\.\./i.test(r.image_chemin)) throw refus('message.image_chemin', 'a path in the image bucket');
  if (!DESTINATIONS.includes(r.destination)) throw refus('message.destination', 'one of the fixed destinations');
  if (r.destination === 'url') {
    if (!(typeof m.url === 'string' && URL_RE.test(m.url) && m.url.length <= 500)) throw refus('message.url', 'an https URL');
    r.url = m.url;
  }
  if (emplacement === 'accueil_enfant' && format !== 'feuille') throw refus('message.format', 'feuille on accueil_enfant');
  if (emplacement === 'accueil_enfant' && r.destination === 'url') throw refus('message.destination', 'not url on accueil_enfant');
  if (r.destination !== 'aucune' && !r.bouton_libelle) throw refus('message.bouton_libelle', 'present when destination is set');
  if ((declencheur === 'nieme_entree_parent') !== (r.declencheur_n != null)) {
    throw refus('message.declencheur_n', 'present exactly with nieme_entree_parent');
  }
  if (r.declencheur_n != null && (!entier(r.declencheur_n) || r.declencheur_n < 1)) throw refus('message.declencheur_n', 'an integer >= 1');
  if (declencheur === 'nieme_entree_parent' && emplacement !== 'espace_parent') throw refus('message.declencheur', 'nieme_entree_parent only in espace_parent');
  if (declencheur === 'fin_de_seance' && emplacement !== 'accueil_enfant') throw refus('message.declencheur', 'fin_de_seance only on accueil_enfant');
  if (format === 'feuille' && !r.texte) throw refus('message.texte', 'present for a feuille');
  if (format === 'plein_ecran' && !r.titre) throw refus('message.titre', 'present for a plein_ecran');
  if (!entier(r.priorite) || Math.abs(r.priorite) > 1000) throw refus('message.priorite', 'an integer between -1000 and 1000');
  if (!entier(r.max_affichages) || r.max_affichages < 1 || r.max_affichages > 100) throw refus('message.max_affichages', 'an integer between 1 and 100');
  if (r.debut_at && r.fin_at && r.fin_at <= r.debut_at) throw refus('message.fin_at', 'after debut_at');
  const { parent_ids: _ids, ...cible } = lireCible(m.cible, { familles: false, maxExclu: true });
  r.cible = cible;
  return r;
}
