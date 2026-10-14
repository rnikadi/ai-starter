#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

// 1. Secret patterns to detect in staged diffs
const SECRET_RULES = [
  {
    name: "Private Key",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: "OpenAI Secret Key",
    regex: /\bsk-[a-zA-Z0-9_-]{20,}\b/,
    exclude: /sk-dummy|sk-test|replace-with/,
  },
  {
    name: "Archestra Virtual Key",
    regex: /\barch_[a-f0-9]{32,}\b/,
    exclude: /arch_dummy|replace-with/,
  },
  {
    name: "GitHub Token",
    regex: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/,
  },
  {
    name: "AWS Access Key ID",
    regex: /\bAKIA[0-9A-Z]{16}\b/,
  },
];

// Block sensitive file names from being committed
const BLOCKED_FILE_PATTERNS = [
  /^\.env$/,
  /^\.env\.local$/,
  /^\.env\.production$/,
  /^\.env\.keycloak$/,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
];

function getStagedFiles() {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
      encoding: "utf8",
    });
    return output.split("\n").map((f) => f.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function getStagedDiff(file) {
  try {
    return execSync(`git diff --cached -U0 -- "${file}"`, {
      encoding: "utf8",
    });
  } catch {
    return "";
  }
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  let violations = [];

  // Check 1: File name restrictions
  for (const file of stagedFiles) {
    for (const pattern of BLOCKED_FILE_PATTERNS) {
      if (pattern.test(file)) {
        violations.push({
          file,
          rule: "Blocked Secret File",
          detail: `File '${file}' should never be committed. Add it to .gitignore and unstage with 'git reset HEAD ${file}'.`,
        });
      }
    }
  }

  // Check 2: Content patterns in staged added lines
  for (const file of stagedFiles) {
    if (file.endsWith(".lock") || file === "pnpm-lock.yaml" || file === "package-lock.json") {
      continue;
    }

    const diff = getStagedDiff(file);
    const addedLines = diff
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"));

    for (let i = 0; i < addedLines.length; i++) {
      const line = addedLines[i].substring(1); // strip leading '+'
      for (const rule of SECRET_RULES) {
        if (rule.regex.test(line)) {
          if (rule.exclude && rule.exclude.test(line)) {
            continue;
          }
          const matched = line.match(rule.regex)?.[0] || "";
          const redacted =
            matched.length > 8
              ? `${matched.slice(0, 4)}...${matched.slice(-4)}`
              : "***";

          violations.push({
            file,
            rule: rule.name,
            detail: `Found potential secret matching pattern: ${redacted}`,
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(`\n${BOLD}${RED}✖ [SECURITY CHECK FAILED] Potential secrets detected in staged files:${RESET}\n`);
    for (const v of violations) {
      console.error(`  ${YELLOW}• ${v.file}${RESET} (${BOLD}${v.rule}${RESET})`);
      console.error(`    ${v.detail}`);
    }
    console.error(`\n${CYAN}Remediation:${RESET}`);
    console.error(`  1. Remove hardcoded credentials from the file.`);
    console.error(`  2. Store secrets in .env.local (which is ignored by git).`);
    console.error(`  3. Unstage the file with: ${BOLD}git reset HEAD <file>${RESET}\n`);
    process.exit(1);
  }

  console.log(`${GREEN}✓${RESET} Pre-commit secret scan passed.`);
}

main();

