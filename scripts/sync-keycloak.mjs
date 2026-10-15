#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

export function toDisplayName(name) {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) =>
      part.toLowerCase() === "ai"
        ? "AI"
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

export function syncKeycloak() {
  const rootDir = process.cwd();
  const pkgPath = path.join(rootDir, "package.json");
  const realmPath = path.join(rootDir, "keycloak", "realm-export.json");

  if (!fs.existsSync(pkgPath) || !fs.existsSync(realmPath)) {
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const displayName = toDisplayName(pkg.name);
  const clientName = `${displayName} Web Application`;

  let realmJson;
  try {
    realmJson = JSON.parse(fs.readFileSync(realmPath, "utf8"));
  } catch (err) {
    console.error("Failed to parse realm-export.json:", err);
    return;
  }

  let modified = false;
  if (realmJson.displayName !== displayName) {
    realmJson.displayName = displayName;
    modified = true;
  }

  if (Array.isArray(realmJson.clients) && realmJson.clients[0]) {
    if (realmJson.clients[0].name !== clientName) {
      realmJson.clients[0].name = clientName;
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(realmPath, JSON.stringify(realmJson, null, 2) + "\n");
    console.log(`[sync-keycloak] Updated realm-export.json displayName to "${displayName}".`);
  } else {
    console.log(`[sync-keycloak] realm-export.json already up-to-date with "${displayName}".`);
  }

  // Attempt to update running Keycloak container if it is up and docker is available
  try {
    const psRes = execSync(`docker compose -p ${pkg.name} ps -q keycloak`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (psRes) {
      const envKeycloakPath = path.join(rootDir, ".env.keycloak");
      let adminUser = "admin";
      let adminPass = "";
      if (fs.existsSync(envKeycloakPath)) {
        const envKc = fs.readFileSync(envKeycloakPath, "utf8");
        const userMatch = envKc.match(/KC_BOOTSTRAP_ADMIN_USERNAME=(.+)/);
        const passMatch = envKc.match(/KC_BOOTSTRAP_ADMIN_PASSWORD=(.+)/);
        if (userMatch) adminUser = userMatch[1].trim();
        if (passMatch) adminPass = passMatch[1].trim();
      }

      if (adminPass) {
        console.log(`[sync-keycloak] Updating live Keycloak realm displayName to "${displayName}"...`);
        const kcadm = "/opt/keycloak/bin/kcadm.sh";
        execSync(
          `docker compose -p ${pkg.name} exec -T keycloak ${kcadm} config credentials --server http://localhost:8080 --realm master --user "${adminUser}" --password "${adminPass}" >/dev/null 2>&1`,
          { stdio: "ignore" },
        );
        execSync(
          `docker compose -p ${pkg.name} exec -T keycloak ${kcadm} update realms/ai-starter -s "displayName=${displayName}" >/dev/null 2>&1`,
          { stdio: "ignore" },
        );
        console.log(`[sync-keycloak] Live Keycloak realm displayName updated successfully.`);
      }
    }
  } catch {
    // Docker is either not running or permission denied; normal when offline or in sandbox
  }
}

// When executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncKeycloak();
}
