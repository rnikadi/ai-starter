import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessAdmin } from "@/lib/role-access";
import { appConfig } from "@/lib/app-config";
import { KeycloakSignOutButton } from "@/components/auth/keycloak-sign-out-button";

async function AdminContent() {
  let session = null;
  try {
    session = await auth();
  } catch {
    redirect("/");
  }

  if (!session?.user) {
    redirect("/");
  }

  const roles: string[] = Array.isArray(session.user.roles)
    ? session.user.roles.filter(
        (role: unknown): role is string => typeof role === "string",
      )
    : [];

  if (!canAccessAdmin(roles)) {
    redirect("/");
  }

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
            <span className="account-roles">{roles.join(" · ")}</span>
          </div>
          <KeycloakSignOutButton />
        </div>
      </header>

      <section className="welcome-section">
        <p className="eyebrow">WORKSPACE / ADMINISTRATION</p>
        <h1>Admin console</h1>
        <p className="muted">
          Administrative access is restricted to users with the Keycloak
          admin realm role.
        </p>
      </section>

      <section className="status-grid" aria-label="Admin account status">
        <article className="status-card">
          <span className="status-dot" />
          <div>
            <p className="card-label">Identity</p>
            <h2>Authenticated</h2>
          </div>
          <span className="card-detail">Keycloak / OIDC</span>
        </article>

        <article className="status-card">
          <span className="status-dot" />
          <div>
            <p className="card-label">Authorization</p>
            <h2>Administrator</h2>
          </div>
          <span className="card-detail">Admin role verified</span>
        </article>

        <article className="status-card">
          <span className="status-dot neutral" />
          <div>
            <p className="card-label">Admin capabilities</p>
            <h2>Initial phase</h2>
          </div>
          <span className="card-detail">Access verification only</span>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ADMINISTRATION</p>
            <h2>Admin access is active</h2>
          </div>
          <span className="access-pill allowed">Authorized</span>
        </div>

        <p className="muted">
          This initial version verifies administrator identity and access.
          User management, role editing, and other administrative operations
          have not been enabled.
        </p>

        <p>
          <Link href="/">Return to workspace</Link>
        </p>
      </section>

      <footer className="workspace-footer">
        {appConfig.displayName} <span>·</span> Admin console
      </footer>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="page-shell">
          <section className="login-card">
            <p className="eyebrow">WORKSPACE / ADMINISTRATION</p>
            <h1>Loading admin console</h1>
            <p className="muted">
              Checking your authentication and permissions...
            </p>
          </section>
        </main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
