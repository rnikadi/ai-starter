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

export const aiTokensTotal = new client.Counter({
  name: "ai_tokens_total",
  help: "Total number of tokens consumed by AI LLM requests",
  labelNames: ["model", "type"],
  registers: [register],
});

export const aiEstimatedCostDollarsTotal = new client.Counter({
  name: "ai_estimated_cost_dollars_total",
  help: "Total estimated cost in USD for LLM token usage",
  labelNames: ["model"],
  registers: [register],
});

// Standard FinOps pricing reference per million tokens ($/1M tokens)
const MODEL_PRICING_PER_MILLION: Record<
  string,
  { prompt: number; completion: number }
> = {
  "gpt-4o": { prompt: 2.5, completion: 10.0 },
  "gpt-4o-mini": { prompt: 0.15, completion: 0.6 },
  "claude-3-5-sonnet": { prompt: 3.0, completion: 15.0 },
  "claude-3-5-haiku": { prompt: 0.8, completion: 4.0 },
  "claude-3-haiku": { prompt: 0.25, completion: 1.25 },
  default: { prompt: 0.5, completion: 1.5 },
};

export function calculateEstimatedCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const normalizedModel = Object.keys(MODEL_PRICING_PER_MILLION).find((key) =>
    model.toLowerCase().includes(key),
  );
  const pricing =
    MODEL_PRICING_PER_MILLION[normalizedModel || "default"] ??
    MODEL_PRICING_PER_MILLION.default;

  const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
  const completionCost = (completionTokens / 1_000_000) * pricing.completion;

  return promptCost + completionCost;
}

export function recordAiTokenUsage(
  model: string,
  promptTokens: number,
  completionTokens: number,
): void {
  const safePrompt = Math.max(0, Math.round(promptTokens));
  const safeCompletion = Math.max(0, Math.round(completionTokens));

  if (safePrompt > 0) {
    aiTokensTotal.inc({ model, type: "prompt" }, safePrompt);
  }
  if (safeCompletion > 0) {
    aiTokensTotal.inc({ model, type: "completion" }, safeCompletion);
  }

  const cost = calculateEstimatedCost(model, safePrompt, safeCompletion);
  if (cost > 0) {
    aiEstimatedCostDollarsTotal.inc({ model }, cost);
  }
}

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

