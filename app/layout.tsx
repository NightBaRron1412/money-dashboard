import "./globals.css";
import { Manrope } from "next/font/google";
import type { Metadata, Viewport } from "next/types";
import { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { isAnalyticsEnabled, isSpeedInsightsEnabled } from "@/lib/analytics";
import { Providers } from "./providers";
import { SwRegister } from "./sw-register";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1014" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://money.amirshetaia.com"),
  title: "Money | Personal Finance",
  description: "A clear view of accounts, spending, investments, goals, and cash flow.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Money | Personal Finance",
    description: "A clear view of accounts, spending, investments, goals, and cash flow.",
    url: "https://money.amirshetaia.com",
    siteName: "Money",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Finance Dashboard Preview" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Money | Personal Finance",
    description: "A clear view of accounts, spending, investments, goals, and cash flow.",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Money", statusBarStyle: "black-translucent" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} antialiased text-sm sm:text-base`} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <SwRegister />
        {isAnalyticsEnabled ? <Analytics /> : null}
        {isSpeedInsightsEnabled ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
