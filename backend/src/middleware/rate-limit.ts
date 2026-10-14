import type { IncomingMessage, ServerResponse } from "node:http";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: IncomingMessage) => string;
}

export class RateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private windowMs: number;
  private max: number;
  private keyGenerator: (req: IncomingMessage) => string;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.keyGenerator =
      options.keyGenerator ??
      ((req) => {
        const forwarded = req.headers["x-forwarded-for"];
        const ip =
          typeof forwarded === "string"
            ? forwarded.split(",")[0].trim()
            : req.socket.remoteAddress || "127.0.0.1";
        return ip;
      });
  }

  check(req: IncomingMessage): {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
  } {
    const key = this.keyGenerator(req);
    const now = Date.now();

    const record = this.store.get(key);

    if (!record || now > record.resetAt) {
      const resetAt = now + this.windowMs;
      this.store.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        limit: this.max,
        remaining: this.max - 1,
        resetTime: resetAt,
      };
    }

    record.count += 1;
    const remaining = Math.max(0, this.max - record.count);
    const allowed = record.count <= this.max;

    return {
      allowed,
      limit: this.max,
      remaining,
      resetTime: record.resetAt,
    };
  }

  reset(): void {
    this.store.clear();
  }
}

// Pre-configured rate limiters
export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests/minute
});

export const aiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 AI prompts/minute
});

export function applyRateLimit(
  req: IncomingMessage,
  res: ServerResponse,
  limiter: RateLimiter = apiRateLimiter,
): boolean {
  const result = limiter.check(req);

  res.setHeader("X-RateLimit-Limit", result.limit.toString());
  res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
  res.setHeader(
    "X-RateLimit-Reset",
    Math.ceil(result.resetTime / 1000).toString(),
  );

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    res.setHeader("Retry-After", Math.max(1, retryAfter).toString());
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Too many requests. Please wait before retrying.",
        retryAfterSeconds: Math.max(1, retryAfter),
      }),
    );
    return false;
  }

  return true;
}

