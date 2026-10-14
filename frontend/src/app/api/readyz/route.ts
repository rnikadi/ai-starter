import { NextResponse } from "next/server";
import { getFrontendEnv } from "@/lib/env";

const BACKEND_URL = getFrontendEnv().BACKEND_URL;

export async function GET() {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const backendRes = await fetch(`${BACKEND_URL}/healthz`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Math.round(performance.now() - start);

    if (backendRes.ok) {
      return NextResponse.json({
        status: "ready",
        timestamp: new Date().toISOString(),
        checks: {
          backend: {
            status: "up",
            latencyMs,
            url: `${BACKEND_URL}/healthz`,
          },
        },
      });
    }

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        checks: {
          backend: {
            status: "down",
            latencyMs,
            error: `HTTP ${backendRes.status}`,
          },
        },
      },
      { status: 503 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        checks: {
          backend: {
            status: "down",
            latencyMs: Math.round(performance.now() - start),
            error: error instanceof Error ? error.message : "Connection failed",
          },
        },
      },
      { status: 503 },
    );
  }
}

