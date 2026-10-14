import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import type { NextConfig } from "next";

// Ensure root .env.local is loaded into process.env for Next.js and Auth.js
const rootEnv = path.resolve(process.cwd(), "..", ".env.local");
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
