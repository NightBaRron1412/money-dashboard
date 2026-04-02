"use client";
import { MoneyShell } from "../../components/money-shell";
import { AccountsContent } from "../../accounts/accounts-content";
export default function MoneyDemoAccountsPage() {
  return (<MoneyShell demoMode routeBase="/demo"><AccountsContent /></MoneyShell>);
}
