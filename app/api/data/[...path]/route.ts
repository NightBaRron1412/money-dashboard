import { NextRequest, NextResponse } from "next/server";
import {
  getServerDatabaseCredentials,
  requireSession,
} from "@/lib/supabase-server";
import {
  addOwnerScope,
  getDataProxyTable,
  isSafeDataProxySelection,
  isTrustedDataProxyRequest,
  scopeDataProxyPayload,
} from "@/lib/money/data-proxy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 1_000_000;
const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-profile",
  "content-profile",
  "content-type",
  "prefer",
  "range",
] as const;
const FORWARDED_RESPONSE_HEADERS = [
  "content-range",
  "content-type",
  "preference-applied",
  "range-unit",
] as const;

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

type RouteContext = { params: Promise<{ path: string[] }> };

function privateJson(body: { error: string }, status: number) {
  return NextResponse.json(body, {
    status,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}

async function proxyDataRequest(request: NextRequest, context: RouteContext) {
  const authError = await requireSession();
  if (authError) return authError;

  if (!isTrustedDataProxyRequest(request)) {
    return privateJson({ error: "Invalid request origin" }, 403);
  }

  const { path } = await context.params;
  const table = getDataProxyTable(path);
  if (!table) {
    return privateJson({ error: "Database resource is not allowed" }, 404);
  }

  const scopedSearch = addOwnerScope(request.nextUrl.searchParams, table);
  if (!isSafeDataProxySelection(table, scopedSearch)) {
    return privateJson({ error: "Private settings fields are not accessible" }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return privateJson({ error: "Request body is too large" }, 413);
  }

  let body: string | undefined;
  if (METHODS_WITH_BODY.has(request.method)) {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return privateJson({ error: "Request body is too large" }, 413);
    }

    try {
      body = JSON.stringify(scopeDataProxyPayload(table, JSON.parse(rawBody)));
    } catch (error) {
      return privateJson(
        { error: error instanceof Error ? error.message : "Invalid database payload" },
        400
      );
    }
  }

  try {
    const {
      url: supabaseUrl,
      key,
      gatewaySecret,
    } = getServerDatabaseCredentials();
    const upstreamUrl = new URL(`/rest/v1/${table}`, supabaseUrl);
    upstreamUrl.search = scopedSearch.toString();

    const upstreamHeaders = new Headers();
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = request.headers.get(name);
      if (value) upstreamHeaders.set(name, value);
    }
    upstreamHeaders.set("apikey", key);
    if (!key.startsWith("sb_")) {
      upstreamHeaders.set("authorization", `Bearer ${key}`);
    }
    if (gatewaySecret) {
      upstreamHeaders.set("x-money-gateway-secret", gatewaySecret);
    }

    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const responseHeaders = new Headers(PRIVATE_RESPONSE_HEADERS);
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    const hasNoResponseBody =
      request.method === "HEAD" || [204, 205, 304].includes(upstream.status);
    return new NextResponse(hasNoResponseBody ? null : await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(
      "data gateway failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return privateJson({ error: "Database request failed" }, 502);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyDataRequest(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyDataRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyDataRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyDataRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyDataRequest(request, context);
}
