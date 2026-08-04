import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseServerFetch,
  isCronAuthorized,
} from "@/lib/supabase-server";

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
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
  it("does not send opaque secret keys as bearer JWTs", async () => {
    const response = new Response("{}", { status: 200 });
    const transport = vi.fn(async () => response) as unknown as typeof fetch;
    const serverFetch = createSupabaseServerFetch("sb_secret_test", transport);

    await serverFetch("https://project.supabase.co/rest/v1/money_accounts", {
      headers: {
        apikey: "sb_secret_test",
        authorization: "Bearer sb_secret_test",
      },
    });

    const [, init] = (transport as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("apikey")).toBe("sb_secret_test");
    expect(headers.has("authorization")).toBe(false);
  });
});
