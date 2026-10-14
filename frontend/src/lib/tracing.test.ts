import { describe, it, expect } from "vitest";
import { getOrCreateTraceparent, extractTraceId } from "./tracing";

describe("Frontend OpenTelemetry Tracing Utilities", () => {
  it("generates a valid W3C traceparent when none is provided", () => {
    const traceparent = getOrCreateTraceparent(new Headers());
    expect(traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it("preserves an existing valid W3C traceparent", () => {
    const existing = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const headers = new Headers({ traceparent: existing });
    const result = getOrCreateTraceparent(headers);
    expect(result).toBe(existing);
  });

  it("extracts 32-character hex trace ID from traceparent", () => {
    const traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    expect(extractTraceId(traceparent)).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });
});

