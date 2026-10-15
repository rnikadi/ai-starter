import { z } from "zod";
import { appConfig } from "../lib/app-config.js";

export const backendEnvSchema = z.object({
  BACKEND_PORT: z.coerce.number().default(4000),
  PORT: z.coerce.number().optional(),
  HOST: z.string().default("0.0.0.0"),
  AUTH_KEYCLOAK_ISSUER: z.string().url("AUTH_KEYCLOAK_ISSUER must be a valid URL"),
  AUTH_KEYCLOAK_INTERNAL_URL: z.string().url().optional(),
  AUTH_KEYCLOAK_ID: z.string().default("ai-starter-web"),
  AUTH_KEYCLOAK_SECRET: z.string().optional(),
  ARCHESTRA_BASE_URL: z.string().url("ARCHESTRA_BASE_URL must be a valid URL"),
  ARCHESTRA_VIRTUAL_KEY: z.string().min(1, "ARCHESTRA_VIRTUAL_KEY is required"),
  ARCHESTRA_MODEL: z.string().min(1, "ARCHESTRA_MODEL is required"),
  ARCHESTRA_EMBEDDING_MODEL: z.string().default("nvidia/nemotron-3-embed-1b:free"),
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection URL"),
  BACKEND_URL: z.string().url().optional(),
  BACKEND_PUBLIC_URL: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default(`${appConfig.packageName}-backend`),
  OTEL_TRACING_ENABLED: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_FORMAT: z.enum(["pretty", "json"]).optional(),
  NODE_ENV: z.string().default("development"),
});

export type BackendEnv = z.infer<typeof backendEnvSchema>;

let cachedEnv: BackendEnv | null = null;

export function resetCachedBackendEnv(): void {
  cachedEnv = null;
}

export function validateBackendEnv(
  source: Record<string, unknown> = process.env,
): { valid: boolean; errors?: string[]; data?: BackendEnv } {
  const result = backendEnvSchema.safeParse(source);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    return { valid: false, errors };
  }

  return { valid: true, data: result.data };
}

export function getBackendEnv(): BackendEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const { valid, errors, data } = validateBackendEnv(process.env);
  if (!valid || !data) {
    const errorList = errors ? errors.join("\n  - ") : "Unknown validation failure";
    const msg = `[FATAL] Environment variable validation failed:\n  - ${errorList}\nPlease review your environment configuration or .env.local file.`;
    console.error(msg);
    throw new Error(msg);
  }

  cachedEnv = data;
  return cachedEnv;
}
