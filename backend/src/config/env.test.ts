import { describe, it, expect } from "vitest";
import { validateBackendEnv } from "./env.js";

const validMockEnv = {
  AUTH_KEYCLOAK_ISSUER: "http://localhost:8080/realms/ai-starter",
  ARCHESTRA_BASE_URL: "http://localhost:9000/v1/openrouter",
  ARCHESTRA_VIRTUAL_KEY: "test-virtual-key",
  ARCHESTRA_MODEL: "test-model",
  FRONTEND_URL: "http://localhost:3001",
};

describe("Environment Validation", () => {
  it("fails validation when required variables are omitted", () => {
    const result = validateBackendEnv({});
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    const errorString = result.errors?.join(" ");
    expect(errorString).toContain("AUTH_KEYCLOAK_ISSUER");
    expect(errorString).toContain("ARCHESTRA_BASE_URL");
    expect(errorString).toContain("ARCHESTRA_VIRTUAL_KEY");
    expect(errorString).toContain("ARCHESTRA_MODEL");
    expect(errorString).toContain("FRONTEND_URL");
  });

  it("passes validation with valid required variables and default ports", () => {
    const result = validateBackendEnv(validMockEnv);
    expect(result.valid).toBe(true);
    expect(result.data?.BACKEND_PORT).toBe(4000);
    expect(result.data?.AUTH_KEYCLOAK_ISSUER).toBe("http://localhost:8080/realms/ai-starter");
    expect(result.data?.ARCHESTRA_BASE_URL).toBe("http://localhost:9000/v1/openrouter");
    expect(result.data?.ARCHESTRA_VIRTUAL_KEY).toBe("test-virtual-key");
    expect(result.data?.ARCHESTRA_MODEL).toBe("test-model");
    expect(result.data?.FRONTEND_URL).toBe("http://localhost:3001");
  });

  it("fails validation for invalid URL format in issuer", () => {
    const result = validateBackendEnv({
      ...validMockEnv,
      AUTH_KEYCLOAK_ISSUER: "not-a-valid-url",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]).toContain("AUTH_KEYCLOAK_ISSUER");
  });

  it("fails validation for invalid port number", () => {
    const result = validateBackendEnv({
      ...validMockEnv,
      BACKEND_PORT: "not-a-number",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts valid optional internal URL", () => {
    const result = validateBackendEnv({
      ...validMockEnv,
      AUTH_KEYCLOAK_INTERNAL_URL: "http://keycloak:8080/realms/ai-starter",
    });
    expect(result.valid).toBe(true);
    expect(result.data?.AUTH_KEYCLOAK_INTERNAL_URL).toBe(
      "http://keycloak:8080/realms/ai-starter",
    );
  });

  it("configures custom frontend and CORS origins", () => {
    const result = validateBackendEnv({
      ...validMockEnv,
      FRONTEND_URL: "https://app.production.example.com",
      CORS_ALLOWED_ORIGINS: "https://app.production.example.com,https://admin.production.example.com",
    });
    expect(result.valid).toBe(true);
    expect(result.data?.FRONTEND_URL).toBe("https://app.production.example.com");
    expect(result.data?.CORS_ALLOWED_ORIGINS).toBe(
      "https://app.production.example.com,https://admin.production.example.com",
    );
  });
});
