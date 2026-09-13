import { describe, expect, it } from "vitest";
import { monthlyAmount } from "../lib/money/transaction-filters";

describe("personal spending share", () => {
  it("counts only the personal share without mutating the ledger", () => {
    const transaction = {type:"expense",amount:100,personal_share_percent:60};
    expect(monthlyAmount(transaction)).toBe(60);
    expect(transaction.amount).toBe(100);
  });
  it("respects full exclusion, zero share, and old transactions", () => {
    expect(monthlyAmount({type:"expense",amount:100,personal_share_percent:60,exclude_from_monthly:true})).toBe(0);
    expect(monthlyAmount({type:"expense",amount:100,personal_share_percent:0})).toBe(0);
    expect(monthlyAmount({type:"expense",amount:100})).toBe(100);
    expect(monthlyAmount({type:"income",amount:100,personal_share_percent:50})).toBe(100);
  });
  it("rounds source-currency cents and bounds invalid percentages", () => {
    expect(monthlyAmount({type:"expense",amount:10.01,personal_share_percent:50})).toBe(5.01);
    expect(monthlyAmount({type:"expense",amount:100,personal_share_percent:150})).toBe(100);
    expect(monthlyAmount({type:"expense",amount:100,personal_share_percent:-1})).toBe(0);
  });
});
