import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./backend/src/db/schema.ts",
  out: "./backend/drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://aistarter:aistarter_local_secret@localhost:5432/aistarter_db",
  },
  strict: true,
  verbose: true,
});

