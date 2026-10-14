import type { IncomingMessage } from "node:http";

export interface AuthenticatedUser {
  id?: string;
  name?: string;
  email?: string;
  roles: string[];
}

export interface AuthContext {
  authenticated: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

interface KeycloakClaims {
  sub?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  realm_access?: {
    roles?: string[];
  };
  roles?: string[];
}

function extractRolesFromClaims(claims: KeycloakClaims): string[] {
  const roles = claims.realm_access?.roles ?? claims.roles ?? [];
  return Array.isArray(roles)
    ? roles.filter((role: unknown): role is string => typeof role === "string")
    : [];
}

export function extractBearerToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }

  return null;
}

export function parseJwtPayload(token: string): KeycloakClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as unknown;

    if (payload && typeof payload === "object") {
      return payload as KeycloakClaims;
    }

    return null;
  } catch {
    return null;
  }
}

export async function authenticateRequest(req: IncomingMessage): Promise<AuthContext> {
  // 1. Check for Bearer token
  const token = extractBearerToken(req);

  if (token) {
    const claims = parseJwtPayload(token);
    if (!claims) {
      return { authenticated: false, error: "Invalid token format." };
    }

    const roles = extractRolesFromClaims(claims);

    return {
      authenticated: true,
      user: {
        id: claims.sub,
        name: claims.name ?? claims.preferred_username,
        email: claims.email,
        roles,
      },
    };
  }

  // 2. Check for trusted forwarded roles from Frontend Server Action / Route
  const forwardedRolesHeader = req.headers["x-user-roles"];
  if (forwardedRolesHeader && typeof forwardedRolesHeader === "string") {
    try {
      const parsed = JSON.parse(forwardedRolesHeader) as unknown;
      if (Array.isArray(parsed)) {
        const roles = parsed.filter((r: unknown): r is string => typeof r === "string");
        return {
          authenticated: true,
          user: {
            roles,
          },
        };
      }
    } catch {
      // Ignore invalid JSON header and fall through
    }
  }

  return { authenticated: false, error: "Authentication is required." };
}

