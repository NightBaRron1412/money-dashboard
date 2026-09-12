import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forecastCashFlow } from "@/lib/money/forecasting";
import type { Settings, Transaction } from "@/lib/money/database.types";

const settings = {
  rent_amount: 0,
} as Settings;

function transaction(
  id: string,
  type: "income" | "expense",
  amount: number,
  excludeFromMonthly = false
): Transaction {
  return {
    id,
    user_id: "user-1",
    type,
    date: "2026-08-01",
    amount,
    currency: "CAD",
    category: null,
    account_id: null,
    from_account_id: null,
    to_account_id: null,
    merchant: null,
    notes: null,
    recurrence: null,
    is_recurring: false,
    exclude_from_monthly: excludeFromMonthly,
    goal_id: null,
    linked_charge_id: null,
    idempotency_key: null,
    received_amount: null,
    created_at: "2026-08-01T12:00:00.000Z",
  };
}

describe("forecastCashFlow exclusions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-04T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("produces the same totals as if excluded income and expenses were absent", () => {
    const included = [
      transaction("income-included", "income", 3_000),
      transaction("expense-included", "expense", 1_000),
    ];
    const withExcluded = [
      ...included,
      transaction("income-excluded", "income", 30_000, true),
      transaction("expense-excluded", "expense", 10_000, true),
    ];

    const expected = forecastCashFlow(included, [], settings, 5_000);
    const actual = forecastCashFlow(withExcluded, [], settings, 5_000);

    expect(actual).toEqual(expected);
  });
});
