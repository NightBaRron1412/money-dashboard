import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  OWNER_ID,
  MAX_PIN_ATTEMPTS,
  LOCKOUT_MINUTES,
  SESSION_COOKIE,
} from "@/lib/money/constants";

/**
 * Server-side Supabase client for use in API routes.
 * Uses the server-only service role key. Browser traffic must use the
 * session-protected data gateway instead of connecting to Supabase directly.
 */
export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Server database credentials are not configured");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createSupabaseServerFetch(key) },
  });
}

/** New sb_secret keys authenticate with apikey only, not as bearer JWTs. */
export function createSupabaseServerFetch(
  key: string,
  transport: typeof fetch = fetch
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_secret_")) headers.delete("authorization");
    return transport(input, { ...init, headers });
  };
}

const BCRYPT_ROUNDS = 10;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

async function legacySha256Hash(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "_money_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isBcryptHash(hash: string): boolean {
  return hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$");
}

/**
 * Verify PIN against stored hash. Supports both legacy SHA-256 and bcrypt.
 * If a legacy hash matches, it is automatically upgraded to bcrypt in-place.
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(pin, hash);
  }

  const legacyHash = await legacySha256Hash(pin);
  const a = Buffer.from(legacyHash);
  const b = Buffer.from(hash);
  const { timingSafeEqual } = await import("node:crypto");
  if (a.length === b.length && timingSafeEqual(a, b)) {
    const bcryptHash = await hashPin(pin);
    await storePinHash(bcryptHash);
    return true;
  }

  return false;
}

/** Get the stored pin_hash from money_settings, or null if not set */
export async function getStoredPinHash(): Promise<string | null> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("money_settings")
    .select("pin_hash")
    .eq("user_id", OWNER_ID)
    .maybeSingle();
  return data?.pin_hash ?? null;
}

/** Store a pin hash (creates settings row if needed) */
export async function storePinHash(hash: string): Promise<void> {
  const supabase = getServerSupabase();
  const { data: existing } = await supabase
    .from("money_settings")
    .select("id")
    .eq("user_id", OWNER_ID)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("money_settings")
      .update({ pin_hash: hash })
      .eq("id", existing.id);
  } else {
    await supabase.from("money_settings").insert({
      user_id: OWNER_ID,
      pin_hash: hash,
    });
  }
}

/** Check if the account is locked due to failed attempts. */
export async function checkLockout(): Promise<{ locked: boolean; remainingSeconds: number }> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("money_settings")
    .select("failed_attempts, locked_until")
    .eq("user_id", OWNER_ID)
    .maybeSingle();

  if (!data) return { locked: false, remainingSeconds: 0 };

  if (data.locked_until) {
    const until = new Date(data.locked_until);
    const now = new Date();
    if (until > now) {
      return { locked: true, remainingSeconds: Math.ceil((until.getTime() - now.getTime()) / 1000) };
    }
  }

  return { locked: false, remainingSeconds: 0 };
}

/** Record a failed PIN attempt. Lock if threshold exceeded. Uses atomic increment. */
export async function recordFailedAttempt(): Promise<{ locked: boolean; attemptsLeft: number }> {
  const supabase = getServerSupabase();

  const { data: updated, error } = await supabase.rpc("money_increment_failed_attempts", {
    p_owner_id: OWNER_ID,
    p_max_attempts: MAX_PIN_ATTEMPTS,
    p_lockout_minutes: LOCKOUT_MINUTES,
  });

  if (error || !updated) {
    const { data } = await supabase
      .from("money_settings")
      .select("id, failed_attempts")
      .eq("user_id", OWNER_ID)
      .maybeSingle();

    if (!data) return { locked: false, attemptsLeft: MAX_PIN_ATTEMPTS };

    const newCount = (data.failed_attempts ?? 0) + 1;
    const updates: Record<string, unknown> = { failed_attempts: newCount };

    if (newCount >= MAX_PIN_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      updates.locked_until = lockUntil.toISOString();
    }

    await supabase
      .from("money_settings")
      .update(updates)
      .eq("id", data.id);

    return {
      locked: newCount >= MAX_PIN_ATTEMPTS,
      attemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - newCount),
    };
  }

  const newCount = updated.new_count ?? MAX_PIN_ATTEMPTS;
  return {
    locked: newCount >= MAX_PIN_ATTEMPTS,
    attemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - newCount),
  };
}

/** Reset failed attempts on successful login. */
export async function resetFailedAttempts(): Promise<void> {
  const supabase = getServerSupabase();
  await supabase
    .from("money_settings")
    .update({ failed_attempts: 0, locked_until: null })
    .eq("user_id", OWNER_ID);
}

const SESSION_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET env var is required. Generate one: openssl rand -base64 32"
    );
  }
  return secret;
}

export async function generateSessionToken(): Promise<string> {
  const secret = getSessionSecret();
  const payload = `${OWNER_ID}:${Date.now()}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${Buffer.from(payload).toString("base64")}.${sigHex}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secret = getSessionSecret();
    const [payloadB64, sigHex] = token.split(".");
    if (!payloadB64 || !sigHex) return false;

    const payload = Buffer.from(payloadB64, "base64").toString();

    const parts = payload.split(":");
    const timestamp = parseInt(parts[parts.length - 1], 10);
    const ownerId = parts.slice(0, -1).join(":");
    const age = Date.now() - timestamp;
    if (
      ownerId !== OWNER_ID ||
      isNaN(timestamp) ||
      age < -5 * 60 * 1000 ||
      age > SESSION_TOKEN_MAX_AGE_MS
    ) {
      return false;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = new Uint8Array(
      sigHex.match(/.{2}/g)!.map((h) => parseInt(h, 16))
    );
    return crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payload));
  } catch {
    return false;
  }
}

/** Require only the signed session, without an additional database lookup. */
export async function requireSession(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } }
    );
  }
  return null;
}

/**
 * Verify the caller has a valid session cookie. Returns null if authenticated,
 * or a 401 NextResponse to return immediately.
 */
export async function requireAuth(): Promise<NextResponse | null> {
  const sessionError = await requireSession();
  if (sessionError) return sessionError;
  const { locked } = await checkLockout();
  if (locked) {
    return NextResponse.json({ error: "Account locked" }, { status: 403 });
  }
  return null;
}

/** Verify a Vercel cron request using the configured bearer secret. */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
