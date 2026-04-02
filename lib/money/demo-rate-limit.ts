/**
 * IP-based in-memory rate limiter for the demo AI chat endpoint.
 * 10 requests per 60-minute rolling window per IP.
 * Entries auto-expire on periodic cleanup.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 10;
const CLEANUP_INTERVAL = 100; // run cleanup every N checks

interface Entry {
  count: number;
  windowStart: number;
}

const store = new Map<string, Entry>();
let checkCount = 0;

function cleanup() {
  const now = Date.now();
  for (const [ip, entry] of store) {
    if (now - entry.windowStart > WINDOW_MS) {
      store.delete(ip);
    }
  }
}

export function checkDemoRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  checkCount++;
  if (checkCount % CLEANUP_INTERVAL === 0) cleanup();

  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetIn: WINDOW_MS };
  }

  if (entry.count >= MAX_REQUESTS) {
    const resetIn = WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, remaining: 0, resetIn };
  }

  entry.count++;
  const remaining = MAX_REQUESTS - entry.count;
  const resetIn = WINDOW_MS - (now - entry.windowStart);
  return { allowed: true, remaining, resetIn };
}
