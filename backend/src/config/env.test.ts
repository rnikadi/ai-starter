import { describe, it, expect } from "vitest";
import { validateBackendEnv, backendEnvSchema } from "./env.js";

describe("Environment Validation", () => {
  it("uses default values when optional variables are omitted", () => {
    const result = validateBackendEnv({});
    expect(result.valid).toBe(true);
    expect(result.data?.BACKEND_PORT).toBe(4000);
    expect(result.data?.AUTH_KEYCLOAK_ISSUER).toBe("http://localhost:8080/realms/ai-starter");
    expect(result.data?.ARCHESTRA_BASE_URL).toBe("http://localhost:9000/v1");
    expect(result.data?.MOCK_AI).toBe(false);
  });

  it("parses MOCK_AI=true properly", () => {
    const result = validateBackendEnv({ MOCK_AI: "true" });
    expect(result.valid).toBe(true);
    expect(result.data?.MOCK_AI).toBe(true);
  });

  it("fails validation for invalid URL format in issuer", () => {
    const result = validateBackendEnv({ AUTH_KEYCLOAK_ISSUER: "not-a-valid-url" });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]).toContain("AUTH_KEYCLOAK_ISSUER");
  });

  it("fails validation for invalid port number", () => {
    const result = validateBackendEnv({ BACKEND_PORT: "not-a-number" });
    expect(result.valid).toBe(false);
  });

  it("accepts valid internal URLs for keycloak and archestra", () => {
    const result = validateBackendEnv({
      AUTH_KEYCLOAK_INTERNAL_URL: "http://keycloak:8080/realms/ai-starter",
      ARCHESTRA_INTERNAL_URL: "http://archestra:9000",
    });
    expect(result.valid).toBe(true);
    expect(result.data?.AUTH_KEYCLOAK_INTERNAL_URL).toBe(
      "http://keycloak:8080/realms/ai-starter",
    );
    expect(result.data?.ARCHESTRA_INTERNAL_URL).toBe("http://archestra:9000");
  });
});

