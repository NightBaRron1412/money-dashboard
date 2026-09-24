import type { Transaction, CreditCardPayment, CreditCardCharge } from "./database.types";

export function refundTotal(
  id: string,
  transactions: Transaction[],
  payments: CreditCardPayment[],
  omitId?: string
): number {
  return (
    Math.round(
      [...transactions, ...payments]
        .filter((r) => r.refund_of_transaction_id === id && r.id !== omitId)
        .reduce((sum, r) => sum + r.amount, 0) * 100
    ) / 100
  );
}

export function validateRefund(
  refund: {
    id?: string;
    refund_of_transaction_id?: string | null;
    amount: number;
    currency?: string;
    date: string;
    card_id?: string;
    account_id?: string | null;
  },
  transactions: Transaction[],
  payments: CreditCardPayment[],
  charges: CreditCardCharge[] = []
) {
  if (!refund.refund_of_transaction_id) return;
  const original = transactions.find(
    (t) => t.id === refund.refund_of_transaction_id && t.type === "expense"
  );
  if (!original) throw new Error("Select the original expense.");
  if (refund.amount <= 0 || !Number.isFinite(refund.amount) || refund.date < original.date)
    throw new Error("Refund must be positive and dated on or after the purchase.");
  if (refund.currency && refund.currency !== original.currency)
    throw new Error("Refund and purchase must use the same currency.");
  if (
    refund.card_id &&
    (refund.account_id ||
      !charges.some(
        (c) =>
          c.card_id === refund.card_id &&
          (c.id === original.linked_charge_id || c.linked_transaction_id === original.id)
      ))
  )
    throw new Error("Choose a purchase on this card and use Credit / Refund.");
  if (
    Math.round(refund.amount * 100) >
    Math.round(
      (original.amount - refundTotal(original.id, transactions, payments, refund.id)) * 100
    )
  )
    throw new Error("Refund exceeds the remaining purchase amount.");
}
