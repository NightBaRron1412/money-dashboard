"use client";
export function MonthlyExclusion({checked, onChange}: {checked: boolean; onChange: (checked: boolean) => void}) {
  return <label className="flex min-h-11 cursor-pointer items-center gap-2 whitespace-normal text-xs text-text-secondary"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="h-4 w-4 shrink-0 accent-[var(--accent-blue)]" />Exclude from monthly totals</label>;
}
