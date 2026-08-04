import { afterEach, describe, expect, it } from "vitest";
import { isCronAuthorized } from "@/lib/supabase-server";

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
