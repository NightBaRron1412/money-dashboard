import { NextRequest, NextResponse } from "next/server";
import { fetchYahooQuotes } from "@/lib/money/yahoo-finance";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const MAX_SYMBOLS = 25;

export async function GET(req: NextRequest) {

  const symbolsParam = req.nextUrl.searchParams.get("symbols");
  if (!symbolsParam) {
    return NextResponse.json(
      { error: "symbols query param required" },
      { status: 400 }
    );
  }

  const symbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_SYMBOLS);

  try {
    const results = await fetchYahooQuotes(symbols);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: {} });
  }
}
