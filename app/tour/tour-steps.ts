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
        side: "right-top",
        showControls: true,
        showSkip: true,
        pointerPadding: 4,
        pointerRadius: 12,
      },
      {
        icon: "🌅",
        title: "AI Greeting",
        content:
          "A personalized daily greeting with AI-generated insight " +
          "about your finances and a timeline of upcoming events.",
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
          "Cash, portfolio value, and net worth at a glance — " +
          "all converted to your base currency automatically.",
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
          "Powered by Google Gemini — analyzes your spending patterns " +
          "and gives actionable advice tailored to your situation.",
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
          "Scroll down to see net worth over time, spending by category, " +
          "income vs expenses, and goal progress charts.",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 0,
        pointerRadius: 16,
      },
      {
        icon: "🎙️",
        title: "Voice Transactions",
        content:
          "See the purple mic button in the bottom-right corner? " +
          "Tap it to add transactions by voice — " +
          "\"Spent $12 on lunch at Chipotle\" gets parsed automatically.",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 0,
        pointerRadius: 16,
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
        nextRoute: "/demo/expenses",
      },

      // ── Expenses (/demo/expenses) ─────────────────────────────────
      {
        icon: "🛒",
        title: "Expense Tracking",
        content:
          "Track expenses across all accounts and credit cards. " +
          "AI auto-categorizes transactions so you see where your money goes.",
        selector: "[data-tour='expenses-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        prevRoute: "/demo/income",
        nextRoute: "/demo/credit-cards",
      },

      // ── Credit Cards (/demo/credit-cards) ─────────────────────────
      {
        icon: "💳",
        title: "Credit Cards",
        content:
          "Manage credit cards, track charges and payments, " +
          "and monitor cashback rewards — all with multi-currency support.",
        selector: "[data-tour='credit-cards-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        prevRoute: "/demo/expenses",
        nextRoute: "/demo/stocks",
      },

      // ── Stocks (/demo/stocks) ─────────────────────────────────────
      {
        icon: "📊",
        title: "Stock Portfolio",
        content:
          "Track your stock portfolio with live Yahoo Finance quotes. " +
          "Supports USD and CAD holdings with automatic FX conversion.",
        selector: "[data-tour='stocks-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        prevRoute: "/demo/credit-cards",
        nextRoute: "/demo/goals",
      },

      // ── Goals (/demo/goals) ───────────────────────────────────────
      {
        icon: "🎯",
        title: "Savings Goals",
        content:
          "Set savings goals with target amounts and dates. " +
          "Smart allocation distributes savings across your goals automatically.",
        selector: "[data-tour='goals-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        prevRoute: "/demo/stocks",
        nextRoute: "/demo/subscriptions",
      },

      // ── Subscriptions (/demo/subscriptions) ───────────────────────
      {
        icon: "🔄",
        title: "Subscriptions",
        content:
          "Track recurring subscriptions and memberships. " +
          "AI detects recurring charges automatically and reminds you before bills are due.",
        selector: "[data-tour='subscriptions-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        prevRoute: "/demo/goals",
        nextRoute: "/demo/reports",
      },

      // ── Reports (/demo/reports) ───────────────────────────────────
      {
        icon: "📋",
        title: "Reports",
        content:
          "Monthly, yearly, and all-time financial reports with " +
          "charts, category breakdowns, and income vs expense trends.",
        selector: "[data-tour='reports-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 16,
        prevRoute: "/demo/subscriptions",
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
        prevRoute: "/demo/reports",
      },

      // ── Finale ────────────────────────────────────────────────────
      {
        icon: "🎉",
        title: "You're all set!",
        content:
          "That covers all the features! Explore reconciliation, " +
          "accounts, and settings on your own. Enjoy the demo!",
        side: "bottom",
        showControls: true,
        showSkip: false,
        pointerPadding: 0,
        pointerRadius: 16,
      },
    ],
  },
];
