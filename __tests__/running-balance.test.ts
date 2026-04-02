import { describe, expect, it } from "vitest";
import { computeAccountBalance } from "@/lib/money/queries";
import type { Transaction } from "@/lib/money/database.types";

const uid = "00000000-0000-0000-0000-000000000001";
const acctA = "acct-a";
const acctB = "acct-b";
let counter = 0;

function tx(overrides: Partial<Transaction> & { type: Transaction["type"]; amount: number }): Transaction {
  return {
    id: `tx-${++counter}`,
    user_id: uid,
    date: "2025-01-15",
    currency: "CAD",
    category: null,
    account_id: null,
    from_account_id: null,
    to_account_id: null,
    merchant: null,
    notes: null,
    recurrence: null,
    is_recurring: false,
    linked_charge_id: null,
    idempotency_key: null,
    received_amount: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("Running balance via computeAccountBalance", () => {
  it("income increases running balance", () => {
    const txs = [
      tx({ type: "income", amount: 1000, account_id: acctA }),
    ];
    expect(computeAccountBalance(acctA, txs, 500)).toBe(1500);
  });

  it("expense decreases running balance", () => {
    const txs = [
      tx({ type: "expense", amount: 200, account_id: acctA }),
    ];
    expect(computeAccountBalance(acctA, txs, 1000)).toBe(800);
  });

  it("transfer affects both accounts correctly", () => {
    const txs = [
      tx({
        type: "transfer",
        amount: 300,
        from_account_id: acctA,
        to_account_id: acctB,
      }),
    ];
    expect(computeAccountBalance(acctA, txs, 1000)).toBe(700);
    expect(computeAccountBalance(acctB, txs, 500)).toBe(800);
  });

  it("ordering stability — two transactions same posted_at", () => {
    const txs = [
      tx({ type: "income", amount: 100, account_id: acctA, date: "2025-01-15" }),
      tx({ type: "expense", amount: 50, account_id: acctA, date: "2025-01-15" }),
    ];
    const bal = computeAccountBalance(acctA, txs, 0);
    expect(bal).toBe(50);
  });

  it("mixed transaction types produce correct balance", () => {
    const txs = [
      tx({ type: "income", amount: 5000, account_id: acctA }),
      tx({ type: "expense", amount: 1200, account_id: acctA }),
      tx({ type: "transfer", amount: 500, from_account_id: acctA, to_account_id: acctB }),
      tx({ type: "income", amount: 200, account_id: acctA }),
    ];
    // 0 + 5000 - 1200 - 500 + 200 = 3500
    expect(computeAccountBalance(acctA, txs, 0)).toBe(3500);
    // 0 + 500 = 500
    expect(computeAccountBalance(acctB, txs, 0)).toBe(500);
  });

  it("empty transactions return starting balance", () => {
    expect(computeAccountBalance(acctA, [], 1234.56)).toBe(1234.56);
  });

  it("credit card payments deduct from account balance", () => {
    const payments = [
      { id: "p1", user_id: uid, card_id: "c1", account_id: acctA, date: "2025-01-15", amount: 250, notes: null, created_at: "" },
    ];
    expect(computeAccountBalance(acctA, [], 1000, payments)).toBe(750);
  });
});
