import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// Supabase's current server-side key is SUPABASE_SECRET_KEY (sb_secret_...).
// Keep SERVICE_ROLE as a backward-compatible fallback for older deployments.
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'avatars';

export const supabaseAdmin =
  supabaseUrl && secretKey
    ? createClient(supabaseUrl, secretKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

export function requireSupabase() {
  if (!supabaseAdmin) {
    const error = new Error('Supabase Storage is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY to the server environment.');
    error.statusCode = 500;
    throw error;
  }
  return supabaseAdmin;
}
