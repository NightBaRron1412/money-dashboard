import { describe, expect, it } from "vitest";
import { suggestMerchants } from "../lib/money/merchant-suggestions";

describe("merchant history suggestions", () => {
  const records = [
    { merchant: "  CAFÉ Nord ", date: "2026-08-01", category: "Food" },
    { merchant: "Cafe Nord", date: "2026-09-01", category: "Dining" },
    { merchant: "Nord Market", date: "2026-09-05", category: "Shopping" },
    { merchant: "Cafe South", date: "2026-09-06", category: "Food" },
    { merchant: null, date: "2026-09-07" },
  ];
  it("deduplicates accents and spacing, keeping the latest category", () => {
    expect(suggestMerchants(records, "cafe nord")).toEqual([{ name: "Cafe Nord", category: "Dining", count: 2, lastUsed: "2026-09-01" }]);
  });
  it("ranks exact then prefix matches ahead of other matches", () => {
    expect(suggestMerchants(records, "nord").map(item => item.name)).toEqual(["Nord Market", "Cafe Nord"]);
  });
  it("supports multi-word queries, unknown names and bounded recent suggestions", () => {
    expect(suggestMerchants(records, "nord cafe")[0].name).toBe("Cafe Nord");
    expect(suggestMerchants(records, "brand new")).toEqual([]);
    expect(suggestMerchants(records, "", 2).map(item => item.name)).toEqual(["Cafe South", "Nord Market"]);
  });
});
