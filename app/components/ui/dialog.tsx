import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  )
);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean;
  overlayClassName?: string;
}

const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, showCloseButton = true, overlayClassName, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(960px,95vw)] max-h-[90vh] translate-x-[-50%] translate-y-[-50%] overflow-y-auto rounded-2xl border border-border-subtle bg-bg-secondary p-6 shadow-soft focus:outline-none data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full p-0 text-text-secondary transition hover:bg-border-strong/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title ref={ref} className={cn("text-xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description ref={ref} className={cn("text-sm text-text-secondary", className)} {...props} />
  )
);
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription };
