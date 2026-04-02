"use client";
import { MoneyShell } from "../../components/money-shell";
import { CreditCardsContent } from "../../credit-cards/credit-cards-content";
export default function MoneyDemoCreditCardsPage() {
  return (<MoneyShell demoMode routeBase="/demo"><CreditCardsContent /></MoneyShell>);
}
