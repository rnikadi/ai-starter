import {
  trace,
  context,
  propagation,
  SpanStatusCode,
  SpanKind,
  type Span,
  type Tracer,
  type Context,
  type SpanOptions,
} from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import type { IncomingHttpHeaders } from "node:http";
import { getBackendEnv, validateBackendEnv } from "../config/env.js";

// Ensure global W3C Trace Context propagator is configured
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

let provider: BasicTracerProvider | null = null;
let initialized = false;

export function initTracing(): Tracer {
  if (initialized && provider) {
    return trace.getTracer("ai-starter-backend", "0.1.0");
  }

  const envValidation = validateBackendEnv(process.env);
  const env = envValidation.valid && envValidation.data ? envValidation.data : null;

  const isEnabled = env?.OTEL_TRACING_ENABLED ?? (process.env.OTEL_TRACING_ENABLED !== "false");

  const endpoint =
    env?.OTEL_EXPORTER_OTLP_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    (process.env.DOCKER_TEMPO_URL ? `${process.env.DOCKER_TEMPO_URL}/v1/traces` : "http://localhost:4318/v1/traces");

  const resource = resourceFromAttributes({
    "service.name": env?.OTEL_SERVICE_NAME || process.env.OTEL_SERVICE_NAME || "ai-starter-backend",
    "service.version": "0.1.0",
    "deployment.environment": env?.NODE_ENV || process.env.NODE_ENV || "development",
  });

  const spanProcessors = [];

  if (isEnabled) {
    try {
      const exporter = new OTLPTraceExporter({
        url: endpoint,
        timeoutMillis: 3000,
      });

      spanProcessors.push(
        new BatchSpanProcessor(exporter, {
          maxQueueSize: 2048,
          maxExportBatchSize: 512,
          scheduledDelayMillis: 1000,
          exportTimeoutMillis: 3000,
        }),
      );
    } catch (err) {
      console.warn("[tracing] Could not initialize OTLPTraceExporter:", err);
    }
  }

  provider = new BasicTracerProvider({
    resource,
    spanProcessors,
  });

  trace.setGlobalTracerProvider(provider);
  initialized = true;

  return trace.getTracer("ai-starter-backend", "0.1.0");
}

export function getTracer(name = "ai-starter-backend", version = "0.1.0"): Tracer {
  if (!initialized) {
    return initTracing();
  }
  return trace.getTracer(name, version);
}

export function extractTraceContext(
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>,
): Context {
  // Normalize header map for OpenTelemetry propagator
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string") {
      normalized[k.toLowerCase()] = v;
    } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") {
      normalized[k.toLowerCase()] = v[0];
    }
  }
  return propagation.extract(context.active(), normalized);
}

export function injectTraceContext(
  headers: Record<string, string>,
  ctx: Context = context.active(),
): void {
  propagation.inject(ctx, headers);
}

export async function traceAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options: SpanOptions = {},
  parentContext?: Context,
): Promise<T> {
  const tracer = getTracer();
  const parent = parentContext ?? context.active();
  const span = tracer.startSpan(name, options, parent);
  const activeCtx = trace.setSpan(parent, span);

  return context.with(activeCtx, async () => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) {
        span.recordException(error);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

export async function shutdownTracing(): Promise<void> {
  if (provider) {
    try {
      await provider.shutdown();
    } catch (err) {
      console.warn("[tracing] Error shutting down TracerProvider:", err);
    } finally {
      provider = null;
      initialized = false;
    }
  }
}

export { trace, context, SpanStatusCode, SpanKind, type Span, type Context };
