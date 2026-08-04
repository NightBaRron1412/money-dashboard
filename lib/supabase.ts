import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function createDataProxyFetch(transport: typeof fetch = fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const original = new Request(input, init);
    const target = new URL(original.url);
    const proxyUrl = `/api/data${target.pathname}${target.search}`;
    const headers = new Headers(original.headers);

    headers.delete("apikey");
    headers.delete("authorization");
    headers.set("x-money-csrf", "1");

    return transport(proxyUrl, {
      method: original.method,
      headers,
      body: ["GET", "HEAD"].includes(original.method)
        ? undefined
        : await original.arrayBuffer(),
      credentials: "same-origin",
      cache: "no-store",
      signal: original.signal,
    });
  };
}

export function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    return null;
  }

  _supabase = createClient(url, "proxy-only-client", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: createDataProxyFetch() },
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
