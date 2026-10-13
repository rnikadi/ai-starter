import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,

  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
      issuer: process.env.AUTH_KEYCLOAK_ISSUER!,
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, profile, account }) {
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

      return session;
    },
  },
});
