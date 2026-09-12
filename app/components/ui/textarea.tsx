import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-xl border border-border-subtle bg-[var(--card-bg)] px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary/70 focus-visible:border-accent-purple focus-visible:outline-none",
        className
      )}
      ref={ref}
      suppressHydrationWarning
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
