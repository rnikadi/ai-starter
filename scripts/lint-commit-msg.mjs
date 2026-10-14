#!/usr/bin/env node

/**
 * Conventional Commits Linter for Git Hooks (.husky/commit-msg)
 * Enforces open-source community standards: Conventional Commits 1.0.0
 * Format: <type>(<scope>): <subject>
 */

import fs from "node:fs";
import process from "node:process";

export const ALLOWED_TYPES = [
  "feat", // A new feature
  "fix", // A bug fix
  "docs", // Documentation only changes
  "style", // Changes that do not affect the meaning of the code (formatting, etc)
  "refactor", // A code change that neither fixes a bug nor adds a feature
  "perf", // A code change that improves performance
  "test", // Adding missing tests or correcting existing tests
  "build", // Changes that affect the build system or external dependencies
  "ci", // Changes to CI configuration files and scripts
  "chore", // Other changes that don't modify src or test files
  "revert", // Reverts a previous commit
];

export const MIN_HEADER_LENGTH = 10;
export const MAX_HEADER_LENGTH = 100;

/**
 * Validates a commit message according to Conventional Commits standards.
 * @param {string} rawMessage
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCommitMessage(rawMessage) {
  const errors = [];

  if (typeof rawMessage !== "string") {
    return {
      valid: false,
      errors: ["Commit message must be a string."],
    };
  }

  // 1. Strip git comment lines (starting with #)
  const lines = rawMessage
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("#"));

  const fullText = lines.join("\n").trim();

  if (!fullText) {
    return {
      valid: false,
      errors: ["Commit message cannot be empty."],
    };
  }

  const header = lines[0].trim();

  // Allow automatic merge/revert commits created by Git
  if (
    header.startsWith("Merge ") ||
    header.startsWith("Revert ") ||
    header.startsWith("Initial commit")
  ) {
    return { valid: true, errors: [] };
  }

  // 2. Header length restrictions
  if (header.length < MIN_HEADER_LENGTH) {
    errors.push(
      `Commit header is too short (${header.length} chars). Minimum length is ${MIN_HEADER_LENGTH} characters for a meaningful description.`,
    );
  }

  if (header.length > MAX_HEADER_LENGTH) {
    errors.push(
      `Commit header is too long (${header.length} chars). Maximum allowed length is ${MAX_HEADER_LENGTH} characters.`,
    );
  }

  // 3. Conventional Commit header pattern
  // Matches: type(scope)!: subject OR type!: subject OR type(scope): subject OR type: subject
  const pattern = /^([a-z0-9_-]+)(?:\(([a-zA-Z0-9_.\-\/]+)\))?(!)?: (.+)$/;
  const match = header.match(pattern);

  if (!match) {
    errors.push(
      `Commit header does not match Conventional Commits format: "<type>(<scope>): <subject>" or "<type>: <subject>".`,
    );
  } else {
    const [, type, scope, , subject] = match;

    if (!ALLOWED_TYPES.includes(type)) {
      errors.push(
        `Invalid commit type "${type}". Allowed types are: ${ALLOWED_TYPES.join(", ")}.`,
      );
    }

    if (scope && scope.trim() === "") {
      errors.push("Scope cannot be empty if parentheses are provided.");
    }

    if (!subject || subject.trim() === "") {
      errors.push("Commit subject cannot be empty.");
    } else {
      // Best practice: subject should not end with a period
      if (subject.endsWith(".")) {
        errors.push("Commit subject must not end with a trailing period ('.').");
      }
    }
  }

  // 4. Blank line before body check
  if (lines.length > 1) {
    const secondLine = lines[1];
    if (secondLine !== undefined && secondLine.trim() !== "") {
      errors.push(
        "A blank line is required between the commit header and the body/details.",
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// CLI execution when run via git hook: node scripts/lint-commit-msg.mjs "$1"
function runCLI() {
  const msgFile = process.argv[2];

  let rawMessage = "";
  if (msgFile && fs.existsSync(msgFile)) {
    rawMessage = fs.readFileSync(msgFile, "utf8");
  } else if (!process.stdin.isTTY) {
    try {
      rawMessage = fs.readFileSync(0, "utf8");
    } catch {
      // Stdin read fallback
    }
  }

  if (!rawMessage) {
    console.error("Usage: node scripts/lint-commit-msg.mjs <commit-msg-file>");
    process.exit(1);
  }

  const result = validateCommitMessage(rawMessage);

  if (!result.valid) {
    const RED = "\x1b[31m";
    const GREEN = "\x1b[32m";
    const YELLOW = "\x1b[33m";
    const CYAN = "\x1b[36m";
    const BOLD = "\x1b[1m";
    const RESET = "\x1b[0m";

    console.error(`\n${RED}${BOLD}✖ Invalid Commit Message Format${RESET}\n`);
    for (const err of result.errors) {
      console.error(`  ${RED}•${RESET} ${err}`);
    }

    console.error(`\n${YELLOW}${BOLD}Conventional Commits Format:${RESET}`);
    console.error(`  ${CYAN}<type>(<optional-scope>): <meaningful subject>${RESET}`);
    console.error(`  ${CYAN}[optional blank line]${RESET}`);
    console.error(`  ${CYAN}[optional body / details]${RESET}\n`);

    console.error(`${BOLD}Allowed Types:${RESET}`);
    console.error(`  ${ALLOWED_TYPES.join(", ")}\n`);

    console.error(`${BOLD}Valid Examples:${RESET}`);
    console.error(`  ${GREEN}✓${RESET} feat(ui): add markdown rendering for assistant responses`);
    console.error(`  ${GREEN}✓${RESET} fix(auth): resolve session expiration redirect loop`);
    console.error(`  ${GREEN}✓${RESET} docs: update conventional commits and setup guide`);
    console.error(`  ${GREEN}✓${RESET} chore(deps): upgrade next to version 16.4.0`);
    console.error(`  ${GREEN}✓${RESET} test(server): add tracing context propagation tests\n`);

    process.exit(1);
  }
}

// Run CLI if invoked directly
if (process.argv[1]?.endsWith("lint-commit-msg.mjs")) {
  runCLI();
}

