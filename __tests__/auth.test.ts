import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseServerFetch,
  getServerDatabaseCredentials,
  isCronAuthorized,
} from "@/lib/supabase-server";

const originalCronSecret = process.env.CRON_SECRET;
const originalDatabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  MONEY_DATA_GATEWAY_SECRET: process.env.MONEY_DATA_GATEWAY_SECRET,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function restoreEnv(name: keyof typeof originalDatabaseEnv) {
  const value = originalDatabaseEnv[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
  for (const name of Object.keys(originalDatabaseEnv) as Array<
    keyof typeof originalDatabaseEnv
  >) {
    restoreEnv(name);
  }
});

describe("cron authorization", () => {
  it("fails closed when CRON_SECRET is missing", () => {
    delete process.env.CRON_SECRET;
    const request = new Request("https://money.test/api/snapshots/capture", {
      headers: { "user-agent": "vercel-cron/1.0" },
    });

    expect(isCronAuthorized(request)).toBe(false);
  });

  it("requires the configured bearer token", () => {
    process.env.CRON_SECRET = "cron-secret";

    expect(
      isCronAuthorized(
        new Request("https://money.test/api/snapshots/capture", {
          headers: { authorization: "Bearer cron-secret" },
        })
      )
    ).toBe(true);
    expect(
      isCronAuthorized(
        new Request("https://money.test/api/snapshots/capture", {
          headers: { authorization: "Bearer wrong" },
        })
      )
    ).toBe(false);
  });
});

describe("server Supabase credentials", () => {
  it("prefers the publishable key and gateway secret pair", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.MONEY_DATA_GATEWAY_SECRET = "gateway-secret";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_stale";

    expect(getServerDatabaseCredentials()).toMatchObject({
      key: "sb_publishable_test",
      gatewaySecret: "gateway-secret",
    });
  });

  it("rejects incomplete gateway credentials", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    delete process.env.MONEY_DATA_GATEWAY_SECRET;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => getServerDatabaseCredentials()).toThrow(/incomplete/);
  });

  it.each(["sb_secret_test", "sb_publishable_test"])(
    "does not send opaque key %s as a bearer JWT",
    async (opaqueKey) => {
      const response = new Response("{}", { status: 200 });
      const transport = vi.fn(async () => response) as unknown as typeof fetch;
      const serverFetch = createSupabaseServerFetch(opaqueKey, transport);

      await serverFetch("https://project.supabase.co/rest/v1/money_accounts", {
        headers: {
          apikey: opaqueKey,
          authorization: `Bearer ${opaqueKey}`,
        },
      });

      const [, init] = (transport as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = new Headers(init.headers);
      expect(headers.get("apikey")).toBe(opaqueKey);
      expect(headers.has("authorization")).toBe(false);
    }
  );
});
