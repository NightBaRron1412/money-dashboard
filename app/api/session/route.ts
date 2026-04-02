import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, getStoredPinHash } from "@/lib/supabase-server";
import { SESSION_COOKIE } from "@/lib/money/constants";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  const [valid, pinHash] = await Promise.all([
    token ? verifySessionToken(token) : Promise.resolve(false),
    getStoredPinHash(),
  ]);

  return NextResponse.json({ authenticated: valid, pinExists: !!pinHash });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
