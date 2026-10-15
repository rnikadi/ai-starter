"use client";

import { useState } from "react";
import { appConfig } from "@/lib/app-config";

interface AdminConsoleProps {
  user?: {
    name?: string | null;
    email?: string | null;
  };
  roles?: string[];
  initialTab?: AdminTab;
}

type AdminTab = "overview" | "database" | "users" | "consoles" | "settings";

export function AdminConsole({
  user,
  roles = [],
  initialTab = "overview",
}: AdminConsoleProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function handleClearData() {
    if (
      !confirm(
        "Are you sure you want to delete all conversations and messages from PostgreSQL?",
      )
    ) {
      return;
    }

    setClearing(true);
    setNotice("");
    setError("");

    try {
      const res = await fetch("/api/admin/conversations/clear", {
        method: "POST",
      });
      if (res.ok) {
        setNotice(
          "All platform conversations and messages have been successfully cleared from PostgreSQL.",
        );
      } else {
        setError("Failed to clear platform conversations.");
      }
    } catch {
      setError("Error communicating with backend server.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="admin-layout">
      {/* Left-Hand Navigation Menu Pane */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <span className="admin-menu-label">ADMINISTRATION</span>
        </div>

        <nav className="admin-nav-menu">
          <button
            type="button"
            className={`admin-nav-item ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <span className="admin-nav-icon">📊</span>
            <span>Overview</span>
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeTab === "database" ? "active" : ""}`}
            onClick={() => setActiveTab("database")}
          >
            <span className="admin-nav-icon">🗄️</span>
            <span>Database</span>
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <span className="admin-nav-icon">👥</span>
            <span>Users & Roles</span>
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeTab === "consoles" ? "active" : ""}`}
            onClick={() => setActiveTab("consoles")}
          >
            <span className="admin-nav-icon">🔗</span>
            <span>Consoles & Links</span>
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <span className="admin-nav-icon">⚙️</span>
            <span>Settings</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Pane */}
      <section className="admin-content-pane">
        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="admin-tab-view">
            <div className="admin-panel-card">
              <h2>Overview</h2>
              <p className="muted">
                Welcome to the administration console. Manage platform data, role
                permissions, and access external infrastructure services.
              </p>

              <div className="admin-info-box">
                <div className="admin-info-row">
                  <span className="admin-info-key">Logged in as</span>
                  <span className="admin-info-val">
                    {user?.name || user?.email || "Admin User"}
                  </span>
                </div>
                <div className="admin-info-row">
                  <span className="admin-info-key">Email</span>
                  <span className="admin-info-val">{user?.email || "—"}</span>
                </div>
                <div className="admin-info-row">
                  <span className="admin-info-key">Assigned Roles</span>
                  <span className="admin-info-val">
                    {roles.length > 0 ? roles.join(", ") : "admin"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Database */}
        {activeTab === "database" && (
          <div className="admin-tab-view">
            <div className="admin-panel-card">
              <h2>Database & Storage Management</h2>
              <p className="muted">
                Manage conversation history and message persistence stored in PostgreSQL.
              </p>

              {notice && <div className="notice-banner success">{notice}</div>}
              {error && <div className="notice-banner error">{error}</div>}

              <div className="admin-danger-section">
                <h3>Clear Chat History</h3>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                  Purge all saved conversation threads and model responses from the database.
                  This action cannot be undone.
                </p>

                <button
                  type="button"
                  className="danger-button"
                  onClick={handleClearData}
                  disabled={clearing}
                >
                  {clearing ? "Clearing data..." : "Clear All Conversations"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Users & Roles */}
        {activeTab === "users" && (
          <div className="admin-tab-view">
            <div className="admin-panel-card">
              <h2>Users & Role Permissions</h2>
              <p className="muted">
                Access capabilities are governed by Keycloak realm roles assigned to the user token.
              </p>

              <div className="admin-roles-table">
                <div className="admin-role-row">
                  <div className="admin-role-badge-col">
                    <span className="role-pill-badge viewer">viewer</span>
                  </div>
                  <div>
                    <strong>Viewer</strong>
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                      Read-only access. Can browse past conversation threads, view prompts and AI responses. Prompt execution is disabled.
                    </p>
                  </div>
                </div>

                <div className="admin-role-row">
                  <div className="admin-role-badge-col">
                    <span className="role-pill-badge developer">developer</span>
                  </div>
                  <div>
                    <strong>Developer</strong>
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                      Full AI workspace access. Can create new threads, submit prompts to Archestra LLM gateway, and persist chat threads.
                    </p>
                  </div>
                </div>

                <div className="admin-role-row">
                  <div className="admin-role-badge-col">
                    <span className="role-pill-badge admin">admin</span>
                  </div>
                  <div>
                    <strong>Administrator</strong>
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                      Full developer capabilities plus access to this administration console, database purge controls, and direct infrastructure links.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Consoles & Links */}
        {activeTab === "consoles" && (
          <div className="admin-tab-view">
            <div className="admin-panel-card">
              <h2>Infrastructure Consoles</h2>
              <p className="muted">
                Direct access to supporting platform services.
              </p>

              <div className="admin-links-grid">
                <a
                  href="http://localhost:8080"
                  target="_blank"
                  rel="noreferrer"
                  className="admin-link-card"
                >
                  <span className="admin-link-title">Keycloak Admin</span>
                  <span className="admin-link-desc">Manage realms, users, client scopes, and role mappings.</span>
                  <span className="admin-link-url">localhost:8080 ↗</span>
                </a>

                <a
                  href="http://localhost:3000"
                  target="_blank"
                  rel="noreferrer"
                  className="admin-link-card"
                >
                  <span className="admin-link-title">Archestra Gateway</span>
                  <span className="admin-link-desc">Inspect model routing, virtual keys, and gateway telemetry.</span>
                  <span className="admin-link-url">localhost:3000 ↗</span>
                </a>

                <a
                  href="http://localhost:3002"
                  target="_blank"
                  rel="noreferrer"
                  className="admin-link-card"
                >
                  <span className="admin-link-title">Grafana Observability</span>
                  <span className="admin-link-desc">View platform metrics, Prometheus graphs, and Loki logs.</span>
                  <span className="admin-link-url">localhost:3002 ↗</span>
                </a>

                <a
                  href="http://localhost:9090"
                  target="_blank"
                  rel="noreferrer"
                  className="admin-link-card"
                >
                  <span className="admin-link-title">Prometheus Metrics</span>
                  <span className="admin-link-desc">Direct query interface for metrics and container scrapes.</span>
                  <span className="admin-link-url">localhost:9090 ↗</span>
                </a>

                <a
                  href="http://localhost:3002/explore?schemaVersion=1&panes=%7B%22loki%22:%7B%22datasource%22:%22loki%22%7D%7D"
                  target="_blank"
                  rel="noreferrer"
                  className="admin-link-card"
                >
                  <span className="admin-link-title">Loki Log Aggregation</span>
                  <span className="admin-link-desc">Query structured service logs, Promtail streams, and LogQL filters in Grafana.</span>
                  <span className="admin-link-url">localhost:3002 (Loki) ↗</span>
                </a>

                <a
                  href="http://localhost:3002/explore?schemaVersion=1&panes=%7B%22tempo%22:%7B%22datasource%22:%22tempo%22%7D%7D"
                  target="_blank"
                  rel="noreferrer"
                  className="admin-link-card"
                >
                  <span className="admin-link-title">Tempo Distributed Traces</span>
                  <span className="admin-link-desc">Trace waterfalls, span latencies, and OpenTelemetry query in Grafana.</span>
                  <span className="admin-link-url">localhost:3002 (Tempo) ↗</span>
                </a>

                <a
                  href="http://localhost:4000/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="admin-link-card"
                >
                  <span className="admin-link-title">Swagger / OpenAPI Docs</span>
                  <span className="admin-link-desc">Interactive documentation for the backend API endpoints.</span>
                  <span className="admin-link-url">localhost:4000/docs ↗</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Settings */}
        {activeTab === "settings" && (
          <div className="admin-tab-view">
            <div className="admin-panel-card">
              <h2>Platform Settings</h2>
              <p className="muted">
                Environment and service configuration details.
              </p>

              <div className="admin-info-box">
                <div className="admin-info-row">
                  <span className="admin-info-key">Application</span>
                  <span className="admin-info-val">{appConfig.displayName}</span>
                </div>
                <div className="admin-info-row">
                  <span className="admin-info-key">Authentication Provider</span>
                  <span className="admin-info-val">Keycloak (OpenID Connect)</span>
                </div>
                <div className="admin-info-row">
                  <span className="admin-info-key">AI Gateway</span>
                  <span className="admin-info-val">Archestra Platform Gateway</span>
                </div>
                <div className="admin-info-row">
                  <span className="admin-info-key">Database</span>
                  <span className="admin-info-val">PostgreSQL 16 with pgvector & Drizzle ORM</span>
                </div>
                <div className="admin-info-row">
                  <span className="admin-info-key">Observability</span>
                  <span className="admin-info-val">Grafana, Prometheus, Loki & Tempo (OpenTelemetry)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
