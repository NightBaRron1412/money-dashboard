"use client";

import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "next-themes";
import { MotionProvider } from "./motion-provider";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <MotionProvider>{children}</MotionProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)"
          }
        }}
      />
    </ThemeProvider>
  );
}
