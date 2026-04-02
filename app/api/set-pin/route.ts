import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  hashPin,
  getStoredPinHash,
  verifyPin,
  storePinHash,
  generateSessionToken,
  checkLockout,
  recordFailedAttempt,
} from "@/lib/supabase-server";
import { PIN_LENGTH, SESSION_COOKIE } from "@/lib/money/constants";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { pin, currentPin } = body;

  if (!pin || typeof pin !== "string" || pin.length !== PIN_LENGTH) {
    return NextResponse.json(
      { error: `PIN must be exactly ${PIN_LENGTH} digits` },
      { status: 400 }
    );
  }

  if (!/^\d+$/.test(pin)) {
    return NextResponse.json(
      { error: "PIN must be numbers only" },
      { status: 400 }
    );
  }

  const existingHash = await getStoredPinHash();

  if (existingHash) {
    if (!currentPin || typeof currentPin !== "string") {
      return NextResponse.json(
        { error: "Current PIN is required" },
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

    const valid = await verifyPin(currentPin, existingHash);
    if (!valid) {
      await recordFailedAttempt();
      return NextResponse.json(
        { error: "Current PIN is incorrect" },
        { status: 401 }
      );
    }
  }

  const newHash = await hashPin(pin);
  await storePinHash(newHash);

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
