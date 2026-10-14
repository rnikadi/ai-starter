import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminConsole } from "./admin-console";

describe("AdminConsole Component", () => {
  it("renders Overview tab by default with user and role details", () => {
    const html = renderToStaticMarkup(
      <AdminConsole
        user={{ name: "Admin Tester", email: "admin@example.com" }}
        roles={["admin", "developer"]}
      />,
    );

    expect(html).toContain("Admin Tester");
    expect(html).toContain("admin@example.com");
    expect(html).toContain("admin, developer");
    expect(html).toContain("ADMINISTRATION");
  });

  it("renders Consoles & Links tab with all infrastructure and observability links including Loki", () => {
    const html = renderToStaticMarkup(
      <AdminConsole initialTab="consoles" />,
    );

    // Infrastructure services
    expect(html).toContain("Keycloak Admin");
    expect(html).toContain("http://localhost:8080");

    expect(html).toContain("Archestra Gateway");
    expect(html).toContain("http://localhost:3000");

    expect(html).toContain("Swagger / OpenAPI Docs");
    expect(html).toContain("http://localhost:4000/docs");

    // Observability stack
    expect(html).toContain("Grafana Observability");
    expect(html).toContain("http://localhost:3002");

    expect(html).toContain("Prometheus Metrics");
    expect(html).toContain("http://localhost:9090");

    expect(html).toContain("Loki Log Aggregation");
    expect(html).toContain("http://localhost:3002/explore?schemaVersion=1&amp;panes=%7B%22loki%22:%7B%22datasource%22:%22loki%22%7D%7D");
    expect(html).toContain("localhost:3002 (Loki) ↗");

    expect(html).toContain("Tempo Distributed Traces");
    expect(html).toContain("http://localhost:3002/explore?schemaVersion=1&amp;panes=%7B%22tempo%22:%7B%22datasource%22:%22tempo%22%7D%7D");
    expect(html).toContain("localhost:3002 (Tempo) ↗");
  });

  it("renders Database tab with clear chat history button", () => {
    const html = renderToStaticMarkup(
      <AdminConsole initialTab="database" />,
    );

    expect(html).toContain("Database &amp; Storage Management");
    expect(html).toContain("Clear Chat History");
    expect(html).toContain("Clear All Conversations");
  });

  it("renders Users & Roles tab with role descriptions", () => {
    const html = renderToStaticMarkup(
      <AdminConsole initialTab="users" />,
    );

    expect(html).toContain("Users &amp; Role Permissions");
    expect(html).toContain("Viewer");
    expect(html).toContain("Developer");
    expect(html).toContain("Administrator");
  });

  it("renders Settings tab with database and observability details", () => {
    const html = renderToStaticMarkup(
      <AdminConsole initialTab="settings" />,
    );

    expect(html).toContain("Platform Settings");
    expect(html).toContain("PostgreSQL 16 with pgvector &amp; Drizzle ORM");
    expect(html).toContain("Grafana, Prometheus, Loki &amp; Tempo (OpenTelemetry)");
  });
});

