"use client";
import { MoneyShell } from "../../components/money-shell";
import { SettingsContent } from "../../settings/settings-content";
export default function MoneyDemoSettingsPage() {
  return (<MoneyShell demoMode routeBase="/demo"><SettingsContent /></MoneyShell>);
}
