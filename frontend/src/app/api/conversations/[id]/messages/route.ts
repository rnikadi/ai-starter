import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { getFrontendEnv } from "@/lib/env";

const BACKEND_URL = getFrontendEnv().BACKEND_URL;

function buildHeaders(session: { accessToken?: string; user?: { roles?: string[]; id?: string; email?: string | null } }, reqId: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": reqId,
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
  const reqId = request.headers.get("x-request-id") || crypto.randomUUID();
  const reqLogger = logger.child({ reqId, path: `/api/conversations/${id}/messages` });

  const session = await auth();
  if (!session?.user) {
    reqLogger.warn("Unauthorized attempt on conversation messages");
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401, headers: { "x-request-id": reqId } },
    );
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/conversations/${encodeURIComponent(id)}/messages`, {
      method: "GET",
      headers: buildHeaders(session, reqId),
    });

    const data = (await res.json()) as unknown;
    return NextResponse.json(data, {
      status: res.status,
      headers: { "x-request-id": reqId },
    });
  } catch (err) {
    reqLogger.error("Failed to fetch conversation messages from backend", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not reach backend API server." },
      { status: 502, headers: { "x-request-id": reqId } },
    );
  }
}

