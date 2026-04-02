import type { Transaction, Subscription, CreditCardCharge } from "./database.types";

export interface DetectedSubscription {
  merchant: string;
  avgAmount: number;
  frequency: "weekly" | "bi-weekly" | "monthly" | "yearly";
  occurrences: number;
  lastDate: string;
  confidence: number; // 0–100
  currency: string;
}

function normalizeMerchant(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function inferFrequency(
  avgDaysBetween: number
): "weekly" | "bi-weekly" | "monthly" | "yearly" | null {
  if (avgDaysBetween >= 5 && avgDaysBetween <= 9) return "weekly";
  if (avgDaysBetween >= 12 && avgDaysBetween <= 18) return "bi-weekly";
  if (avgDaysBetween >= 25 && avgDaysBetween <= 38) return "monthly";
  if (avgDaysBetween >= 340 && avgDaysBetween <= 395) return "yearly";
  return null;
}

export function detectSubscriptions(
  transactions: Transaction[],
  charges: CreditCardCharge[],
  existingSubscriptions: Subscription[]
): DetectedSubscription[] {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoff = sixMonthsAgo.toISOString().slice(0, 10);

  const existingNormalized = new Set(
    existingSubscriptions.map((s) => normalizeMerchant(s.name))
  );

  // Combine transactions and CC charges into a unified list
  interface Entry {
    merchant: string;
    normalizedMerchant: string;
    amount: number;
    date: string;
    currency: string;
  }

  const entries: Entry[] = [];

  for (const t of transactions) {
    if (t.date < cutoff || !t.merchant || t.type !== "expense") continue;
    entries.push({
      merchant: t.merchant,
      normalizedMerchant: normalizeMerchant(t.merchant),
      amount: t.amount,
      date: t.date,
      currency: t.currency,
    });
  }

  for (const c of charges) {
    if (c.date < cutoff || !c.merchant) continue;
    entries.push({
      merchant: c.merchant,
      normalizedMerchant: normalizeMerchant(c.merchant),
      amount: c.amount,
      date: c.date,
      currency: "CAD", // CC charges don't have currency, default to CAD
    });
  }

  // Group by normalized merchant
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = e.normalizedMerchant;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  const detected: DetectedSubscription[] = [];

  for (const [normalizedName, group] of groups) {
    if (group.length < 2) continue;
    if (existingNormalized.has(normalizedName)) continue;

    group.sort((a, b) => a.date.localeCompare(b.date));

    // Check amount consistency (within 10% of median)
    const amounts = group.map((e) => e.amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const consistent = group.every(
      (e) => Math.abs(e.amount - median) / median <= 0.1
    );
    if (!consistent) continue;

    // Check interval consistency
    const intervals: number[] = [];
    for (let i = 1; i < group.length; i++) {
      const d1 = new Date(group[i - 1].date);
      const d2 = new Date(group[i].date);
      intervals.push(
        Math.round((d2.getTime() - d1.getTime()) / 86400000)
      );
    }

    const avgInterval =
      intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const frequency = inferFrequency(avgInterval);
    if (!frequency) continue;

    // Compute confidence
    const intervalVariance =
      intervals.reduce((s, v) => s + Math.pow(v - avgInterval, 2), 0) /
      intervals.length;
    const intervalStdDev = Math.sqrt(intervalVariance);
    const intervalConsistency = Math.max(0, 100 - intervalStdDev * 10);
    const occurrenceBonus = Math.min(group.length * 10, 30);
    const confidence = Math.min(
      100,
      Math.round(intervalConsistency * 0.7 + occurrenceBonus)
    );

    if (confidence < 40) continue;

    const avgAmount =
      Math.round(
        (group.reduce((s, e) => s + e.amount, 0) / group.length) * 100
      ) / 100;

    detected.push({
      merchant: group[0].merchant,
      avgAmount,
      frequency,
      occurrences: group.length,
      lastDate: group[group.length - 1].date,
      confidence,
      currency: group[0].currency,
    });
  }

  return detected.sort((a, b) => b.confidence - a.confidence);
}
