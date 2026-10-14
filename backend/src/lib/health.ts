import process from "node:process";
import { isArchestraConfigured } from "../mastra/agents/connection-test-agent.js";
import { getBackendEnv } from "../config/env.js";

export interface LivenessReport {
  status: "healthy";
  service: "ai-starter-backend";
  uptimeSeconds: number;
  timestamp: string;
  node: string;
  memory: {
    heapUsedMb: number;
    rssMb: number;
  };
}

export interface DependencyCheck {
  status: "up" | "down";
  latencyMs: number;
  url?: string;
  error?: string;
}

export interface ReadinessReport {
  status: "ready" | "unhealthy";
  timestamp: string;
  checks: {
    keycloak: DependencyCheck;
    archestra: DependencyCheck;
  };
}

export function getLivenessReport(): LivenessReport {
  const memory = process.memoryUsage();
  return {
    status: "healthy",
    service: "ai-starter-backend",
    uptimeSeconds: Math.round(process.uptime() * 10) / 10,
    timestamp: new Date().toISOString(),
    node: process.version,
    memory: {
      heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 10) / 10,
      rssMb: Math.round((memory.rss / (1024 * 1024)) * 10) / 10,
    },
  };
}

export async function checkKeycloakReadiness(issuerUrl: string): Promise<DependencyCheck> {
  const discoveryUrl = `${issuerUrl.replace(/\/+$/, "")}/.well-known/openid-configuration`;
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(discoveryUrl, { signal: controller.signal });
    clearTimeout(timeout);

    const latencyMs = Math.round(performance.now() - start);
    if (res.ok) {
      return { status: "up", latencyMs, url: discoveryUrl };
    }
    return {
      status: "down",
      latencyMs,
      url: discoveryUrl,
      error: `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Math.round(performance.now() - start),
      url: discoveryUrl,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

export async function checkArchestraReadiness(baseUrl: string): Promise<DependencyCheck> {
  if (!isArchestraConfigured()) {
    return {
      status: "down",
      latencyMs: 0,
      url: baseUrl,
      error: "Archestra environment variables not configured (ARCHESTRA_BASE_URL, ARCHESTRA_VIRTUAL_KEY, or ARCHESTRA_MODEL missing)",
    };
  }

  const env = getBackendEnv();
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const testUrl = `${baseUrl.replace(/\/+$/, "")}/models`;
    const res = await fetch(testUrl, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.ARCHESTRA_VIRTUAL_KEY}`,
      },
    });
    clearTimeout(timeout);

    const latencyMs = Math.round(performance.now() - start);
    if (res.ok || res.status === 401) {
      // 401 means Archestra gateway is reachable and enforcing authentication
      return { status: "up", latencyMs, url: testUrl };
    }

    return {
      status: "down",
      latencyMs,
      url: testUrl,
      error: `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Math.round(performance.now() - start),
      url: baseUrl,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

export async function getReadinessReport(): Promise<{
  statusCode: number;
  report: ReadinessReport;
}> {
  const env = getBackendEnv();
  const keycloakUrl = env.AUTH_KEYCLOAK_INTERNAL_URL || env.AUTH_KEYCLOAK_ISSUER;
  const archestraUrl = env.ARCHESTRA_BASE_URL;
  const [keycloak, archestra] = await Promise.all([
    checkKeycloakReadiness(keycloakUrl),
    checkArchestraReadiness(archestraUrl),
  ]);

  const allUp = keycloak.status === "up" && archestra.status === "up";

  return {
    statusCode: allUp ? 200 : 503,
    report: {
      status: allUp ? "ready" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks: {
        keycloak,
        archestra,
      },
    },
  };
}
