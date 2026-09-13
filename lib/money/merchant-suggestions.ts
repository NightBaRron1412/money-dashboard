export interface MerchantRecord { merchant: string | null; date: string; category?: string | null }
export interface MerchantSuggestion { name: string; category: string | null; count: number; lastUsed: string }
export const normalizeMerchant = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function suggestMerchants(records: MerchantRecord[], query: string, limit = 5): MerchantSuggestion[] {
  const groups = new Map<string, MerchantSuggestion>();
  for (const record of records) {
    const name = record.merchant?.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = normalizeMerchant(name);
    if (!key) continue;
    const existing = groups.get(key);
    if (!existing) groups.set(key, { name, category: record.category || null, count: 1, lastUsed: record.date });
    else {
      existing.count++;
      if (record.date > existing.lastUsed) {
        existing.name = name;
        existing.category = record.category || null;
        existing.lastUsed = record.date;
      }
    }
  }
  const search = normalizeMerchant(query);
  const match = (name: string) => {
    const key = normalizeMerchant(name);
    if (!search) return 1;
    if (key === search) return 4;
    if (key.startsWith(search)) return 3;
    if (search.split(" ").every(word => key.includes(word))) return 2;
    return 0;
  };
  return [...groups.values()].filter(item => match(item.name) > 0).sort((a, b) =>
    match(b.name) - match(a.name) || b.lastUsed.localeCompare(a.lastUsed) || b.count - a.count || a.name.localeCompare(b.name)
  ).slice(0, limit);
}
