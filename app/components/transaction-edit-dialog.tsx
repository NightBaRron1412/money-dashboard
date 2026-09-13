"use client";
import { useState, type ReactNode } from "react";
import { Modal } from "./money-ui";

export function TransactionEditDialog({open, title, saving, onClose, onSave, children}: {
  open: boolean; title: string; saving: boolean; onClose: () => void;
  onSave: () => Promise<void>; children: ReactNode;
}) {
  const [error, setError] = useState("");
  return <Modal open={open} onClose={() => { if (!saving) {setError(""); onClose();} }} title={title} className="money-transaction-dialog max-w-2xl">
    <form className="transaction-editor" onSubmit={async event => {event.preventDefault(); setError(""); try {await onSave();} catch(error) {setError(error instanceof Error ? error.message : "Could not save your changes. Please try again.");} }}>
      {children}
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <div className="transaction-editor-actions">
        <button type="button" disabled={saving} onClick={() => {setError(""); onClose();}} className="rounded-full border border-border-subtle px-5 py-3 text-sm font-medium text-text-primary">Cancel</button>
        <button type="submit" disabled={saving} className="rounded-full bg-text-primary px-6 py-3 text-sm font-semibold text-bg-main disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      </div>
    </form>
  </Modal>;
}
export function EditField({label, children}: {label: string; children: ReactNode}) {
 return <div className="transaction-editor-field"><span className="mb-2 block text-xs font-medium text-text-secondary">{label}</span>{children}</div>;
}
