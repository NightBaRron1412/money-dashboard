import { afterEach, describe, expect, it, vi } from "vitest";
import { createLinkedCreditCardCharge, updateTransaction, computeCreditCardBalance } from "../lib/money/queries";
import { getDemoStore, resetDemoStore } from "../lib/money/demo-store";
import { isIncludedInMonthlyTotals } from "../lib/money/transaction-filters";

afterEach(() => { vi.unstubAllGlobals(); resetDemoStore(); });
describe("credit card monthly exclusions", () => {
  it("preserves debt while changing the linked monthly expense", async () => {
    vi.stubGlobal("window", {location:{pathname:"/demo/credit-cards"}});
    const store=getDemoStore();
    const card=store.creditCards[0];
    const before=computeCreditCardBalance(card.id,store.creditCardCharges,store.creditCardPayments);
    const charge=await createLinkedCreditCardCharge({card_id:card.id,date:"2026-09-12",amount:25,merchant:"Test",category:"Food",notes:null}, {currency:card.currency,cardName:card.name,exclude_from_monthly:true});
    const tx=store.transactions.find(t=>t.id===charge.linked_transaction_id)!;
    expect(tx.linked_charge_id).toBe(charge.id);
    expect(isIncludedInMonthlyTotals(tx)).toBe(false);
    expect(computeCreditCardBalance(card.id,store.creditCardCharges,store.creditCardPayments)).toBeCloseTo(before+25);
    await updateTransaction(tx.id,{exclude_from_monthly:false});
    expect(isIncludedInMonthlyTotals(store.transactions.find(t=>t.id===tx.id)!)).toBe(true);
    expect(computeCreditCardBalance(card.id,store.creditCardCharges,store.creditCardPayments)).toBeCloseTo(before+25);
  });
});
