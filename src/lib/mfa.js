/* ============================================================
   mfa.js — autenticación de doble factor (TOTP) con Supabase.
   Compatible con Google Authenticator, Authy, 1Password, etc.
   ============================================================ */
import { supabase } from './supabase.js';

/** Nivel de garantía actual y siguiente: { currentLevel, nextLevel }. */
export async function getAAL() {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data || {};
}

/** Factores TOTP ya verificados del usuario. */
export async function listVerifiedFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return [];
  return (data?.totp || []).filter(f => f.status === 'verified');
}

/** Inicia el alta de un factor → devuelve { id, totp:{ qr_code, secret, uri } }. */
export async function enrollTotp() {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'TAMA ' + new Date().toISOString().slice(0, 10)
  });
  if (error) throw error;
  return data;
}

/** Verifica un código de 6 dígitos contra un factor (alta o login). */
export async function verifyCode(factorId, code) {
  const ch = await supabase.auth.mfa.challenge({ factorId });
  if (ch.error) throw ch.error;
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.data.id, code });
  if (error) throw error;
}

/** Da de baja un factor TOTP. */
export async function unenroll(factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
