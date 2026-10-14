import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { getFrontendEnv } from "@/lib/env";

const BACKEND_URL = getFrontendEnv().BACKEND_URL;

export async function POST(request: Request) {
  const reqId = request.headers.get("x-request-id") || crypto.randomUUID();
  const reqLogger = logger.child({ reqId, path: "/api/ai/test" });

  const session = await auth();

  if (!session?.user) {
    reqLogger.warn("Unauthorized attempt on /api/ai/test");
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401, headers: { "x-request-id": reqId } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: { "x-request-id": reqId } },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": reqId,
  };

  if (session.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  // Forward verified session roles to backend
  if (Array.isArray(session.user.roles)) {
    headers["x-user-roles"] = JSON.stringify(session.user.roles);
  }

  try {
    const backendResponse = await fetch(`${BACKEND_URL}/api/ai/test`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = (await backendResponse.json()) as unknown;
    if (backendResponse.status >= 500) {
      reqLogger.error("Backend error received on /api/ai/test", {
        statusCode: backendResponse.status,
        data,
      });
    } else if (backendResponse.status >= 400) {
      reqLogger.warn("Backend rejected request on /api/ai/test", {
        statusCode: backendResponse.status,
        data,
      });
    } else {
      reqLogger.info("Backend response received on /api/ai/test", {
        statusCode: backendResponse.status,
      });
    }
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

