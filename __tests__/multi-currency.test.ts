import { describe, it, expect } from "vitest";
import { convertCurrency, DEFAULT_FX } from "@/lib/money/fx";
import type { FxRates } from "@/lib/money/fx";
import type { CurrencyCode } from "@/lib/money/database.types";

// Realistic fx rates
const fx: FxRates = { USDCAD: 1.36, USDEGP: 50.5 };

describe("convertCurrency", () => {
  it("returns the same amount when from === to", () => {
    expect(convertCurrency(100, "USD", "USD", fx)).toBe(100);
    expect(convertCurrency(200, "CAD", "CAD", fx)).toBe(200);
    expect(convertCurrency(500, "EGP", "EGP", fx)).toBe(500);
  });

  it("converts USD to CAD using USDCAD rate", () => {
    const result = convertCurrency(100, "USD", "CAD", fx);
    expect(result).toBeCloseTo(136, 1); // 100 * 1.36
  });

  it("converts CAD to USD using inverse USDCAD", () => {
    const result = convertCurrency(136, "CAD", "USD", fx);
    expect(result).toBeCloseTo(100, 1); // 136 / 1.36
  });

  it("converts USD to EGP using USDEGP rate", () => {
    const result = convertCurrency(100, "USD", "EGP", fx);
    expect(result).toBeCloseTo(5050, 0); // 100 * 50.5
  });

  it("converts EGP to CAD via USD pivot", () => {
    const result = convertCurrency(5050, "EGP", "CAD", fx);
    // 5050 / 50.5 = 100 USD, 100 * 1.36 = 136 CAD
    expect(result).toBeCloseTo(136, 1);
  });

  it("converts CAD to EGP via USD pivot", () => {
    const result = convertCurrency(136, "CAD", "EGP", fx);
    // 136 / 1.36 = 100 USD, 100 * 50.5 = 5050 EGP
    expect(result).toBeCloseTo(5050, 0);
  });

  it("handles zero amount", () => {
    expect(convertCurrency(0, "USD", "CAD", fx)).toBe(0);
  });

  it("handles NaN amount", () => {
    expect(convertCurrency(NaN, "USD", "CAD", fx)).toBe(0);
  });

  it("handles Infinity amount", () => {
    expect(convertCurrency(Infinity, "USD", "CAD", fx)).toBe(0);
  });

  it("falls back to rate=1 when fx rate is 0", () => {
    const badFx: FxRates = { USDCAD: 0, USDEGP: 0 };
    // safeRate should clamp to 1, so USD->CAD with rate=1 means 100 USD = 100 CAD
    const result = convertCurrency(100, "USD", "CAD", badFx);
    expect(result).toBe(100);
  });

  it("uses DEFAULT_FX which has rates of 1 (identity)", () => {
    expect(DEFAULT_FX.USDCAD).toBe(1);
    expect(DEFAULT_FX.USDEGP).toBe(1);
    // With default fx, all currencies convert 1:1
    expect(convertCurrency(100, "USD", "CAD", DEFAULT_FX)).toBe(100);
  });
});

describe("formatMoney multi-currency", () => {
  // Test formatMoney using the same Intl.NumberFormat approach used in money-ui
  function formatMoney(amount: number, currency: CurrencyCode = "USD"): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  it("formats USD with $ symbol", () => {
    const result = formatMoney(1234, "USD");
    expect(result).toContain("1,234");
    expect(result).toMatch(/\$/);
  });

  it("formats CAD with CA$ or $ symbol", () => {
    const result = formatMoney(5000, "CAD");
    expect(result).toContain("5,000");
    // Intl can format CAD as CA$ or $
    expect(result).toMatch(/CA\$|\$/);
  });

  it("formats EGP with EGP symbol", () => {
    const result = formatMoney(10000, "EGP");
    expect(result).toContain("10,000");
    expect(result).toMatch(/EGP|E£/);
  });

  it("formats negative amounts", () => {
    const result = formatMoney(-500, "USD");
    expect(result).toContain("500");
  });

  it("formats zero", () => {
    const result = formatMoney(0, "USD");
    expect(result).toContain("0");
  });
});

describe("multi-currency total aggregation", () => {
  it("computes correct total when accounts have different currencies", () => {
    const accounts = [
      { id: "1", currency: "CAD" as CurrencyCode, balance: 1000 },
      { id: "2", currency: "USD" as CurrencyCode, balance: 500 },
      { id: "3", currency: "EGP" as CurrencyCode, balance: 25000 },
    ];

    const baseCurrency: CurrencyCode = "CAD";
    const totalBase = accounts.reduce(
      (sum, a) => sum + convertCurrency(a.balance, a.currency, baseCurrency, fx),
      0
    );

    // 1000 CAD + 500 USD * 1.36 + 25000 EGP / 50.5 * 1.36
    const expectedUSD = 500;
    const expectedEGPtoUSD = 25000 / 50.5;
    const expected = 1000 + expectedUSD * 1.36 + expectedEGPtoUSD * 1.36;
    expect(totalBase).toBeCloseTo(expected, 1);
  });

  it("total equals sum of native amounts when all accounts are same currency", () => {
    const accounts = [
      { id: "1", currency: "CAD" as CurrencyCode, balance: 1000 },
      { id: "2", currency: "CAD" as CurrencyCode, balance: 2000 },
    ];
    const baseCurrency: CurrencyCode = "CAD";
    const total = accounts.reduce(
      (sum, a) => sum + convertCurrency(a.balance, a.currency, baseCurrency, fx),
      0
    );
    expect(total).toBe(3000);
  });
});
