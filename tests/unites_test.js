import { assertEquals } from 'jsr:@std/assert@1';
import { fmtDuree, fmtDureeSec, fmtEuros, isoJoursAvant } from '../ui/format.js';
import { adapterLlm, coutAffiche, fmtVolume, volumesRole } from '../ui/unites.js';

const NB = ' ';

Deno.test('format : coût null ou absent → « inconnu », jamais 0 €', () => {
  assertEquals(fmtEuros(null), 'inconnu');
  assertEquals(fmtEuros(undefined), 'inconnu');
  assertEquals(fmtEuros(0), '0,00' + NB + '€');
  assertEquals(fmtEuros(3.4162), '3,4162' + NB + '€');
  assertEquals(fmtEuros(1234.5), '1' + NB + '234,50' + NB + '€');
});

Deno.test('format : durées', () => {
  assertEquals(fmtDuree(null), 'En cours');
  assertEquals(fmtDuree(45), '45 min');
  assertEquals(fmtDuree(125), '2 h 05');
  assertEquals(fmtDureeSec(42), '42 s');
  assertEquals(fmtDureeSec(750), '12 min 30 s');
  assertEquals(fmtDureeSec(3720), '1 h 02');
});

Deno.test('format : veille = hier en date locale', () => {
  assertEquals(isoJoursAvant(1, new Date(2026, 8, 16, 0, 30)), '2026-09-15');
  assertEquals(isoJoursAvant(1, new Date(2026, 2, 1, 23, 59)), '2026-02-28');
});

Deno.test('unités : stt en secondes, tts en caractères, jamais en tokens', () => {
  assertEquals(fmtVolume(750, 'seconde'), '12 min 30 s d’audio');
  assertEquals(fmtVolume(24000, 'caractere'), '24' + NB + '000 caractères');
  assertEquals(fmtVolume(1, 'caractere'), '1 caractère');
  assertEquals(fmtVolume(1204500, 'token'), '1' + NB + '204' + NB + '500 tokens');
  assertEquals(fmtVolume(12, 'pixel'), '12 pixel');
  assertEquals(volumesRole({ unite: 'seconde', tokensEntree: 90, tokensSortie: 0 }),
    { entree: '1 min 30 s d’audio', sortie: '—' });
  assertEquals(volumesRole({ unite: 'token', tokensEntree: 10, tokensSortie: 1 }),
    { entree: '10 tokens', sortie: '1 token' });
});

const LLM_V1 = {
  cout_total_eur: 0.014,
  appels: 3,
  tokens_input: 100,
  tokens_output: 50,
  volumes_hors_tokens: [
    { unite: 'caractere', total: 240, appels: 1 },
    { unite: 'seconde', total: 12, appels: 1 },
  ],
  par_role: [
    { role: 'tutor', unite: 'token', cout_eur: 0.01, appels: 1, tokens_input: 100, tokens_output: 50 },
    { role: 'tts', unite: 'caractere', cout_eur: 0.003, appels: 1, tokens_input: 240, tokens_output: 0 },
    { role: 'stt', unite: 'seconde', cout_eur: 0.001, appels: 1, tokens_input: 12, tokens_output: 0 },
  ],
};

Deno.test('coûts : contrat actuel (champs coût inconnu absents) → pas d’annotation', () => {
  const llm = adapterLlm(LLM_V1);
  assertEquals(coutAffiche(llm), { valeur: '0,014' + NB + '€', note: null });
  assertEquals(llm.volumesHorsTokens.map((v) => fmtVolume(v.total, v.unite)),
    ['240 caractères', '12 s d’audio']);
  assertEquals(llm.parRole.map((r) => [r.role, r.unite, coutAffiche(r).note]),
    [['tutor', 'token', null], ['tts', 'caractere', null], ['stt', 'seconde', null]]);
});

Deno.test('coûts : contrat v2 (cout_eur null, appels_cout_inconnu) → « inconnu » et total annoté', () => {
  const llm = adapterLlm({
    ...LLM_V1,
    appels_cout_inconnu: 3,
    par_role: [
      { ...LLM_V1.par_role[0], appels_cout_inconnu: 1 },
      { ...LLM_V1.par_role[1], cout_eur: null, appels_cout_inconnu: 2 },
    ],
  });
  assertEquals(coutAffiche(llm), { valeur: '0,014' + NB + '€', note: 'dont 3 appels au coût inconnu' });
  assertEquals(coutAffiche(llm.parRole[0]).note, 'dont 1 appel au coût inconnu');
  assertEquals(coutAffiche(llm.parRole[1]), { valeur: 'inconnu', note: 'dont 2 appels au coût inconnu' });
  assertEquals(llm.parRole[1].eur, null); // null reste null, pas 0
});

Deno.test('coûts : total null → inconnu ; bloc absent → null', () => {
  assertEquals(coutAffiche(adapterLlm({ cout_total_eur: null })).valeur, 'inconnu');
  assertEquals(adapterLlm(null), null);
});
