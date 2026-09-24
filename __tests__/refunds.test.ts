import { afterEach, describe, expect, it, vi } from "vitest";
import { getDemoStore, resetDemoStore } from "../lib/money/demo-store";
import {
  createTransaction,
  createLinkedCreditCardCharge,
  createCreditCardPayment,
  updateCreditCardPayment,
  deleteCreditCardPayment,
  updateTransaction,
  deleteTransaction,
  computeAccountBalance,
  computeCreditCardBalance,
} from "../lib/money/queries";
import { monthlyAmount } from "../lib/money/transaction-filters";
afterEach(() => {
  vi.unstubAllGlobals();
  resetDemoStore();
});
describe("linked purchase refunds", () => {
  it("nets partial card refunds, supports edits/deletes, and preserves full ledger balances", async () => {
    vi.stubGlobal("window", { location: { pathname: "/demo/credit-cards" } });
    const s = getDemoStore(),
      card = s.creditCards[0];
    const charge = await createLinkedCreditCardCharge(
      {
        card_id: card.id,
        date: "2026-09-20",
        amount: 100,
        merchant: "Refund test",
        category: "Shopping",
        notes: null,
      },
      { currency: card.currency, cardName: card.name, personal_share_percent: 50 }
    );
    const original = () => s.transactions.find((t) => t.id === charge.linked_transaction_id)!;
    const debt = () => computeCreditCardBalance(card.id, s.creditCardCharges, s.creditCardPayments);
    const before = debt();
    const refund = await createCreditCardPayment({
      card_id: card.id,
      account_id: null,
      date: "2026-09-21",
      amount: 40,
      notes: null,
      refund_of_transaction_id: original().id,
    });
    expect(original().amount).toBe(100);
    expect(original().refunded_amount).toBe(40);
    expect(monthlyAmount(original())).toBe(30);
    expect(debt()).toBe(before - 40);
    await expect(
      createCreditCardPayment({
        card_id: card.id,
        account_id: null,
        date: "2026-09-21",
        amount: 61,
        notes: null,
        refund_of_transaction_id: original().id,
      })
    ).rejects.toThrow("remaining");
    await updateCreditCardPayment(refund.id, { amount: 100 });
    expect(monthlyAmount(original())).toBe(0);
    await deleteCreditCardPayment(refund.id);
    expect(monthlyAmount(original())).toBe(50);
    expect(debt()).toBe(before);
  });
  it("bank refunds restore cash, reduce expense spending and never inflate income", async () => {
    vi.stubGlobal("window", { location: { pathname: "/demo/income" } });
    const s = getDemoStore(),
      account = s.accounts[0];
    const original = await createTransaction({
      type: "expense",
      date: "2026-09-20",
      amount: 100,
      currency: account.currency,
      category: "Shopping",
      account_id: account.id,
      from_account_id: null,
      to_account_id: null,
      merchant: "Test",
      notes: null,
      is_recurring: false,
      recurrence: null,
    });
    const before = computeAccountBalance(
      account.id,
      s.transactions,
      account.starting_balance,
      s.creditCardPayments
    );
    const refund = await createTransaction({
      type: "income",
      date: "2026-09-21",
      amount: 40,
      currency: account.currency,
      category: "Refund",
      account_id: account.id,
      from_account_id: null,
      to_account_id: null,
      merchant: "Test",
      notes: null,
      is_recurring: false,
      recurrence: null,
      refund_of_transaction_id: original.id,
    });
    expect(monthlyAmount(refund)).toBe(0);
    expect(refund.exclude_from_monthly).toBe(true);
    expect(monthlyAmount(original)).toBe(60);
    expect(
      computeAccountBalance(
        account.id,
        s.transactions,
        account.starting_balance,
        s.creditCardPayments
      )
    ).toBe(before + 40);
    await expect(deleteTransaction(original.id)).rejects.toThrow("linked refunds");
    await updateTransaction(refund.id, { amount: 100 });
    expect(monthlyAmount(original)).toBe(0);
    await deleteTransaction(refund.id);
    expect(monthlyAmount(original)).toBe(100);
  });
});
