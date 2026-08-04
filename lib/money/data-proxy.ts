import { OWNER_ID } from "@/lib/money/constants";

export const DATA_PROXY_OWNER_COLUMNS = {
  money_accounts: "user_id",
  money_transactions: "user_id",
  money_goals: "user_id",
  money_goal_accounts: "user_id",
  money_allocation_plans: "user_id",
  money_settings: "user_id",
  money_holdings: "user_id",
  money_subscriptions: "user_id",
  money_dividends: "user_id",
  money_credit_cards: "user_id",
  money_credit_card_charges: "user_id",
  money_credit_card_payments: "user_id",
  money_net_worth_snapshots: "user_id",
} as const;

export type DataProxyTable = keyof typeof DATA_PROXY_OWNER_COLUMNS;

const SETTINGS_PRIVATE_COLUMNS = new Set([
  "pin_hash",
  "failed_attempts",
  "locked_until",
]);

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function getDataProxyTable(path: string[]): DataProxyTable | null {
  if (path.length !== 3 || path[0] !== "rest" || path[1] !== "v1") {
    return null;
  }

  let table: string;
  try {
    table = decodeURIComponent(path[2]);
  } catch {
    return null;
  }

  return Object.prototype.hasOwnProperty.call(DATA_PROXY_OWNER_COLUMNS, table)
    ? (table as DataProxyTable)
    : null;
}

export function isTrustedDataProxyRequest(request: Request): boolean {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return true;

  const origin = request.headers.get("origin");
  const csrfHeader = request.headers.get("x-money-csrf");
  if (!origin || csrfHeader !== "1") return false;

  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function addOwnerScope(
  searchParams: URLSearchParams,
  table: DataProxyTable
): URLSearchParams {
  const scoped = new URLSearchParams(searchParams);
  scoped.set(DATA_PROXY_OWNER_COLUMNS[table], `eq.${OWNER_ID}`);
  return scoped;
}

function selectRequestsPrivateSettingsColumn(select: string | null): boolean {
  if (!select || select.includes("*")) return true;
  return /(^|[,:()])\s*(pin_hash|failed_attempts|locked_until)\b/.test(select);
}

export function isSafeDataProxySelection(
  table: DataProxyTable,
  searchParams: URLSearchParams
): boolean {
  if (table !== "money_settings") return true;
  return !selectRequestsPrivateSettingsColumn(searchParams.get("select"));
}

export function scopeDataProxyPayload(
  table: DataProxyTable,
  value: unknown
): Record<string, unknown> | Array<Record<string, unknown>> {
  const rows = Array.isArray(value) ? value : [value];
  if (
    rows.length === 0 ||
    rows.some(
      (row) => !row || typeof row !== "object" || Array.isArray(row)
    )
  ) {
    throw new Error("Database payload must contain one or more objects");
  }

  if (
    table === "money_settings" &&
    rows.some((row) =>
      Object.keys(row as Record<string, unknown>).some((key) =>
        SETTINGS_PRIVATE_COLUMNS.has(key)
      )
    )
  ) {
    throw new Error("Private settings fields cannot be changed through the data gateway");
  }

  const ownerColumn = DATA_PROXY_OWNER_COLUMNS[table];
  const scoped = rows.map((row) => ({
    ...(row as Record<string, unknown>),
    [ownerColumn]: OWNER_ID,
  }));

  return Array.isArray(value) ? scoped : scoped[0];
}
