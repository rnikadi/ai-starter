/**
 * OpenTelemetry W3C Trace Context Utilities for Frontend API routes
 * Implements W3C Trace Context standard: 00-{trace-id}-{parent-id}-{trace-flags}
 */

export function getOrCreateTraceparent(headers: Headers | Record<string, string | null | undefined>): string {
  const existing =
    headers instanceof Headers
      ? headers.get("traceparent")
      : headers["traceparent"];

  if (existing && existing.startsWith("00-") && existing.split("-").length === 4) {
    return existing;
  }

  // Generate 16-byte (32-hex) trace ID and 8-byte (16-hex) span ID
  const traceBytes = new Uint8Array(16);
  const spanBytes = new Uint8Array(8);
  crypto.getRandomValues(traceBytes);
  crypto.getRandomValues(spanBytes);

  const traceId = Array.from(traceBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const spanId = Array.from(spanBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `00-${traceId}-${spanId}-01`;
}

export function extractTraceId(traceparent: string): string | null {
  const parts = traceparent.split("-");
  return parts.length >= 2 ? parts[1] : null;
}

