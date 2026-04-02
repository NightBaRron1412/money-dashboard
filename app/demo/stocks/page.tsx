"use client";
import { MoneyShell } from "../../components/money-shell";
import { StocksContent } from "../../stocks/stocks-content";
export default function MoneyDemoStocksPage() {
  return (<MoneyShell demoMode routeBase="/demo"><StocksContent /></MoneyShell>);
}
