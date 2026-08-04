import { describe, expect, it, vi } from "vitest";
import { OWNER_ID } from "@/lib/money/constants";
import {
  addOwnerScope,
  getDataProxyTable,
  isSafeDataProxySelection,
  isTrustedDataProxyRequest,
  scopeDataProxyPayload,
} from "@/lib/money/data-proxy";
import { createDataProxyFetch } from "@/lib/supabase";

describe("data proxy allowlist", () => {
  it("allows only exact PostgREST paths for dashboard tables", () => {
    expect(getDataProxyTable(["rest", "v1", "money_accounts"])).toBe("money_accounts");
    expect(getDataProxyTable(["rest", "v1", "private_table"])).toBeNull();
    expect(getDataProxyTable(["rest", "v1", "rpc", "dangerous"])).toBeNull();
  });

  it("forces every query to the configured owner", () => {
    const params = addOwnerScope(
      new URLSearchParams(`user_id=neq.${OWNER_ID}&id=eq.account-id`),
      "money_accounts"
    );

    expect(params.get("user_id")).toBe(`eq.${OWNER_ID}`);
    expect(params.get("id")).toBe("eq.account-id");
  });

  it("overwrites owner identifiers on object and batch writes", () => {
    expect(
      scopeDataProxyPayload("money_accounts", { name: "Cash", user_id: "attacker" })
    ).toMatchObject({ name: "Cash", user_id: OWNER_ID });
    expect(
      scopeDataProxyPayload("money_transactions", [
        { amount: 1, user_id: "attacker" },
        { amount: 2 },
      ])
    ).toEqual([
      { amount: 1, user_id: OWNER_ID },
      { amount: 2, user_id: OWNER_ID },
    ]);
  });

  it("keeps PIN and lockout fields private", () => {
    expect(
      isSafeDataProxySelection(
        "money_settings",
        new URLSearchParams("select=id,base_currency")
      )
    ).toBe(true);
    expect(
      isSafeDataProxySelection("money_settings", new URLSearchParams("select=*"))
    ).toBe(false);
    expect(
      isSafeDataProxySelection(
        "money_settings",
        new URLSearchParams("select=id,hash:pin_hash")
      )
    ).toBe(false);
    expect(() =>
      scopeDataProxyPayload("money_settings", { pin_hash: "not-allowed" })
    ).toThrow(/Private settings fields/);
  });
});

describe("data proxy request security", () => {
  it("requires same-origin mutations with the CSRF header", () => {
    expect(
      isTrustedDataProxyRequest(
        new Request("https://money.example/api/data/rest/v1/money_accounts", {
          method: "POST",
          headers: { origin: "https://money.example", "x-money-csrf": "1" },
        })
      )
    ).toBe(true);
    expect(
      isTrustedDataProxyRequest(
        new Request("https://money.example/api/data/rest/v1/money_accounts", {
          method: "POST",
          headers: { origin: "https://evil.example", "x-money-csrf": "1" },
        })
      )
    ).toBe(false);
  });

  it("rewrites SDK calls to the local gateway and strips public credentials", async () => {
    const response = new Response("[]", { status: 200 });
    const transport = vi.fn(async () => response) as unknown as typeof fetch;
    const proxyFetch = createDataProxyFetch(transport);

    await proxyFetch("https://project.supabase.co/rest/v1/money_accounts?select=*", {
      headers: { apikey: "public-key", authorization: "Bearer public-key" },
    });

    const [url, init] = (transport as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/data/rest/v1/money_accounts?select=*");
    expect(headers.has("apikey")).toBe(false);
    expect(headers.has("authorization")).toBe(false);
    expect(headers.get("x-money-csrf")).toBe("1");
    expect(init.credentials).toBe("same-origin");
  });
});
