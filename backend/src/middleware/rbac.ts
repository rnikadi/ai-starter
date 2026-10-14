import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateRequest, type AuthenticatedUser } from "./auth.js";
import { sendError, UnauthorizedError, ForbiddenError } from "../lib/errors.js";

export function hasRole(user: AuthenticatedUser, role: string): boolean {
  return Array.isArray(user.roles) && user.roles.includes(role);
}

export function hasAnyRole(user: AuthenticatedUser, roles: string[]): boolean {
  if (!Array.isArray(user.roles) || roles.length === 0) {
    return false;
  }
  return roles.some((role) => user.roles.includes(role));
}

export function hasAllRoles(user: AuthenticatedUser, roles: string[]): boolean {
  if (!Array.isArray(user.roles)) {
    return false;
  }
  return roles.every((role) => user.roles.includes(role));
}

export async function guardAuth(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<AuthenticatedUser | null> {
  const auth = await authenticateRequest(req);

  if (!auth.authenticated || !auth.user) {
    sendError(res, new UnauthorizedError(auth.error ?? "Authentication is required."));
    return null;
  }

  return auth.user;
}

export function guardRoles(
  res: ServerResponse,
  user: AuthenticatedUser,
  allowedRoles: string[],
): boolean {
  if (!hasAnyRole(user, allowedRoles)) {
    sendError(
      res,
      new ForbiddenError(
        `Forbidden: Requires one of [${allowedRoles.join(", ")}] roles.`,
      ),
    );
    return false;
  }
  return true;
}
