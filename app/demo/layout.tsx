"use client";

import type { ReactNode } from "react";
import { TourProvider } from "../tour/tour-provider";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <TourProvider>{children}</TourProvider>;
}
