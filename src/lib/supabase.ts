import { createClient } from '@supabase/supabase-js';

export type SupabaseEnv = 'test' | 'prod';

function getSupabaseConfig(mode: SupabaseEnv): { supabaseUrl: string; supabaseAnonKey: string } {
  const supabaseUrl =
    mode === 'prod' ? process.env.NEXT_PUBLIC_SUPABASE_URL_PROD : process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    mode === 'prod' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(`Supabase ${mode} env is missing.`);
  }

  return { supabaseUrl, supabaseAnonKey };
}

function getSupabaseAdminConfig(mode: SupabaseEnv): { supabaseUrl: string; serviceRoleKey: string } {
  const supabaseUrl =
    mode === 'prod' ? process.env.NEXT_PUBLIC_SUPABASE_URL_PROD : process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    mode === 'prod' ? process.env.SUPABASE_SERVICE_ROLE_KEY_PROD : process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(`Supabase admin ${mode} env is missing.`);
  }

  return { supabaseUrl, serviceRoleKey };
}

export function getSupabaseBrowser(mode: SupabaseEnv = 'test') {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig(mode);

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function getSupabaseAuth(mode: SupabaseEnv = 'test') {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig(mode);

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseAdmin(mode: SupabaseEnv = 'test') {
  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig(mode);

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
