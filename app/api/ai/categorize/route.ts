import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireAuth } from "@/lib/supabase-server";
import { OWNER_ID } from "@/lib/money/constants";
import { isGeminiConfigured, generateJSON } from "@/lib/money/ai";

export async function POST(request: NextRequest) {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  try {
    const { merchant, notes, categories } = await request.json();
    if (!merchant || typeof merchant !== "string") {
      return NextResponse.json({ error: "merchant is required" }, { status: 400 });
    }
    const itemDescription = typeof notes === "string" ? notes.trim() : "";

    const supabase = getServerSupabase();

    // Primary: pattern match from past transactions
    const { data: pastTxs } = await supabase
      .from("money_transactions")
      .select("category")
      .eq("user_id", OWNER_ID)
      .eq("type", "expense")
      .ilike("merchant", `%${merchant.trim()}%`)
      .not("category", "is", null)
      .limit(20);

    if (pastTxs && pastTxs.length > 0) {
      const freq: Record<string, number> = {};
      for (const t of pastTxs) {
        if (t.category) freq[t.category] = (freq[t.category] ?? 0) + 1;
      }
      const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
      if (best) {
        return NextResponse.json({ category: best[0], source: "history", confidence: Math.min(100, best[1] * 20) });
      }
    }

    // Also check CC charges
    const { data: pastCharges } = await supabase
      .from("money_credit_card_charges")
      .select("category")
      .eq("user_id", OWNER_ID)
      .ilike("merchant", `%${merchant.trim()}%`)
      .not("category", "is", null)
      .limit(20);

    if (pastCharges && pastCharges.length > 0) {
      const freq: Record<string, number> = {};
      for (const c of pastCharges) {
        if (c.category) freq[c.category] = (freq[c.category] ?? 0) + 1;
      }
      const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
      if (best) {
        return NextResponse.json({ category: best[0], source: "history", confidence: Math.min(100, best[1] * 20) });
      }
    }

    // Fallback: Gemini
    if (!isGeminiConfigured()) {
      return NextResponse.json({ category: null, source: "none" });
    }

    const categoryList = Array.isArray(categories) && categories.length > 0
      ? categories
      : ["Food", "Transport", "Bills", "Rent", "Fun", "Health", "Shopping", "Other"];

    const result = await generateJSON<{ category: string }>(
      `You are a transaction categorizer. Given a merchant name, an optional item description, and a list of categories, return the most likely category as JSON: {"category": "..."}. The item description is MORE important than the merchant name for choosing the category. Only use categories from the provided list.`,
      `Merchant: "${merchant.trim()}"${itemDescription ? `\nItem/Description: "${itemDescription}"` : ""}\nCategories: ${categoryList.join(", ")}`
    );

    const suggested = categoryList.includes(result.category) ? result.category : "Other";
    return NextResponse.json({ category: suggested, source: "ai", confidence: 70 });
  } catch {
    return NextResponse.json({ category: null, source: "error" });
  }
}
