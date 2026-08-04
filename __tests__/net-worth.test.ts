import { describe, expect, it } from "vitest";
import { computeNetWorthBase } from "@/lib/money/net-worth";

describe("computeNetWorthBase", () => {
  it("adds cash, holdings, and available dividends, then subtracts card debt", () => {
    expect(
      computeNetWorthBase({
        cashBase: 10_000,
        holdingsBase: 5_000,
        dividendsBase: 200,
        creditCardDebtBase: 1_250,
      })
    ).toBe(13_950);
  });

  it("treats a credit balance as an asset", () => {
    expect(
      computeNetWorthBase({
        cashBase: 1_000,
        holdingsBase: 0,
        dividendsBase: 0,
        creditCardDebtBase: -50,
      })
    ).toBe(1_050);
  });
});
