"use client";
import { MoneyShell } from "../../components/money-shell";
import { ReportsContent } from "../../reports/reports-content";
export default function MoneyDemoReportsPage() {
  return (<MoneyShell demoMode routeBase="/demo"><ReportsContent /></MoneyShell>);
}
