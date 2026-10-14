import client from "prom-client";

// Create a dedicated Prometheus Registry
export const register = new client.Registry();

// Enable default Node.js system and process metrics
client.collectDefaultMetrics({
  register,
  prefix: "nodejs_",
});

// 1. HTTP Request Metrics
export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests processed by the backend",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// 2. AI LLM Gateway Metrics
export const aiRequestsTotal = new client.Counter({
  name: "ai_requests_total",
  help: "Total number of AI requests sent to the Archestra gateway",
  labelNames: ["status", "model"],
  registers: [register],
});

export const aiRequestDurationSeconds = new client.Histogram({
  name: "ai_request_duration_seconds",
  help: "Execution duration of AI agent requests in seconds",
  labelNames: ["status", "model"],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30],
  registers: [register],
});

// 3. Database Operations Metrics
export const dbQueryDurationSeconds = new client.Histogram({
  name: "db_query_duration_seconds",
  help: "Database query execution duration in seconds",
  labelNames: ["operation"],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

export const platformConversationsGauge = new client.Gauge({
  name: "platform_conversations_total",
  help: "Total number of conversation threads stored in PostgreSQL",
  registers: [register],
});

export const platformMessagesGauge = new client.Gauge({
  name: "platform_messages_total",
  help: "Total number of conversation messages stored in PostgreSQL",
  registers: [register],
});

export async function getPrometheusMetrics(): Promise<string> {
  return register.metrics();
}

export function getMetricsContentType(): string {
  return register.contentType;
}

