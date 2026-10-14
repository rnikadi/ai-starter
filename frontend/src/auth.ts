import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

const envPath = fs.existsSync(".env.local")
  ? path.resolve(".env.local")
  : path.resolve("..", ".env.local");
dotenv.config({ path: envPath });

interface KeycloakRoleClaims {
  realm_access?: {
    roles?: string[];
  };
}

function extractRoles(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const claims = value as KeycloakRoleClaims;
  const roles = claims.realm_access?.roles;

  return Array.isArray(roles)
    ? roles.filter((role: unknown): role is string => typeof role === "string")
    : [];
}

function extractIdTokenRoles(idToken: string | undefined): string[] {
  if (!idToken) {
    return [];
  }

  try {
    const payload = idToken.split(".")[1];

    if (!payload) {
      return [];
    }

    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as unknown;

    return extractRoles(claims);
  } catch {
    return [];
  }
}

const keycloakIssuer =
  process.env.AUTH_KEYCLOAK_ISSUER ||
  "http://localhost:8080/realms/ai-starter";

const internalKeycloakUrl = process.env.AUTH_KEYCLOAK_INTERNAL_URL;

// When running inside Docker Compose, route server-to-server requests to internal Docker DNS
// while keeping the public issuer (http://localhost:8080/...) for browser redirects and token validation
if (typeof globalThis.fetch === "function" && internalKeycloakUrl) {
  const originalFetch = globalThis.fetch;
  const publicOrigin = new URL(keycloakIssuer).origin;
  const internalOrigin = new URL(internalKeycloakUrl).origin;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.href;
    } else {
      url = input.url;
    }

    if (url.startsWith(publicOrigin)) {
      const rewrittenUrl = url.replace(publicOrigin, internalOrigin);
      if (input instanceof Request) {
        return originalFetch(new Request(rewrittenUrl, input), init);
      }
      return originalFetch(rewrittenUrl, init);
    }

    return originalFetch(input, init);
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ||
    "ai-starter-local-auth-secret-do-not-use-in-production-min32chars",

  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID || "ai-starter-web",
      clientSecret:
        process.env.AUTH_KEYCLOAK_SECRET || "ai-starter-kit-local-client-secret",
      issuer: keycloakIssuer,
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, profile, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }

      if (profile) {
        const profileRoles = extractRoles(profile);

        token.roles =
          profileRoles.length > 0
            ? profileRoles
            : extractIdTokenRoles(account?.id_token);
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        const roles: string[] = Array.isArray(token.roles)
          ? token.roles.filter(
              (role: unknown): role is string => typeof role === "string",
            )
          : [];

        session.user.roles = roles;
      }

      if (typeof token.accessToken === "string") {
        session.accessToken = token.accessToken;
      }

      return session;
    },
  },
});
