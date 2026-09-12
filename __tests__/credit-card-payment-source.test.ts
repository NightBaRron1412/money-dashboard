import { describe, expect, it } from "vitest";
import { getCreditCardPaymentSource } from "@/lib/money/credit-card-payment-source";

describe("credit card payment source", () => {
  it("does not classify a balance correction as cashback", () => {
    expect(
      getCreditCardPaymentSource({
        account_id: null,
        notes: "Balance correction",
      })
    ).toBe("correction");
  });

  it.each([
    [{ account_id: "account-1", notes: null }, "account"],
    [{ account_id: null, notes: "Cashback redemption" }, "cashback"],
    [{ account_id: null, notes: "Credit / Refund" }, "credit"],
    [{ account_id: null, notes: null }, "other"],
  ] as const)("classifies known payment sources", (payment, expected) => {
    expect(getCreditCardPaymentSource(payment)).toBe(expected);
  });
});
