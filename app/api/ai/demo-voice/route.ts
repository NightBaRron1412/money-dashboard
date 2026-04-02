import { NextRequest, NextResponse } from "next/server";
import { isGeminiConfigured, requireGeminiKey } from "@/lib/money/ai";
import { checkDemoRateLimit } from "@/lib/money/demo-rate-limit";
import { getDemoMoneyData } from "../../../hooks/demo-data";
import type { CurrencyCode, ParsedVoiceTransaction } from "@/lib/money/database.types";

export const maxDuration = 30;

const AUDIO_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
const MAX_RETRIES = 2;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, remaining, resetIn } = checkDemoRateLimit(ip);

  if (!allowed) {
    const minutes = Math.ceil(resetIn / 60000);
    return NextResponse.json(
      { error: `Demo limit reached (10/hour). Try again in ~${minutes} min.` },
      {
        status: 429,
        headers: { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": String(Math.ceil(resetIn / 1000)) },
      }
    );
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "AI not configured. Voice feature unavailable in demo right now." },
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

    const demo = getDemoMoneyData();
    const accounts = demo.accounts;
    const settings = demo.settings;
    const creditCards = demo.creditCards;
    const subscriptions = demo.subscriptions;
    const transactions = demo.transactions;

    const baseCurrency: CurrencyCode = (settings?.base_currency as CurrencyCode) ?? "CAD";
    const categories: string[] = settings?.expense_categories?.length
      ? settings.expense_categories
      : ["Bills", "Food", "Fun", "Health", "Personal Care", "Rent", "Transport", "Other"];
    const incomeSources = ["Paycheck", "Stocks", "Bonus", "Freelance", "Dividends", "Refund", "Gift", "Other"];

    const merchantCategories: Record<string, { category: string; count: number }> = {};
    for (const tx of transactions) {
      if (tx.type === "expense" && tx.merchant && tx.category) {
        if (!merchantCategories[tx.merchant]) merchantCategories[tx.merchant] = { category: tx.category, count: 0 };
        merchantCategories[tx.merchant].count++;
      }
    }
    const topMerchants = Object.entries(merchantCategories)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([name, { category }]) => `"${name}" → ${category}`);

    const incomeAccounts: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.type === "income" && tx.account_id) {
        incomeAccounts[tx.account_id] = (incomeAccounts[tx.account_id] ?? 0) + 1;
      }
    }
    const primaryIncomeAccountId = Object.entries(incomeAccounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const primaryIncomeAccount = accounts.find((a) => a.id === primaryIncomeAccountId);

    const recurringTxs = transactions.filter((t) => t.is_recurring);
    const seenRecurring = new Set<string>();
    const recurringItems: string[] = [];
    for (const tx of recurringTxs) {
      const key = `${tx.type}|${tx.merchant || tx.category || ""}`;
      if (seenRecurring.has(key)) continue;
      seenRecurring.add(key);
      const label = tx.merchant || tx.category || "Unknown";
      const acct = accounts.find((a) => a.id === tx.account_id);
      recurringItems.push(`- ${tx.type}: "${label}" ${tx.amount} ${tx.currency} ${tx.recurrence}${acct ? `, account "${acct.name}"` : ""}${tx.category ? `, category "${tx.category}"` : ""}`);
    }

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

    const systemPrompt = `You are a voice transaction parser for a personal finance app. The user will speak in English or Arabic (or a mix). Your job is to extract structured transaction data from the audio.

Today's date: ${today}
User's name: ${settings?.display_name || "Demo User"}
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

=== ACTIVE SUBSCRIPTIONS ===
${subscriptions.filter((s) => s.is_active).map((s) => `- "${s.name}": ${s.amount} ${s.currency} ${s.frequency}${s.category ? ` (${s.category})` : ""}`).join("\n") || "None"}

=== RECURRING TRANSACTIONS ===
${recurringItems.length > 0 ? recurringItems.join("\n") : "None"}

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

    return NextResponse.json(result, {
      headers: { "X-RateLimit-Remaining": String(remaining) },
    });
  } catch (err) {
    console.error("Demo voice parse error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("quota")) {
      return NextResponse.json(
        { error: "AI service busy — please wait and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Failed to parse voice recording. Please try again." },
      { status: 500 }
    );
  }
}
