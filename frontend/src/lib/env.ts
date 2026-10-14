import { z } from "zod";

export const frontendEnvSchema = z.object({
  AUTH_SECRET: z.string().default("local-development-secret-key-32chars"),
  AUTH_URL: z.string().url().default("http://localhost:3001"),
  AUTH_KEYCLOAK_ID: z.string().default("ai-starter-web"),
  AUTH_KEYCLOAK_SECRET: z.string().default("ai-starter-kit-local-client-secret"),
  AUTH_KEYCLOAK_ISSUER: z.string().url().default("http://localhost:8080/realms/ai-starter"),
  AUTH_KEYCLOAK_INTERNAL_URL: z.string().url().optional(),
  BACKEND_URL: z.string().url().default("http://localhost:4000"),
  NODE_ENV: z.string().default("development"),
});

export type FrontendEnv = z.infer<typeof frontendEnvSchema>;

export function getFrontendEnv(): FrontendEnv {
  const result = frontendEnvSchema.safeParse(process.env);
  if (!result.success) {
    const errorList = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    console.warn(`[frontend] Environment configuration warnings:\n  - ${errorList.join("\n  - ")}`);
  }
  return result.success ? result.data : (frontendEnvSchema.parse({}) as FrontendEnv);
}

