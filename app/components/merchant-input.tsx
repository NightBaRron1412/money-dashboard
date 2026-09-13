"use client";

import { useId, useMemo, useState } from "react";
import { History, CornerDownLeft } from "lucide-react";
import { suggestMerchants, normalizeMerchant, type MerchantRecord, type MerchantSuggestion } from "@/lib/money/merchant-suggestions";

export function MerchantInput({ value, onChange, records, onSelectCategory, onNewMerchant, id, placeholder = "Start typing a merchant…", className = "" }: {
  value: string; onChange: (value: string) => void; records: MerchantRecord[];
  onSelectCategory?: (category: string) => void; onNewMerchant?: (value: string) => void;
  id?: string; placeholder?: string; className?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = useMemo(() => suggestMerchants(records, value), [records, value]);
  const select = (item: MerchantSuggestion) => {
    onChange(item.name);
    if (item.category) onSelectCategory?.(item.category);
    setOpen(false);
    setActive(-1);
  };
  return (
    <div className="relative min-w-0">
      <input id={id} aria-label="Merchant" role="combobox" aria-autocomplete="list" aria-expanded={open && suggestions.length > 0} aria-controls={listId} aria-activedescendant={open && active >= 0 && suggestions[active] ? `${listId}-${active}` : undefined}
        autoComplete="off" value={value} placeholder={placeholder}
        className={`w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3 text-sm text-text-primary outline-none focus:border-accent-purple ${className}`}
        onFocus={() => { setOpen(true); setActive(-1); }}
        onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }}
        onBlur={() => {
          setOpen(false);
          const match = suggestions.find(item => normalizeMerchant(item.name) === normalizeMerchant(value));
          if (match?.category) onSelectCategory?.(match.category);
          else if (value.trim()) onNewMerchant?.(value);
        }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            setActive(previous => suggestions.length ? (previous + (event.key === "ArrowDown" ? 1 : suggestions.length - 1) + suggestions.length) % suggestions.length : -1);
          } else if (event.key === "Enter" && open && active >= 0 && suggestions[active]) {
            event.preventDefault(); select(suggestions[active]);
          } else if (event.key === "Escape" && open) {
            event.preventDefault(); event.stopPropagation(); setOpen(false);
          }
        }} />
      {open && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-border-subtle bg-[var(--card-bg)] p-1.5 shadow-card">
          <p className="px-3 py-2 text-[11px] font-medium text-text-secondary">{value.trim() ? "Matches from your history" : "Recently used"}</p>
          <ul id={listId} role="listbox" aria-label="Merchant suggestions">
            {suggestions.map((item, index) => (
              <li key={item.name} id={`${listId}-${index}`} role="option" aria-selected={active === index}
                onPointerDown={event => event.preventDefault()} onClick={() => select(item)} onPointerMove={() => setActive(index)}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${active === index ? "bg-bg-elevated" : "hover:bg-bg-elevated"}`}>
                <History className="h-4 w-4 shrink-0 text-text-secondary" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-text-primary">{item.name}</span><span className="block text-xs text-text-secondary">{item.category || "Previous merchant"} · {item.count === 1 ? "Used once" : `Used ${item.count} times`}</span></span>
                <CornerDownLeft className="h-3.5 w-3.5 text-text-secondary" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
