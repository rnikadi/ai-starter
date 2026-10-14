import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessAdmin } from "@/lib/role-access";
import { appConfig } from "@/lib/app-config";
import { UserAvatarDropdown } from "@/components/auth/user-avatar-dropdown";
import { AdminConsole } from "@/app/admin/admin-console";

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
    <div className="admin-page-container">
      <header className="chatgpt-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link className="brand" href="/" aria-label="Go to dashboard">
            <span className="brand-mark small">AI</span>
            <span className="brand-title">{appConfig.displayName}</span>
          </Link>
          <span className="admin-tag-badge">Admin</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/" className="back-chat-link">
            ← Back to Chat
          </Link>
          <UserAvatarDropdown
            user={session.user}
            roles={roles}
            isAdmin={true}
            isInAdminPage={true}
          />
        </div>
      </header>

      <AdminConsole user={session.user} roles={roles} />
    </div>
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
