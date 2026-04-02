# Money Dashboard

A full-featured personal finance tracking dashboard built with Next.js. Track accounts, expenses, income, stock portfolios, credit cards, subscriptions, and savings goals — all in one place. Includes AI-powered insights, voice transaction entry, and a complete demo mode that works without any backend.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e?logo=supabase)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Multi-currency accounts** — CAD, USD, and EGP with live exchange rates
- **AI-powered insights** — Gemini-driven spending analysis, anomaly detection, and a conversational finance chat
- **Voice transaction entry** — add expenses and income by speaking
- **Stock portfolio tracking** — real-time quotes via Yahoo Finance, gain/loss, dividends, and day-change
- **Credit card management** — track cards, charges, cashback rewards, and statement cycles
- **Subscription detection** — automatic detection and tracking of recurring bills
- **Goal-based savings** — set targets with smart allocation across linked accounts
- **Bank reconciliation** — compare expected vs. actual balances and resolve discrepancies
- **Monthly & yearly reports** — income vs. expenses, category breakdowns, net worth trends (Recharts)
- **Push notifications** — web push reminders for rent and upcoming bills (via Vercel Cron)
- **PIN-based authentication** — lightweight auth with bcrypt-hashed PINs
- **Budget tracking** — monthly budget with category breakdown and over-budget alerts
- **90-day cash flow forecast** — projected balances based on recurring income and expenses
- **Full demo mode** — explore every feature at `/demo` with no sign-up or database required

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS, Radix UI, Framer Motion |
| Database | [Supabase](https://supabase.com/) (Postgres) |
| AI | [Google Gemini](https://ai.google.dev/) |
| Charts | [Recharts](https://recharts.org/) |
| Notifications | Web Push (VAPID) |
| Auth | PIN-based (bcrypt) |
| Deployment | [Vercel](https://vercel.com/) |

## Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (recommended) or npm
- A [Supabase](https://supabase.com/) project (free tier works)
- A [Google Gemini API key](https://aistudio.google.com/apikey) (for AI features)

### Installation

```bash
git clone https://github.com/your-username/money-dashboard.git
cd money-dashboard
pnpm install
```

### Environment Setup

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

See the [Environment Variables](#environment-variables) section below for details.

### Database Setup

1. Create a new Supabase project
2. Open the SQL Editor in your Supabase dashboard
3. Paste and run the contents of [`supabase/schema.sql`](supabase/schema.sql)

This creates all required tables, indexes, and default data.

### Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) for the main app, or [http://localhost:3000/demo](http://localhost:3000/demo) for demo mode.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Your Supabase anonymous/public key |
| `SESSION_SECRET` | Yes | Secret for session cookie signing (any random string) |
| `GEMINI_API_KEY` | For AI | Google Gemini API key for insights, chat, and categorization |
| `NEXT_PUBLIC_MONEY_PUSH_VAPID_PUBLIC_KEY` | For push | VAPID public key for web push notifications |
| `MONEY_PUSH_VAPID_PRIVATE_KEY` | For push | VAPID private key for web push notifications |
| `MONEY_PUSH_VAPID_SUBJECT` | For push | VAPID subject (e.g. `mailto:you@example.com`) |
| `CRON_SECRET` | For push | Secret to authenticate the Vercel cron endpoint |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | No | Set to `true` to enable Vercel Analytics |
| `NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS` | No | Set to `true` to enable Vercel Speed Insights |

## Demo Mode

Visit `/demo` to explore the full dashboard with realistic sample data — no Supabase connection or API keys needed. Demo mode is read-only and covers every feature: accounts, transactions, stocks, credit cards, subscriptions, goals, reconciliation, reports, and AI insights (with static previews).

## Deployment

### Vercel (Recommended)

1. Push the repo to GitHub
2. Import the project in [Vercel](https://vercel.com/new)
3. Add all environment variables in the Vercel project settings
4. Deploy

The included `vercel.json` configures a daily cron job (`/api/push/cron`) that sends push notification reminders for rent and upcoming bills at 5 PM UTC.

### Generate VAPID Keys

If you want push notifications, generate a VAPID key pair:

```bash
npx web-push generate-vapid-keys
```

Set the output as `NEXT_PUBLIC_MONEY_PUSH_VAPID_PUBLIC_KEY` and `MONEY_PUSH_VAPID_PRIVATE_KEY`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Check formatting with Prettier |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run tests with Vitest |

## License

[MIT](LICENSE)
