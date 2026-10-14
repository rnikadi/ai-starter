import { describe, it, expect } from "vitest";
import http from "node:http";
import {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  ConflictError,
  sendError,
} from "./errors.js";
import { ZodError, z } from "zod";

describe("Centralized Error Boundary", () => {
  it("instantiates custom HttpErrors with proper status codes and default error codes", () => {
    const notFound = new NotFoundError("Conversation missing");
    expect(notFound.statusCode).toBe(404);
    expect(notFound.code).toBe("NOT_FOUND");
    expect(notFound.message).toBe("Conversation missing");

    const badReq = new BadRequestError("Invalid format", "CUSTOM_BAD_REQ", { field: "title" });
    expect(badReq.statusCode).toBe(400);
    expect(badReq.code).toBe("CUSTOM_BAD_REQ");
    expect(badReq.details).toEqual({ field: "title" });

    const unauth = new UnauthorizedError();
    expect(unauth.statusCode).toBe(401);
    expect(unauth.code).toBe("UNAUTHORIZED");

    const forbidden = new ForbiddenError();
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.code).toBe("FORBIDDEN");

    const payload = new PayloadTooLargeError();
    expect(payload.statusCode).toBe(413);

    const conflict = new ConflictError("Slug taken");
    expect(conflict.statusCode).toBe(409);
    expect(conflict.code).toBe("CONFLICT");
  });

  it("sendError formats HttpError response with traceId and sends correct HTTP status", async () => {
    const error = new NotFoundError("User record not found");
    let responseCode = 0;
    let responseBody = "";
    let headerVal = "";

    const fakeRes = {
      setHeader(name: string, val: string) {
        if (name === "x-trace-id") headerVal = val;
      },
      writeHead(code: number) {
        responseCode = code;
      },
      end(chunk: string) {
        responseBody = chunk;
      },
    } as unknown as http.ServerResponse;

    sendError(fakeRes, error, "test-trace-id-123");

    expect(responseCode).toBe(404);
    expect(headerVal).toBe("test-trace-id-123");

    const parsed = JSON.parse(responseBody);
    expect(parsed.error).toBe("User record not found");
    expect(parsed.code).toBe("NOT_FOUND");
    expect(parsed.statusCode).toBe(404);
    expect(parsed.traceId).toBe("test-trace-id-123");
  });

  it("sendError formats ZodError into a 400 Bad Request with details", () => {
    const schema = z.object({ title: z.string().min(3) });
    const result = schema.safeParse({ title: "a" });
    expect(result.success).toBe(false);

    let responseCode = 0;
    let responseBody = "";

    const fakeRes = {
      setHeader() {},
      writeHead(code: number) {
        responseCode = code;
      },
      end(chunk: string) {
        responseBody = chunk;
      },
    } as unknown as http.ServerResponse;

    sendError(fakeRes, (result as { error: ZodError }).error, "trace-zod-456");

    expect(responseCode).toBe(400);
    const parsed = JSON.parse(responseBody);
    expect(parsed.code).toBe("VALIDATION_ERROR");
    expect(parsed.statusCode).toBe(400);
    expect(parsed.traceId).toBe("trace-zod-456");
    expect(Array.isArray(parsed.details)).toBe(true);
  });
});

