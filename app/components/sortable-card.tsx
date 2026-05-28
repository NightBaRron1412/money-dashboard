"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

interface SortableCardProps {
  id: string;
  children: (handleProps: {
    /** Spread these on the drag-handle button to make it the activator. */
    listeners: ReturnType<typeof useSortable>["listeners"];
    /** Renders the grip-vertical icon styled like the page's other action buttons. */
    Handle: () => ReactNode;
  }) => ReactNode;
}

/**
 * Thin wrapper around `useSortable` that hands the consumer the drag listeners
 * plus a pre-styled `<Handle />` component to drop into their card. The whole
 * card moves visually during a drag; only the handle initiates one, so the
 * rest of the card stays clickable.
 */
export function SortableCard({ id, children }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  const Handle = () => (
    <button
      type="button"
      aria-label="Drag to reorder"
      className="cursor-grab touch-none rounded-lg p-1 text-text-secondary hover:bg-bg-elevated hover:text-text-primary active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, Handle })}
    </div>
  );
}
