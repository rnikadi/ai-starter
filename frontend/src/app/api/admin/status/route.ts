import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:4000";

export async function GET(request: Request) {
  const reqId = request.headers.get("x-request-id") || crypto.randomUUID();
  const reqLogger = logger.child({ reqId, path: "/api/admin/status" });

  const session = await auth();

  if (!session?.user) {
    reqLogger.warn("Unauthorized attempt on /api/admin/status");
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401, headers: { "x-request-id": reqId } },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": reqId,
  };

  if (session.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  if (Array.isArray(session.user.roles)) {
    headers["x-user-roles"] = JSON.stringify(session.user.roles);
  }

  try {
    const backendResponse = await fetch(`${BACKEND_URL}/api/admin/status`, {
      method: "GET",
      headers,
    });

    const data = (await backendResponse.json()) as unknown;
    reqLogger.info("Admin status checked", {
      statusCode: backendResponse.status,
    });
    return NextResponse.json(data, {
      status: backendResponse.status,
      headers: { "x-request-id": reqId },
    });
  } catch (error) {
    reqLogger.error("Failed to reach backend API server at " + BACKEND_URL, {
      err: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error:
          "Could not reach the backend API server. Make sure the backend is running on port 4000.",
      },
      { status: 502, headers: { "x-request-id": reqId } },
    );
  }
}

