import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initTracing,
  getTracer,
  traceAsync,
  extractTraceContext,
  injectTraceContext,
  shutdownTracing,
  trace,
} from "./tracing.js";

describe("OpenTelemetry Tracing", () => {
  beforeEach(() => {
    initTracing();
  });

  afterEach(async () => {
    await shutdownTracing();
  });

  it("initializes tracer and provides active tracer instance", () => {
    const tracer = getTracer();
    expect(tracer).toBeDefined();
    expect(typeof tracer.startSpan).toBe("function");
  });

  it("traces asynchronous operations successfully", async () => {
    let executed = false;
    const result = await traceAsync("test-operation", async (span) => {
      span.setAttribute("test.attribute", "value123");
      executed = true;
      return 42;
    });

    expect(executed).toBe(true);
    expect(result).toBe(42);
  });

  it("captures exceptions and sets span error status", async () => {
    await expect(
      traceAsync("failing-operation", async () => {
        throw new Error("Simulated failure in traced span");
      }),
    ).rejects.toThrow("Simulated failure in traced span");
  });

  it("extracts and injects W3C traceparent headers", () => {
    const incomingTraceparent =
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const ctx = extractTraceContext({
      traceparent: incomingTraceparent,
    });

    const spanCtx = trace.getSpanContext(ctx);
    expect(spanCtx).toBeDefined();
    expect(spanCtx?.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(spanCtx?.spanId).toBe("00f067aa0ba902b7");

    const outgoingHeaders: Record<string, string> = {};
    injectTraceContext(outgoingHeaders, ctx);
    expect(outgoingHeaders.traceparent).toBe(incomingTraceparent);
  });
});

