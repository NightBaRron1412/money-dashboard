import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next/types";
import { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { isAnalyticsEnabled, isSpeedInsightsEnabled } from "@/lib/analytics";
import { Providers } from "./providers";
import { SwRegister } from "./sw-register";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1020" };

export const metadata: Metadata = {
  title: "Finance Dashboard | Amir Shetaia",
  description: "Track expenses, income, investments & goals — personal finance dashboard by Amir Shetaia",
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
    title: "Finance Dashboard | Amir Shetaia",
    description: "Track expenses, income, investments & goals",
    url: "https://money.amirshetaia.com",
    siteName: "Finance Dashboard",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Finance Dashboard Preview" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finance Dashboard | Amir Shetaia",
    description: "Track expenses, income, investments & goals",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Finance Dashboard", statusBarStyle: "black-translucent" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased text-sm sm:text-base`} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <SwRegister />
        {isAnalyticsEnabled ? <Analytics /> : null}
        {isSpeedInsightsEnabled ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
