import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 text-sm text-text-primary shadow-inner shadow-black/10 transition-colors placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue",
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
