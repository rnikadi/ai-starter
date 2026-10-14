import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { connection } from "next/server";
import { AiTestPanel } from "@/app/dashboard/ai-test-panel";
import { appConfig } from "@/lib/app-config";
import { KeycloakSignInButton } from "@/components/auth/keycloak-sign-in-button";
import { KeycloakSignOutButton } from "@/components/auth/keycloak-sign-out-button";

const AI_ACCESS_ROLES = new Set<string>(["developer", "admin"]);

async function HomeContent() {
  await connection();
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="page-shell">
        <section className="login-card">
          <div className="brand-mark" aria-hidden="true">
            AI
          </div>

          <p className="eyebrow">AI PLATFORM ENGINEERING</p>

          <h1>{appConfig.displayName}</h1>

          <p className="muted">
            Configure, validate, and explore DevOps proof-of-concept
            environments through a single workspace.
          </p>

          <div className="feature-list">
            <div>
              <span>01</span>
              <span>Authenticated workspace</span>
            </div>
            <div>
              <span>02</span>
              <span>Role-based access control</span>
            </div>
            <div>
              <span>03</span>
              <span>AI provider connectivity test</span>
            </div>
          </div>

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
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Go to dashboard">
          <span className="brand-mark small">AI</span>
          <span>{appConfig.displayName}</span>
        </Link>

        <div className="account-area">
          <div className="account-details">
            <span className="account-name">
              {session.user.name ??
                session.user.email ??
                "Authenticated user"}
            </span>
            <span className="account-roles">
              {roles.length
                ? roles.join(" · ")
                : "No realm roles detected"}
            </span>
          </div>

          {isAdmin && (
            <Link className="access-pill allowed" href="/admin">
              Admin console
            </Link>
          )}

          {isAdmin && (
            <Link className="access-pill allowed" href="/admin">
              Admin console
            </Link>
          )}

          <KeycloakSignOutButton />
        </div>
      </header>

      <section className="welcome-section">
        <p className="eyebrow">WORKSPACE / OVERVIEW</p>
        <h1>{appConfig.displayName + " workspace"}</h1>
        <p className="muted">
          Validate the AI connection and confirm that identity-based access
          controls are working.
        </p>
      </section>

      <section className="status-grid" aria-label="Service status">
        <article className="status-card">
          <span className="status-dot" />
          <div>
            <p className="card-label">Identity</p>
            <h2>Authenticated</h2>
          </div>
          <span className="card-detail">Keycloak / OIDC</span>
        </article>

        <article className="status-card">
          <span className="status-dot neutral" />
          <div>
            <p className="card-label">Authorization</p>
            <h2>{canTestAI ? "AI access granted" : "Read-only access"}</h2>
          </div>
          <span className="card-detail">
            {roles.length} role(s) in session
          </span>
        </article>

        <article className="status-card">
          <span className="status-dot neutral" />
          <div>
            <p className="card-label">AI gateway</p>
            <h2>Connection test</h2>
          </div>
          <span className="card-detail">Archestra → model</span>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">INTEGRATION</p>
            <h2>Test AI connectivity</h2>
          </div>

          <span
            className={`access-pill ${
              canTestAI ? "allowed" : "restricted"
            }`}
          >
            {canTestAI ? "Developer access" : "Restricted"}
          </span>
        </div>

        <p className="muted">
          Send a short prompt through the application API to the configured
          Mastra agent and Archestra gateway.
        </p>

        <AiTestPanel canTestAI={canTestAI} />
      </section>

      <footer className="workspace-footer">
        {appConfig.displayName} <span>·</span> Local development
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="page-shell">
          <section className="login-card">
            <p className="eyebrow">AI PLATFORM ENGINEERING</p>
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
