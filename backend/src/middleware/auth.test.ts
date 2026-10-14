import { describe, it, expect } from "vitest";
import { parseJwtPayload, extractBearerToken } from "./auth.js";
import type { IncomingMessage } from "node:http";

describe("auth middleware", () => {
  it("extracts bearer token from authorization header", () => {
    const req = {
      headers: {
        authorization: "Bearer my-test-token",
      },
    } as unknown as IncomingMessage;

    expect(extractBearerToken(req)).toBe("my-test-token");
  });

  it("returns null if authorization header is missing or not bearer", () => {
    const req1 = { headers: {} } as unknown as IncomingMessage;
    const req2 = { headers: { authorization: "Basic 123" } } as unknown as IncomingMessage;

    expect(extractBearerToken(req1)).toBeNull();
    expect(extractBearerToken(req2)).toBeNull();
  });

  it("parses JWT payload and extracts roles", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-123",
        name: "Test User",
        realm_access: {
          roles: ["developer", "viewer"],
        },
      }),
    ).toString("base64url");
    const token = `${header}.${payload}.dummy-signature`;

    const claims = parseJwtPayload(token);
    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe("user-123");
    expect(claims?.realm_access?.roles).toEqual(["developer", "viewer"]);
  });

  it("handles malformed tokens gracefully", () => {
    expect(parseJwtPayload("not-a-token")).toBeNull();
    expect(parseJwtPayload("a.b")).toBeNull();
  });
});

