import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
  );
}

export function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!url || !key) {
    return null;
  }

  _supabase = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return _supabase;
}

/** Convenience accessor – only call from client-side code. Throws if not configured. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      throw new Error("Supabase is not configured");
    }
    return (client as any)[prop];
  },
});
