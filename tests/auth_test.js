import { assertEquals } from 'jsr:@std/assert@1';
import { clesAuthASupprimer } from '../auth.js';

Deno.test('auth : nettoyage du localStorage — sessions Supabase et ancien mot de passe', () => {
  assertEquals(clesAuthASupprimer([
    'aristocles-pw',
    'sb-ngbqqewpkcugdwajpbff-auth-token',
    'sb-mtuqpdtihltuuyemdyni-auth-token',
    'aristocles-dashboard-auth-prod',
    'theme',
    'sb-autre-chose',
  ]), [
    'aristocles-pw',
    'sb-ngbqqewpkcugdwajpbff-auth-token',
    'sb-mtuqpdtihltuuyemdyni-auth-token',
    'aristocles-dashboard-auth-prod',
  ]);
});
