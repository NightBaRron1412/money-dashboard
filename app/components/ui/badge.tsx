import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {}

const Badge = ({ className, ...props }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border border-border-subtle bg-bg-elevated px-3 py-1 text-xs font-medium text-text-primary shadow-sm transition hover:-translate-y-0.5 hover:shadow-glow",
      className
    )}
    {...props}
  />
);

export { Badge };
