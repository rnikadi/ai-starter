import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { connection } from "next/server";
import { ConversationWorkspace } from "@/app/dashboard/conversation-workspace";
import { appConfig } from "@/lib/app-config";
import { KeycloakSignInButton } from "@/components/auth/keycloak-sign-in-button";
import { UserAvatarDropdown } from "@/components/auth/user-avatar-dropdown";

const AI_ACCESS_ROLES = new Set<string>(["developer", "admin"]);

async function HomeContent() {
  await connection();
  let session = null;
  try {
    session = await auth();
  } catch {
    // If a stale or invalid session cookie is present, treat as unauthenticated
    session = null;
  }

  if (!session?.user) {
    return (
      <main className="page-shell">
        <section className="login-card">
          <div className="brand-mark" aria-hidden="true">
            AI
          </div>

          <p className="eyebrow">AI APPLICATION STARTER</p>

          <h1>{appConfig.displayName}</h1>

          <KeycloakSignInButton />

          <p className="security-note">
            Sign-in is handled by your configured identity provider.
          </p>
        </section>

        <footer className="page-footer">
          {appConfig.displayName}
        </footer>
      </main>
    );
  }

  const roles: string[] = Array.isArray(session.user.roles)
    ? session.user.roles.filter(
        (role: unknown): role is string => typeof role === "string",
      )
    : [];

  const canTestAI = roles.some((role: string) =>
    AI_ACCESS_ROLES.has(role),
  );

  const isAdmin = roles.includes("admin");


  return (
    <div className="chat-page">
      <header className="chat-header">
        <Link className="brand" href="/" aria-label="Go to dashboard">
          <span className="brand-mark small">AI</span>
          <span className="brand-title">{appConfig.displayName}</span>
        </Link>

        <UserAvatarDropdown
          user={session.user}
          roles={roles}
          isAdmin={isAdmin}
        />
      </header>

      <ConversationWorkspace
        canTestAI={canTestAI}
        isAdmin={isAdmin}
        userRoles={roles}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="page-shell">
          <section className="login-card">
            <p className="eyebrow">AI APPLICATION STARTER</p>
            <h1>Loading your workspace</h1>
            <p className="muted">Checking your authentication session...</p>
          </section>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
