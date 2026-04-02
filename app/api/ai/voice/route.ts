import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireAuth } from "@/lib/supabase-server";
import { OWNER_ID } from "@/lib/money/constants";
import { isGeminiConfigured, requireGeminiKey } from "@/lib/money/ai";
import type { CurrencyCode, ParsedVoiceTransaction } from "@/lib/money/database.types";

export const maxDuration = 30;

const AUDIO_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
const MAX_RETRIES = 2;

export async function POST(request: NextRequest) {
  const authErr = await requireAuth();
  if (authErr) return authErr;

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "AI not configured. Set GEMINI_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: "audio file is required" }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    if (arrayBuffer.byteLength < 1000) {
      return NextResponse.json({ error: "Recording too short. Please speak for at least a second." }, { status: 400 });
    }
    if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio file too large (max 10MB)." }, { status: 413 });
    }
    const mimeType = audioFile.type || "audio/webm";
    const ALLOWED_AUDIO = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a"];
    if (!ALLOWED_AUDIO.some((t) => mimeType.startsWith(t))) {
      return NextResponse.json({ error: "Unsupported audio format." }, { status: 415 });
    }
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");

    const supabase = getServerSupabase();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90);
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

    const [accountRes, settingsRes, ccRes, subRes, recentTxRes, recurringTxRes] = await Promise.all([
      supabase.from("money_accounts").select("id, name, type, currency").eq("user_id", OWNER_ID),
      supabase.from("money_settings").select("base_currency, display_name, expense_categories, subscription_categories, rent_amount, rent_day, monthly_essentials_budget, paycheck_amount, paycheck_frequency").eq("user_id", OWNER_ID).single(),
      supabase.from("money_credit_cards").select("id, name, currency").eq("user_id", OWNER_ID),
      supabase.from("money_subscriptions").select("name, amount, currency, frequency, category, is_active").eq("user_id", OWNER_ID).eq("is_active", true),
      supabase.from("money_transactions").select("type, amount, currency, category, merchant, account_id").eq("user_id", OWNER_ID).gte("date", cutoff).order("date", { ascending: false }).limit(500),
      supabase.from("money_transactions").select("type, amount, currency, category, merchant, account_id, recurrence").eq("user_id", OWNER_ID).eq("is_recurring", true).order("date", { ascending: false }).limit(50),
    ]);

    const accounts = accountRes.data ?? [];
    const settings = settingsRes.data;
    const creditCards = ccRes.data ?? [];
    const subscriptions = subRes.data ?? [];
    const recentTxs = recentTxRes.data ?? [];
    const recurringTxs = recurringTxRes.data ?? [];
    const baseCurrency: CurrencyCode = (settings?.base_currency as CurrencyCode) ?? "CAD";
    const categories: string[] = settings?.expense_categories?.length
      ? settings.expense_categories
      : ["Bills", "Food", "Fun", "Health", "Personal Care", "Rent", "Transport", "Other"];
    const incomeSources = ["Paycheck", "Stocks", "Bonus", "Freelance", "Dividends", "Refund", "Gift", "Other"];

    // Build merchant -> category mapping from recent transactions
    const merchantCategories: Record<string, { category: string; count: number }> = {};
    for (const tx of recentTxs) {
      if (tx.type === "expense" && tx.merchant && tx.category) {
        const key = tx.merchant;
        if (!merchantCategories[key]) merchantCategories[key] = { category: tx.category, count: 0 };
        merchantCategories[key].count++;
      }
    }
    const topMerchants = Object.entries(merchantCategories)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([name, { category }]) => `"${name}" → ${category}`);

    // Build income pattern: which accounts typically receive income
    const incomeAccounts: Record<string, number> = {};
    for (const tx of recentTxs) {
      if (tx.type === "income" && tx.account_id) {
        incomeAccounts[tx.account_id] = (incomeAccounts[tx.account_id] ?? 0) + 1;
      }
    }
    const primaryIncomeAccountId = Object.entries(incomeAccounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const primaryIncomeAccount = accounts.find((a) => a.id === primaryIncomeAccountId);

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

    const systemPrompt = `You are a voice transaction parser for a personal finance app. The user will speak in English or Arabic (or a mix). Your job is to extract structured transaction data from the audio.

Today's date: ${today}
User's name: ${settings?.display_name || "Unknown"}
User's default currency: ${baseCurrency}
Available currencies: CAD, USD, EGP

=== USER'S BANK ACCOUNTS ===
${accounts.map((a) => `- "${a.name}" (${a.type}, ${a.currency})`).join("\n")}

=== USER'S CREDIT CARDS ===
${creditCards.map((c) => `- "${c.name}" (${c.currency})`).join("\n") || "None"}

=== PAYCHECK INFO ===
Amount: ${settings?.paycheck_amount ?? "unknown"}
Frequency: ${settings?.paycheck_frequency ?? "unknown"}
${primaryIncomeAccount ? `Usually deposited to: "${primaryIncomeAccount.name}" (${primaryIncomeAccount.currency})` : "Deposit account: unknown"}

=== RENT INFO ===
Amount: ${settings?.rent_amount ?? "unknown"}
Due day: ${settings?.rent_day ?? "unknown"} of each month
Monthly budget: ${settings?.monthly_essentials_budget ?? "unknown"}

=== ACTIVE SUBSCRIPTIONS ===
${subscriptions.length > 0 ? subscriptions.map((s) => `- "${s.name}": ${s.amount} ${s.currency} ${s.frequency}${s.category ? ` (${s.category})` : ""}`).join("\n") : "None"}

=== RECURRING TRANSACTIONS ===
${(() => {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const tx of recurringTxs) {
    const key = `${tx.type}|${tx.merchant || tx.category || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = tx.merchant || tx.category || "Unknown";
    const acct = accounts.find((a) => a.id === tx.account_id);
    items.push(`- ${tx.type}: "${label}" ${tx.amount} ${tx.currency} ${tx.recurrence}${acct ? `, account "${acct.name}"` : ""}${tx.category ? `, category "${tx.category}"` : ""}`);
  }
  return items.length > 0 ? items.join("\n") : "None";
})()}

=== KNOWN MERCHANTS & THEIR CATEGORIES ===
${topMerchants.length > 0 ? topMerchants.join("\n") : "No history yet"}

=== EXPENSE CATEGORIES ===
${categories.join(", ")}

=== INCOME SOURCES ===
${incomeSources.join(", ")}

Rules:
- Determine if this is an expense, income, or transfer.
- For expenses: extract amount, currency, category, merchant, date, and which account/card was used.
- For income: extract amount, currency, source (put in category field), date, and which account received it.
- For transfers: extract amount, from_account_name, to_account_name, and date.
- PAYCHECK SHORTCUT: If the user just says "paycheck" or "مرتب" or "salary" without specifying an amount, use the paycheck amount (${settings?.paycheck_amount ?? "unknown"}) and deposit to the usual income account${primaryIncomeAccount ? ` ("${primaryIncomeAccount.name}")` : ""}. Set type to "income", category to "Paycheck", is_recurring to true, recurrence to "${settings?.paycheck_frequency ?? "bi-weekly"}".
- RENT SHORTCUT: If the user says "rent" or "إيجار" without an amount, use ${settings?.rent_amount ?? "unknown"}. Set category to "Rent", is_recurring to true, recurrence to "monthly".
- SUBSCRIPTION: If the user mentions a known subscription name, use its amount and category from the list above.
- RECURRING MATCH: If the user mentions something that matches a known recurring transaction (by merchant or category name), use its amount, currency, category, account, and recurrence. Set is_recurring to true.
- MERCHANT MATCHING: If the user mentions a merchant that matches a known merchant above, auto-assign the category that merchant is usually filed under.
- If the user says a currency explicitly (dollars, جنيه/pounds, etc.), use that. Otherwise use the account's currency, or default to ${baseCurrency}.
- "جنيه" or "pounds" in Arabic context means EGP. "دولار" means USD.
- If the user mentions a date (yesterday, last Friday, etc.), compute the actual date relative to today (${today}).
- If no date is mentioned, use null (the app will default to today).
- Match account/card names fuzzily to the user's actual accounts listed above.
- Match categories fuzzily to the available categories listed above.
- Set confidence from 0.0 to 1.0 based on how sure you are about the overall parse.
- List any fields you're uncertain about in unclear_fields.
- Always include a transcript of what the user said.
- If the audio is unclear or not finance-related, set confidence to 0 and transcript to what you heard.

Respond ONLY with valid JSON matching this schema:
{
  "type": "expense" | "income" | "transfer",
  "amount": number | null,
  "currency": "CAD" | "USD" | "EGP" | null,
  "category": string | null,
  "merchant": string | null,
  "date": "YYYY-MM-DD" | null,
  "account_name": string | null,
  "from_account_name": string | null,
  "to_account_name": string | null,
  "credit_card_name": string | null,
  "notes": string | null,
  "is_recurring": boolean,
  "recurrence": "weekly" | "bi-weekly" | "monthly" | "yearly" | null,
  "transcript": string,
  "confidence": number,
  "unclear_fields": string[]
}`;

    const genAI = requireGeminiKey();

    let lastErr: unknown;
    let result: ParsedVoiceTransaction | null = null;

    for (const modelName of AUDIO_MODELS) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
            generationConfig: { responseMimeType: "application/json" },
          });

          const response = await model.generateContent([
            { inlineData: { mimeType, data: audioBase64 } },
            { text: "Parse this voice recording and extract the financial transaction details." },
          ]);

          const text = response.response.text();
          result = JSON.parse(text) as ParsedVoiceTransaction;
          break;
        } catch (err: unknown) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          const is429 = msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("quota");
          const is404 = msg.includes("404") || msg.includes("not found") || msg.includes("not supported");
          if (is404) break;
          if (is429 && attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
            continue;
          }
          if (is429) break;
          throw err;
        }
      }
      if (result) break;
    }

    if (!result) {
      throw lastErr ?? new Error("All models failed");
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Voice parse error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("quota")) {
      return NextResponse.json(
        { error: "Rate limit reached — please wait a moment and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Failed to parse voice recording. Please try again." },
      { status: 500 }
    );
  }
}
