import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-blue disabled:pointer-events-none disabled:opacity-60 ring-offset-bg-main",
  {
    variants: {
      variant: {
        default: "bg-accent-purple text-text-on-accent shadow-glow hover:-translate-y-1",
        outline: "border border-border-subtle bg-transparent text-text-primary hover:border-accent-blue hover:text-accent-blue",
        ghost: "text-text-primary hover:bg-bg-elevated",
        secondary: "bg-accent-blue text-text-on-accent hover:-translate-y-1 hover:shadow-glow",
        subtle: "bg-bg-elevated text-text-primary hover:bg-bg-secondary"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-10 px-3",
        lg: "h-11 px-6 text-base",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        suppressHydrationWarning
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
