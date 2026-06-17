/* ============================================================
   issuer.js — datos del emisor (TAMA) para PDFs de presupuestos,
   facturas e informes. Se guardan en este dispositivo (localStorage),
   compartiendo la misma clave que el módulo de Facturas.
   ============================================================ */
const KEY = 'tama_invoice_issuer';
const DEFAULT = { name: 'TAMA Studios', tax_id: '', address: '', email: '', phone: '', iban: '' };

export function getIssuer() {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULT }; }
}
export function setIssuer(o) { localStorage.setItem(KEY, JSON.stringify(o)); }
