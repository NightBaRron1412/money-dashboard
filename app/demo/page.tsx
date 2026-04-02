"use client";
import { MoneyShell } from "../components/money-shell";
import { DashboardContent } from "../dashboard-content";
export default function MoneyDemoPage() {
  return (<MoneyShell demoMode routeBase="/demo"><DashboardContent demoMode routeBase="/demo" /></MoneyShell>);
}
