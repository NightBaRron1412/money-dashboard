"use client";
import { MoneyShell } from "../../components/money-shell";
import { GoalsContent } from "../../goals/goals-content";
export default function MoneyDemoGoalsPage() {
  return (<MoneyShell demoMode routeBase="/demo"><GoalsContent /></MoneyShell>);
}
