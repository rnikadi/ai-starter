import type { ServerResponse } from "node:http";
import { ZodError } from "zod";
import { getActiveTraceId } from "./tracing.js";
import { logger } from "./logger.js";

/**
 * Base HTTP Error containing HTTP status code, machine-readable error code,
 * and optional details payload (aligned with RFC 9457 Problem Details).
 */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string = "Bad Request", code: string = "BAD_REQUEST", details?: unknown) {
    super(400, message, code, details);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string = "Authentication is required", code: string = "UNAUTHORIZED") {
    super(401, message, code);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string = "Forbidden: insufficient permissions", code: string = "FORBIDDEN") {
    super(403, message, code);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = "Resource not found", code: string = "NOT_FOUND") {
    super(404, message, code);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends HttpError {
  constructor(message: string = "Resource conflict", code: string = "CONFLICT") {
    super(409, message, code);
    this.name = "ConflictError";
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(
    message: string = "Payload exceeds maximum allowed size of 1MB",
    code: string = "PAYLOAD_TOO_LARGE",
  ) {
    super(413, message, code);
    this.name = "PayloadTooLargeError";
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message: string = "Service temporarily unavailable", code: string = "SERVICE_UNAVAILABLE") {
    super(503, message, code);
    this.name = "ServiceUnavailableError";
  }
}

export interface ErrorResponseBody {
  error: string;
  code: string;
  statusCode: number;
  traceId?: string;
  details?: unknown;
}

/**
 * Centralized error response dispatcher.
 * Automatically resolves OpenTelemetry trace ID, formats RFC-aligned JSON,
 * sets response headers, and logs the error with trace context.
 */
export function sendError(
  res: ServerResponse,
  err: unknown,
  fallbackTraceId?: string,
): void {
  const traceId = fallbackTraceId || getActiveTraceId();

  let statusCode = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "Internal Server Error";
  let details: unknown = undefined;

  if (err instanceof HttpError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = err.issues[0]?.message ?? "Validation failed";
    details = err.issues;
  } else if (err instanceof Error) {
    message = err.message;
  }

  // Set trace header for downstream correlation
  if (traceId) {
    res.setHeader("x-trace-id", traceId);
  }

  const payload: ErrorResponseBody = {
    error: message,
    code,
    statusCode,
    ...(traceId ? { traceId } : {}),
    ...(details !== undefined ? { details } : {}),
  };

  if (statusCode >= 500) {
    logger.error(`HTTP 5xx Server Error: ${message}`, {
      statusCode,
      code,
      traceId,
      err: err instanceof Error ? err.stack : String(err),
    });
  } else if (statusCode >= 400) {
    logger.warn(`HTTP 4xx Client Error: ${message}`, {
      statusCode,
      code,
      traceId,
    });
  }

  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

