import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'avatars';

export const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

export function requireSupabase() {
  if (!supabaseAdmin) {
    const error = new Error('Supabase Storage is not configured.');
    error.statusCode = 500;
    throw error;
  }
  return supabaseAdmin;
}
