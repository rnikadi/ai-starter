import { z } from "zod";

export const backendEnvSchema = z.object({
  BACKEND_PORT: z.coerce.number().default(4000),
  PORT: z.coerce.number().optional(),
  HOST: z.string().default("0.0.0.0"),
  AUTH_KEYCLOAK_ISSUER: z.string().url().default("http://localhost:8080/realms/ai-starter"),
  AUTH_KEYCLOAK_ID: z.string().default("ai-starter-web"),
  AUTH_KEYCLOAK_SECRET: z.string().optional(),
  ARCHESTRA_BASE_URL: z.string().url().default("http://localhost:9000/v1"),
  ARCHESTRA_VIRTUAL_KEY: z.string().optional(),
  ARCHESTRA_MODEL: z.string().optional(),
  MOCK_AI: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((val) => val === "true" || val === "1"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_FORMAT: z.enum(["pretty", "json"]).optional(),
  NODE_ENV: z.string().default("development"),
});

export type BackendEnv = z.infer<typeof backendEnvSchema>;

let cachedEnv: BackendEnv | null = null;

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
    const msg = `\n[FATAL] Environment variable validation failed:\n  - ${errorList}\nPlease review your .env.local file or run ./setupscripts.sh\n`;
    console.error(msg);
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment configuration.");
    }
  }

  cachedEnv = data || (backendEnvSchema.parse({}) as BackendEnv);
  return cachedEnv;
}

