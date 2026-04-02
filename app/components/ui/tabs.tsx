import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-bg-elevated p-1 text-text-secondary shadow-inner shadow-black/20 snap-x snap-mandatory",
        className
      )}
      suppressHydrationWarning
      {...props}
    />
  )
);
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex min-h-[44px] min-w-[120px] snap-center items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue data-[state=active]:bg-accent-blue data-[state=active]:text-text-on-accent data-[state=active]:shadow-glow",
        className
      )}
      suppressHydrationWarning
      {...props}
    />
  )
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Content
      ref={ref}
      className={cn("mt-4 rounded-2xl border border-border-subtle bg-bg-elevated p-6 shadow-soft", className)}
      suppressHydrationWarning
      {...props}
    />
  )
);
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
