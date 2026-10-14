import { describe, it, expect } from "vitest";
import { validateCommitMessage, ALLOWED_TYPES } from "./lint-commit-msg.mjs";

describe("Conventional Commits Validator (lint-commit-msg)", () => {
  it("accepts valid Conventional Commit headers without scope", () => {
    const result = validateCommitMessage("feat: implement markdown renderer");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts valid Conventional Commit headers with scope", () => {
    const result = validateCommitMessage("fix(auth): handle session expiration gracefully");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts breaking change syntax (!)", () => {
    const result1 = validateCommitMessage("feat!: drop deprecated v1 endpoints");
    expect(result1.valid).toBe(true);

    const result2 = validateCommitMessage("refactor(db)!: migrate conversations schema");
    expect(result2.valid).toBe(true);
  });

  it("accepts all standard open-source conventional types", () => {
    for (const type of ALLOWED_TYPES) {
      const result = validateCommitMessage(`${type}: valid description here for testing`);
      expect(result.valid).toBe(true);
    }
  });

  it("accepts multi-line commit messages with a blank line between header and body", () => {
    const msg = [
      "feat(ui): add syntax highlighting for code blocks",
      "",
      "This renders code blocks inside chat assistant responses with dark theme",
      "and a copy-to-clipboard button.",
    ].join("\n");

    const result = validateCommitMessage(msg);
    expect(result.valid).toBe(true);
  });

  it("ignores git comment lines starting with #", () => {
    const msg = [
      "feat(ui): add markdown parsing support",
      "# Please enter the commit message for your changes.",
      "# Lines starting with '#' will be ignored.",
    ].join("\n");

    const result = validateCommitMessage(msg);
    expect(result.valid).toBe(true);
  });

  it("allows standard git merge and revert commits", () => {
    expect(validateCommitMessage("Merge branch 'main' into feature").valid).toBe(true);
    expect(validateCommitMessage("Revert \"feat: something broken\"").valid).toBe(true);
  });

  it("rejects empty commit message", () => {
    const result = validateCommitMessage("");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/empty/i);
  });

  it("rejects headers shorter than minimum 10 characters", () => {
    const result = validateCommitMessage("fix: a");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("too short"))).toBe(true);
  });

  it("rejects headers longer than maximum 100 characters", () => {
    const longHeader = "feat(observability): " + "a".repeat(105);
    const result = validateCommitMessage(longHeader);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("too long"))).toBe(true);
  });

  it("rejects unknown/disallowed commit types", () => {
    const result = validateCommitMessage("random(ui): add some random feature");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid commit type "random"'))).toBe(true);
  });

  it("rejects headers not following type: format", () => {
    const result = validateCommitMessage("added markdown renderer to chat component");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("does not match Conventional Commits format"))).toBe(true);
  });

  it("rejects trailing periods in subject", () => {
    const result = validateCommitMessage("fix(api): handle timeout exception.");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("trailing period"))).toBe(true);
  });

  it("rejects multi-line commits missing a blank line before the body", () => {
    const msg = [
      "feat(api): add conversation clear endpoint",
      "This line should have been preceded by an empty line.",
    ].join("\n");

    const result = validateCommitMessage(msg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("blank line is required"))).toBe(true);
  });
});

