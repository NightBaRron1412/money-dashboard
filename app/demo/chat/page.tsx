"use client";
import { MoneyShell } from "../../components/money-shell";
import { ChatContent } from "../../chat/chat-content";
export default function MoneyDemoChatPage() {
  return (<MoneyShell demoMode routeBase="/demo"><ChatContent demoMode /></MoneyShell>);
}
