import { assertEquals } from 'jsr:@std/assert@1';
import { fmtEchecs, fmtLatence, regrouperVersions, totalErreurs, totalIncidents, totauxPlateformes, volumesIa } from '../ui/sante.js';
import { libelleCloture } from '../ui/libelles.js';

const NB = '\u00a0';

Deno.test('santé : latences et échecs', () => {
  assertEquals(fmtLatence(null), '—');
  assertEquals(fmtLatence(640), '640 ms');
  assertEquals(fmtLatence(1400), '1,4 s');
  assertEquals(fmtLatence(12400), '12 s');
  assertEquals(fmtEchecs(0, 10), '0');
  assertEquals(fmtEchecs(1, 442), '1 (0,2 %)');
  assertEquals(fmtEchecs(3, 12), '3 (25 %)');
});

Deno.test('santé : volumes IA dans l’unité du rôle, jamais « tokens » pour stt/tts', () => {
  assertEquals(volumesIa({ unite: 'token', volumeEntree: 900, volumeSortie: 150 }), { entree: '900 tokens', sortie: '150 tokens' });
  assertEquals(volumesIa({ unite: 'seconde', volumeEntree: 90, volumeSortie: 0 }), { entree: '1 min 30 s d’audio', sortie: '—' });
  assertEquals(volumesIa({ unite: 'caractere', volumeEntree: 4440, volumeSortie: 0 }), { entree: '4' + NB + '440 caractères', sortie: '—' });
});

Deno.test('santé : versions regroupées par version d’app, plateformes totalisées', () => {
  const versions = [
    { version: '1.4.0', build: 142, plateforme: 'ios', enfants: 2, lancements: 13, dernierVu: '2026-09-16T16:40:00Z' },
    { version: '1.3.2', build: 131, plateforme: 'ios', enfants: 1, lancements: 6, dernierVu: '2026-09-12T18:15:00Z' },
    { version: '1.4.0', build: 141, plateforme: 'android', enfants: 1, lancements: 3, dernierVu: '2026-09-15T07:52:00Z' },
  ];
  assertEquals(regrouperVersions(versions), [
    { version: '1.4.0', builds: [141, 142], plateformes: ['Android', 'iOS'], lancements: 16, enfantsMin: 2, dernierVu: '2026-09-16T16:40:00Z' },
    { version: '1.3.2', builds: [131], plateformes: ['iOS'], lancements: 6, enfantsMin: 1, dernierVu: '2026-09-12T18:15:00Z' },
  ]);
  assertEquals(totauxPlateformes(versions), [{ plateforme: 'iOS', lancements: 19 }, { plateforme: 'Android', lancements: 3 }]);
});

Deno.test('santé : totaux d’erreurs et d’incidents ; libellés de clôture', () => {
  assertEquals(totalErreurs([{ nb: 2 }, { nb: 1 }]), 3);
  assertEquals(totalIncidents({ parType: [{ type: 'tour_erreur', nb: 2 }, { type: 'tour_anomalie', nb: 0 }] }), 2);
  assertEquals(totalIncidents(null), 0);
  assertEquals(libelleCloture('archivee', { motif: 'menage_complet' }).label, 'Clôturée');
  assertEquals(libelleCloture('active', { soldee_at: null, motif: null }).label, 'En cours');
  assertEquals(libelleCloture('archivee', null).label, 'Non soldée');
});
