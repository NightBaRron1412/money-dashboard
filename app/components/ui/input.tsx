import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-border-subtle bg-[var(--card-bg)] px-4 text-sm text-text-primary transition-colors placeholder:text-text-secondary/70 focus-visible:border-accent-purple focus-visible:outline-none",
        className
      )}
      ref={ref}
      suppressHydrationWarning
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
