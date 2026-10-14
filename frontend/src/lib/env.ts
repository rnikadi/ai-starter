import { z } from "zod";

export const frontendEnvSchema = z.object({
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_URL: z.string().url("AUTH_URL must be a valid URL"),
  AUTH_KEYCLOAK_ID: z.string().min(1, "AUTH_KEYCLOAK_ID is required"),
  AUTH_KEYCLOAK_SECRET: z.string().min(1, "AUTH_KEYCLOAK_SECRET is required"),
  AUTH_KEYCLOAK_ISSUER: z.string().url("AUTH_KEYCLOAK_ISSUER must be a valid URL"),
  AUTH_KEYCLOAK_INTERNAL_URL: z.string().url().optional(),
  BACKEND_URL: z.string().url("BACKEND_URL must be a valid URL"),
  NODE_ENV: z.string().default("development"),
});

export type FrontendEnv = z.infer<typeof frontendEnvSchema>;

let cachedFrontendEnv: FrontendEnv | null = null;

export function resetCachedFrontendEnv(): void {
  cachedFrontendEnv = null;
}

export function getFrontendEnv(): FrontendEnv {
  if (cachedFrontendEnv) {
    return cachedFrontendEnv;
  }

  const result = frontendEnvSchema.safeParse(process.env);
  if (!result.success) {
    const errorList = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    // If Next.js is running the static build phase in Docker where runtime secrets are not yet injected,
    // allow build compilation without hardcoding secrets.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return (frontendEnvSchema.partial().parse(process.env) as unknown) as FrontendEnv;
    }

    const msg = `[frontend] Invalid environment configuration:\n  - ${errorList.join("\n  - ")}`;
    console.error(msg);
    throw new Error(msg);
  }

  cachedFrontendEnv = result.data;
  return cachedFrontendEnv;
}
