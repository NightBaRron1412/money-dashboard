import type { Tour } from "nextstepjs";

export const demoTourSteps: Tour[] = [
  {
    tour: "demoTour",
    steps: [
      // ── Dashboard (/demo) ─────────────────────────────────────────
      {
        icon: "👋",
        title: "Welcome to the Finance Dashboard",
        content:
          "This is a fully interactive demo loaded with sample data. " +
          "We'll walk you through the key features — use Next to continue or Skip to explore on your own.",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 0,
        pointerRadius: 16,
      },
      {
        icon: "📊",
        title: "Navigation",
        content:
          "The sidebar gives you access to all features — income, expenses, stocks, goals, " +
          "AI chat, and more. On mobile, use the bottom tab bar.",
        selector: "[data-tour='sidebar']",
        side: "right",
        showControls: true,
        showSkip: true,
        pointerPadding: 4,
        pointerRadius: 16,
      },
      {
        icon: "👁️",
        title: "Privacy Mode",
        content:
          "Toggle this to hide or show all monetary values. " +
          "Great for when you're sharing your screen.",
        selector: "[data-tour='balance-toggle']",
        side: "right",
        showControls: true,
        showSkip: true,
        pointerPadding: 4,
        pointerRadius: 12,
      },
      {
        icon: "🌅",
        title: "AI Greeting",
        content:
          "Every day you get a personalized greeting with an AI-generated insight " +
          "about your finances, plus a timeline of upcoming events.",
        selector: "[data-tour='greeting']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
      },
      {
        icon: "💰",
        title: "Financial Summary",
        content:
          "Your cash, portfolio value, and net worth at a glance. " +
          "All amounts are converted to your base currency automatically.",
        selector: "[data-tour='summary-stats']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
      },
      {
        icon: "🤖",
        title: "AI Insights",
        content:
          "Powered by Google Gemini, the AI analyzes your spending patterns " +
          "and gives actionable advice tailored to your financial situation.",
        selector: "[data-tour='ai-insights']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
      },
      {
        icon: "📈",
        title: "Charts & Trends",
        content:
          "Visualize your net worth over time, spending by category, " +
          "income vs expenses, and goal progress — all interactive.",
        selector: "[data-tour='charts']",
        side: "top",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
      },
      {
        icon: "🎙️",
        title: "Voice Transactions",
        content:
          "Tap the mic to add transactions by voice — " +
          "try saying \"Spent $12 on lunch at Chipotle\" and it gets parsed automatically.",
        selector: "[data-tour='voice-fab']",
        side: "left",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 24,
        nextRoute: "/demo/income",
      },

      // ── Income (/demo/income) ─────────────────────────────────────
      {
        icon: "💵",
        title: "Income Tracking",
        content:
          "Track all income sources — paychecks, bonuses, freelance, dividends. " +
          "Supports recurring entries and multi-currency.",
        selector: "[data-tour='income-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        prevRoute: "/demo",
      },
      {
        icon: "➕",
        title: "Add Income",
        content:
          "Add income entries with category, account, currency, " +
          "and optional recurrence (weekly, bi-weekly, monthly, yearly).",
        selector: "[data-tour='income-add']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 4,
        pointerRadius: 12,
        nextRoute: "/demo/expenses",
      },

      // ── Expenses (/demo/expenses) ─────────────────────────────────
      {
        icon: "🛒",
        title: "Expense Tracking",
        content:
          "Track expenses across all accounts and credit cards. " +
          "AI auto-categorizes transactions so you can see where your money goes.",
        selector: "[data-tour='expenses-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        prevRoute: "/demo/income",
      },
      {
        icon: "🏷️",
        title: "Category Breakdown",
        content:
          "See spending grouped by category with visual breakdowns. " +
          "Categories are fully customizable in Settings.",
        selector: "[data-tour='category-breakdown']",
        side: "top",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        nextRoute: "/demo/stocks",
      },

      // ── Stocks (/demo/stocks) ─────────────────────────────────────
      {
        icon: "📊",
        title: "Stock Portfolio",
        content:
          "Track your stock portfolio with live quotes from Yahoo Finance. " +
          "Supports USD and CAD holdings with automatic FX conversion.",
        selector: "[data-tour='stocks-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        prevRoute: "/demo/expenses",
      },
      {
        icon: "📋",
        title: "Holdings Overview",
        content:
          "See each holding's market value, gain/loss, cost basis, " +
          "dividends, and daily change — all in one place.",
        selector: "[data-tour='stocks-holdings']",
        side: "top",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        nextRoute: "/demo/goals",
      },

      // ── Goals (/demo/goals) ───────────────────────────────────────
      {
        icon: "🎯",
        title: "Savings Goals",
        content:
          "Set savings goals with target amounts and dates. " +
          "Smart allocation automatically distributes savings across your goals.",
        selector: "[data-tour='goals-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        prevRoute: "/demo/stocks",
      },
      {
        icon: "📊",
        title: "Goal Progress",
        content:
          "Each goal shows progress bars, projected completion dates, " +
          "and linked accounts. Mark goals as complete when you hit the target.",
        selector: "[data-tour='goals-cards']",
        side: "top",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        nextRoute: "/demo/chat",
      },

      // ── AI Chat (/demo/chat) ──────────────────────────────────────
      {
        icon: "💬",
        title: "AI Finance Chat",
        content:
          "Ask questions about your finances in plain English — " +
          "\"How much did I spend on food?\" or \"Am I on track with my goals?\"",
        selector: "[data-tour='chat-panel']",
        side: "left",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        prevRoute: "/demo/goals",
      },

      // ── Finale ────────────────────────────────────────────────────
      {
        icon: "🎉",
        title: "You're all set!",
        content:
          "That covers the highlights. There's more to explore — " +
          "credit cards, subscriptions, reconciliation, reports, and settings. " +
          "Enjoy the demo!",
        side: "bottom",
        showControls: true,
        showSkip: false,
        pointerPadding: 0,
        pointerRadius: 16,
      },
    ],
  },
];
