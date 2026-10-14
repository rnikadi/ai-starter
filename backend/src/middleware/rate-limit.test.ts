import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { RateLimiter, applyRateLimit } from "./rate-limit.js";

describe("Rate Limiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      windowMs: 1000,
      max: 2,
    });
  });

  function mockReq(ip = "127.0.0.1"): IncomingMessage {
    return {
      headers: { "x-forwarded-for": ip },
      socket: { remoteAddress: ip },
    } as unknown as IncomingMessage;
  }

  function mockRes(): ServerResponse {
    return {
      setHeader: vi.fn(),
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;
  }

  it("allows requests under the maximum limit", () => {
    const req = mockReq();
    const res1 = limiter.check(req);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(1);

    const res2 = limiter.check(req);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(0);
  });

  it("blocks requests that exceed the limit", () => {
    const req = mockReq();
    limiter.check(req);
    limiter.check(req);
    const res3 = limiter.check(req);
    expect(res3.allowed).toBe(false);
    expect(res3.remaining).toBe(0);
  });

  it("applies rate limit headers and status 429 when blocked", () => {
    const req = mockReq("10.0.0.1");
    const res = mockRes();

    applyRateLimit(req, res, limiter); // request 1 -> OK
    applyRateLimit(req, res, limiter); // request 2 -> OK
    const allowed = applyRateLimit(req, res, limiter); // request 3 -> blocked

    expect(allowed).toBe(false);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "2");
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
    expect(res.writeHead).toHaveBeenCalledWith(429, {
      "Content-Type": "application/json",
    });
    expect(res.end).toHaveBeenCalled();
  });
});

