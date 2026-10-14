import { describe, expect, it } from "vitest";
import {
  MAX_PROMPT_LENGTH,
  validateAiTestRequest,
} from "./ai-test-request";

describe("validateAiTestRequest", () => {
  it("accepts a valid prompt and trims surrounding whitespace", () => {
    expect(validateAiTestRequest({ prompt: "  Hello AI  " })).toEqual({
      success: true,
      prompt: "Hello AI",
    });
  });

  it("rejects a missing prompt", () => {
    expect(validateAiTestRequest({})).toEqual({
      success: false,
      status: 400,
      error: 'The "prompt" field must be a string.',
    });
  });

  it("rejects a non-string prompt", () => {
    expect(validateAiTestRequest({ prompt: 123 })).toEqual({
      success: false,
      status: 400,
      error: 'The "prompt" field must be a string.',
    });
  });

  it("rejects a null request body", () => {
    expect(validateAiTestRequest(null)).toEqual({
      success: false,
      status: 400,
      error: 'The "prompt" field must be a string.',
    });
  });

  it("rejects an empty prompt", () => {
    expect(validateAiTestRequest({ prompt: "   " })).toEqual({
      success: false,
      status: 400,
      error: 'The "prompt" field must not be empty.',
    });
  });

  it("accepts a prompt at the maximum length", () => {
    const prompt = "a".repeat(MAX_PROMPT_LENGTH);

    expect(validateAiTestRequest({ prompt })).toEqual({
      success: true,
      prompt,
    });
  });

  it("rejects a prompt exceeding the maximum length", () => {
    expect(
      validateAiTestRequest({
        prompt: "a".repeat(MAX_PROMPT_LENGTH + 1),
      }),
    ).toEqual({
      success: false,
      status: 413,
      error: `The prompt must not exceed ${MAX_PROMPT_LENGTH} characters.`,
    });
  });

  it("accepts an optional valid conversationId", () => {
    expect(
      validateAiTestRequest({
        prompt: "Hello AI",
        conversationId: "conv-1234",
      }),
    ).toEqual({
      success: true,
      prompt: "Hello AI",
      conversationId: "conv-1234",
    });
  });

  it("rejects an invalid conversationId type or empty string", () => {
    expect(
      validateAiTestRequest({
        prompt: "Hello AI",
        conversationId: "   ",
      }),
    ).toEqual({
      success: false,
      status: 400,
      error: 'The "conversationId" field must be a non-empty string when provided.',
    });
  });
});
