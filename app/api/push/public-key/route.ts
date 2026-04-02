import { NextResponse } from "next/server";
import { getPublicVapidKey } from "@/lib/money/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const publicKey = getPublicVapidKey();
    return NextResponse.json({ publicKey });
  } catch {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 });
  }
}
