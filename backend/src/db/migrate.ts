import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const envPath = fs.existsSync(".env.local")
  ? path.resolve(".env.local")
  : path.resolve("..", ".env.local");

dotenv.config({ path: envPath });

import { fileURLToPath } from "node:url";
import { getBackendEnv } from "../config/env.js";

export async function runMigrations(customDbUrl?: string) {
  const targetUrl =
    customDbUrl ||
    process.env.TARGET_DATABASE_URL ||
    (process.argv.includes("--test") && process.env.TEST_DATABASE_URL
      ? process.env.TEST_DATABASE_URL
      : getBackendEnv().DATABASE_URL);

  const sql = postgres(targetUrl, { max: 1 });
  const db = drizzle(sql);

  console.log(`[db:migrate] Running PostgreSQL database migrations...`);

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const relativeMigrations = path.resolve(currentDir, "../../drizzle");
  const rootMigrations = path.resolve(process.cwd(), "backend/drizzle");
  const cwdMigrations = path.resolve(process.cwd(), "drizzle");

  const migrationsFolder = fs.existsSync(relativeMigrations)
    ? relativeMigrations
    : fs.existsSync(rootMigrations)
    ? rootMigrations
    : cwdMigrations;

  if (!fs.existsSync(migrationsFolder)) {
    console.warn(
      `[db:migrate] Migrations folder not found at ${migrationsFolder}. Run 'pnpm db:generate' first.`,
    );
    await sql.end();
    return;
  }

  try {
    await migrate(db, { migrationsFolder });
    console.log("[db:migrate] Migrations applied successfully.");
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[db:migrate] Migration failed:", err);
      process.exit(1);
    });
}
