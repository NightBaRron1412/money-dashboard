"use client";
import { MoneyShell } from "../../components/money-shell";
import { ExpensesContent } from "../../expenses/expenses-content";
export default function MoneyDemoExpensesPage() {
  return (<MoneyShell demoMode routeBase="/demo"><ExpensesContent /></MoneyShell>);
}
