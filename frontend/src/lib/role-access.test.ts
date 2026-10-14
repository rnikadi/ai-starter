import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  canAccessAiTesting,
  hasRole,
} from "./role-access";

describe("role access policy", () => {
  it("grants admin access to an admin role", () => {
    expect(canAccessAdmin(["admin"])).toBe(true);
  });

  it("does not grant admin access to a developer", () => {
    expect(canAccessAdmin(["developer"])).toBe(false);
  });

  it("does not grant admin access to a viewer", () => {
    expect(canAccessAdmin(["viewer"])).toBe(false);
  });

  it("does not grant admin access when roles are empty", () => {
    expect(canAccessAdmin([])).toBe(false);
  });

  it("allows developers to access AI testing", () => {
    expect(canAccessAiTesting(["developer"])).toBe(true);
  });

  it("allows admins to access AI testing", () => {
    expect(canAccessAiTesting(["admin"])).toBe(true);
  });

  it("does not allow viewers to access AI testing", () => {
    expect(canAccessAiTesting(["viewer"])).toBe(false);
  });

  it("checks for an exact role match", () => {
    expect(hasRole(["developer", "viewer"], "viewer")).toBe(true);
    expect(hasRole(["superadmin"], "admin")).toBe(false);
  });
});
