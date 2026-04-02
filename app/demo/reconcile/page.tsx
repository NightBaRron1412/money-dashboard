"use client";
import { MoneyShell } from "../../components/money-shell";
import { ReconcileContent } from "../../reconcile/reconcile-content";
export default function MoneyDemoReconcilePage() {
  return (<MoneyShell demoMode routeBase="/demo"><ReconcileContent /></MoneyShell>);
}
