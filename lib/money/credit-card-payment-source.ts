import type { CreditCardPayment } from "./database.types";

export type CreditCardPaymentSource =
  | "account"
  | "cashback"
  | "credit"
  | "correction"
  | "other";

export function getCreditCardPaymentSource(
  payment: Pick<CreditCardPayment, "account_id" | "notes">
): CreditCardPaymentSource {
  if (payment.account_id) return "account";

  const notes = payment.notes?.trim().toLowerCase() ?? "";
  if (notes.includes("balance correction")) return "correction";
  if (notes.includes("cashback")) return "cashback";
  if (notes.includes("credit") || notes.includes("refund")) return "credit";
  return "other";
}
