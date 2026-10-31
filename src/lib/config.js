/**
 * Läser Supabase-URL från en given env-källa och kastar tydligt fel om den saknas.
 * Ingen hårdkodad fallback – förhindrar tysta anrop mot fel projekt.
 */
export function getSupabaseUrl(env) {
  const url = env?.VITE_SUPABASE_URL;
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('VITE_SUPABASE_URL saknas. Kontrollera miljökonfigurationen.');
  }
  return url.trim().replace(/\/+$/, '');
}
