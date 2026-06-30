import { createClient } from '@supabase/supabase-js';

export type SupabaseEnv = 'test' | 'prod';

function getSupabaseConfig(mode: SupabaseEnv) {
  const config =
    mode === 'prod'
      ? {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL_PROD,
          supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD,
        }
      : {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        };

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error(`Supabase ${mode} env is missing.`);
  }

  return config;
}

function getSupabaseAdminConfig(mode: SupabaseEnv) {
  const config =
    mode === 'prod'
      ? {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL_PROD,
          serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY_PROD,
        }
      : {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        };

  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new Error(`Supabase admin ${mode} env is missing.`);
  }

  return config;
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
