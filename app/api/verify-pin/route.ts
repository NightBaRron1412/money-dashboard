import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getStoredPinHash,
  verifyPin,
  checkLockout,
  recordFailedAttempt,
  resetFailedAttempts,
  generateSessionToken,
} from "@/lib/supabase-server";
import { PIN_LENGTH, SESSION_COOKIE } from "@/lib/money/constants";

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { pin } = body;

  if (!pin || typeof pin !== "string") {
    return NextResponse.json({ error: "PIN is required" }, { status: 400 });
  }

  if (pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) {
    return NextResponse.json(
      { error: `PIN must be exactly ${PIN_LENGTH} digits` },
      { status: 400 }
    );
  }

  const { locked, remainingSeconds } = await checkLockout();
  if (locked) {
    const mins = Math.ceil(remainingSeconds / 60);
    return NextResponse.json(
      { error: `Account locked. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` },
      { status: 429 }
    );
  }

  const storedHash = await getStoredPinHash();

  if (!storedHash) {
    return NextResponse.json(
      { error: "PIN not configured" },
      { status: 404 }
    );
  }

  const valid = await verifyPin(pin, storedHash);

  if (valid) {
    await resetFailedAttempts();
    const token = await generateSessionToken();
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return NextResponse.json({ ok: true });
  }

  const { attemptsLeft, locked: nowLocked } = await recordFailedAttempt();

  if (nowLocked) {
    return NextResponse.json(
      { error: "Too many failed attempts. Account locked for 15 minutes." },
      { status: 429 }
    );
  }

  return NextResponse.json(
    { error: `Wrong PIN. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.` },
    { status: 401 }
  );
}
