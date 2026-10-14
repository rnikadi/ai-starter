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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const traceparent = getOrCreateTraceparent(request.headers);
  const traceId = extractTraceId(traceparent);
  const reqId = request.headers.get("x-request-id") || crypto.randomUUID();
  const reqLogger = logger.child({ reqId, traceId, path: `/api/conversations/${id}` });

  const session = await auth();
  if (!session?.user) {
    reqLogger.warn("Unauthorized attempt on conversation detail");
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
    const res = await fetch(`${BACKEND_URL}/api/conversations/${encodeURIComponent(id)}`, {
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
    reqLogger.error("Failed to fetch conversation from backend", {
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const traceparent = getOrCreateTraceparent(request.headers);
  const traceId = extractTraceId(traceparent);
  const reqId = request.headers.get("x-request-id") || crypto.randomUUID();
  const reqLogger = logger.child({ reqId, traceId, path: `/api/conversations/${id}` });

  const session = await auth();
  if (!session?.user) {
    reqLogger.warn("Unauthorized attempt on patch conversation");
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      {
        status: 400,
        headers: {
          "x-request-id": reqId,
          traceparent,
          ...(traceId ? { "x-trace-id": traceId } : {}),
        },
      },
    );
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/conversations/${encodeURIComponent(id)}`, {
      method: "PATCH",
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
    reqLogger.error("Failed to update conversation on backend", {
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const traceparent = getOrCreateTraceparent(request.headers);
  const traceId = extractTraceId(traceparent);
  const reqId = request.headers.get("x-request-id") || crypto.randomUUID();
  const reqLogger = logger.child({ reqId, traceId, path: `/api/conversations/${id}` });

  const session = await auth();
  if (!session?.user) {
    reqLogger.warn("Unauthorized attempt on delete conversation");
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
    const res = await fetch(`${BACKEND_URL}/api/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
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
    reqLogger.error("Failed to delete conversation on backend", {
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

