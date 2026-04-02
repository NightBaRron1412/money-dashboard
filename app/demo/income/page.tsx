"use client";
import { MoneyShell } from "../../components/money-shell";
import { IncomeContent } from "../../income/income-content";
export default function MoneyDemoIncomePage() {
  return (<MoneyShell demoMode routeBase="/demo"><IncomeContent /></MoneyShell>);
}
