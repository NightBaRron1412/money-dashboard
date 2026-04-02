"use client";
import { MoneyShell } from "../../components/money-shell";
import { SubscriptionsContent } from "../../subscriptions/subscriptions-content";
export default function MoneyDemoSubscriptionsPage() {
  return (<MoneyShell demoMode routeBase="/demo"><SubscriptionsContent /></MoneyShell>);
}
