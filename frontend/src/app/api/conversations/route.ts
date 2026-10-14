import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { getFrontendEnv } from "@/lib/env";
import { getOrCreateTraceparent, extractTraceId } from "@/lib/tracing";

const BACKEND_URL = getFrontendEnv().BACKEND_URL;

function buildHeaders(
  session: { accessToken?: string; user?: { roles?: string[]; id?: string; email?: string | null } },
  reqId: string,
  traceparent: string,
  traceId: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": reqId,
    traceparent,
    ...(traceId ? { "x-trace-id": traceId } : {}),
  };

  if (session.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  if (Array.isArray(session.user?.roles)) {
    headers["x-user-roles"] = JSON.stringify(session.user.roles);
  }

  if (session.user?.id) {
    headers["x-user-id"] = session.user.id;
  }

  if (session.user?.email) {
    headers["x-user-email"] = session.user.email;
  }

  return headers;
}

export async function GET(request: Request) {
  const traceparent = getOrCreateTraceparent(request.headers);
  const traceId = extractTraceId(traceparent);
  const reqId = request.headers.get("x-request-id") || crypto.randomUUID();
  const reqLogger = logger.child({ reqId, traceId, path: "/api/conversations" });

  const session = await auth();
  if (!session?.user) {
    reqLogger.warn("Unauthorized attempt on GET /api/conversations");
    return NextResponse.json(
      { error: "Authentication is required." },
      {
        status: 401,
        headers: {
          "x-request-id": reqId,
          traceparent,
          ...(traceId ? { "x-trace-id": traceId } : {}),
        },
      },
    );
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/conversations`, {
      method: "GET",
      headers: buildHeaders(session, reqId, traceparent, traceId),
    });

    const data = (await res.json()) as unknown;
    return NextResponse.json(data, {
      status: res.status,
      headers: {
        "x-request-id": reqId,
        traceparent,
        ...(traceId ? { "x-trace-id": traceId } : {}),
      },
    });
  } catch (err) {
    reqLogger.error("Failed to reach backend for conversations", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not reach backend API server." },
      {
        status: 502,
        headers: {
          "x-request-id": reqId,
          traceparent,
          ...(traceId ? { "x-trace-id": traceId } : {}),
        },
      },
    );
  }
}

export async function POST(request: Request) {
  const traceparent = getOrCreateTraceparent(request.headers);
  const traceId = extractTraceId(traceparent);
  const reqId = request.headers.get("x-request-id") || crypto.randomUUID();
  const reqLogger = logger.child({ reqId, traceId, path: "/api/conversations" });

  const session = await auth();
  if (!session?.user) {
    reqLogger.warn("Unauthorized attempt on POST /api/conversations");
    return NextResponse.json(
      { error: "Authentication is required." },
      {
        status: 401,
        headers: {
          "x-request-id": reqId,
          traceparent,
          ...(traceId ? { "x-trace-id": traceId } : {}),
        },
      },
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/conversations`, {
      method: "POST",
      headers: buildHeaders(session, reqId, traceparent, traceId),
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as unknown;
    return NextResponse.json(data, {
      status: res.status,
      headers: {
        "x-request-id": reqId,
        traceparent,
        ...(traceId ? { "x-trace-id": traceId } : {}),
      },
    });
  } catch (err) {
    reqLogger.error("Failed to create conversation on backend", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not reach backend API server." },
      {
        status: 502,
        headers: {
          "x-request-id": reqId,
          traceparent,
          ...(traceId ? { "x-trace-id": traceId } : {}),
        },
      },
    );
  }
}

