import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3 text-sm text-text-primary shadow-inner shadow-black/10 placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue",
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
