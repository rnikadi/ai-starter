import { describe, it, expect, vi } from "vitest";
import type { ServerResponse } from "node:http";
import { hasRole, hasAnyRole, hasAllRoles, guardRoles } from "./rbac.js";
import type { AuthenticatedUser } from "./auth.js";

describe("RBAC Middleware", () => {
  const user: AuthenticatedUser = {
    id: "user-1",
    roles: ["developer", "viewer"],
  };

  it("checks single role correctly with hasRole", () => {
    expect(hasRole(user, "developer")).toBe(true);
    expect(hasRole(user, "admin")).toBe(false);
  });

  it("checks any role correctly with hasAnyRole", () => {
    expect(hasAnyRole(user, ["admin", "developer"])).toBe(true);
    expect(hasAnyRole(user, ["admin", "superadmin"])).toBe(false);
  });

  it("checks all roles correctly with hasAllRoles", () => {
    expect(hasAllRoles(user, ["developer", "viewer"])).toBe(true);
    expect(hasAllRoles(user, ["developer", "admin"])).toBe(false);
  });

  it("returns true in guardRoles when user has required role", () => {
    const res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
    const allowed = guardRoles(res, user, ["developer"]);
    expect(allowed).toBe(true);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it("returns false and responds 403 in guardRoles when user lacks role", () => {
    const res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
    const allowed = guardRoles(res, user, ["admin"]);
    expect(allowed).toBe(false);
    expect(res.writeHead).toHaveBeenCalledWith(403, {
      "Content-Type": "application/json",
    });
    expect(res.end).toHaveBeenCalled();
  });
});

