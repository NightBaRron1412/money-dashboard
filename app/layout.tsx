import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next/types";
import { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { isAnalyticsEnabled, isSpeedInsightsEnabled } from "@/lib/analytics";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export const metadata: Metadata = {
  title: "Finance Dashboard | Amir Shetaia",
  description: "Personal finance tracking dashboard",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Finance Dashboard" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased text-sm sm:text-base`} suppressHydrationWarning>
        <Providers>{children}</Providers>
        {isAnalyticsEnabled ? <Analytics /> : null}
        {isSpeedInsightsEnabled ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
