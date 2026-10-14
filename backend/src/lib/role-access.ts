export type ApplicationRole = "viewer" | "developer" | "admin";

export function hasRole(
  roles: readonly string[],
  requiredRole: ApplicationRole,
): boolean {
  return roles.includes(requiredRole);
}

export function canAccessAdmin(roles: readonly string[]): boolean {
  return hasRole(roles, "admin");
}

export function canAccessAiTesting(roles: readonly string[]): boolean {
  return roles.some((role) => role === "developer" || role === "admin");
}
