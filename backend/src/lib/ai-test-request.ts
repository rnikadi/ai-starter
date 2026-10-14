export const MAX_PROMPT_LENGTH = 10_000;

export type AiTestRequestValidation =
  | {
      success: true;
      prompt: string;
    }
  | {
      success: false;
      status: 400 | 413;
      error: string;
    };

export function validateAiTestRequest(
  body: unknown,
): AiTestRequestValidation {
  if (
    typeof body !== "object" ||
    body === null ||
    !("prompt" in body) ||
    typeof body.prompt !== "string"
  ) {
    return {
      success: false,
      status: 400,
      error: 'The "prompt" field must be a string.',
    };
  }

  const prompt = body.prompt.trim();

  if (!prompt) {
    return {
      success: false,
      status: 400,
      error: 'The "prompt" field must not be empty.',
    };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      success: false,
      status: 413,
      error: `The prompt must not exceed ${MAX_PROMPT_LENGTH} characters.`,
    };
  }

  return {
    success: true,
    prompt,
  };
}
