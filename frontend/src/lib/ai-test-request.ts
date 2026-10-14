import { z } from "zod";

export const MAX_PROMPT_LENGTH = 10_000;

export type AiTestRequestValidation =
  | {
      success: true;
      prompt: string;
      conversationId?: string;
    }
  | {
      success: false;
      status: 400 | 413;
      error: string;
    };

export const aiTestRequestSchema = z.object({
  prompt: z
    .string()
    .transform((val) => val.replace(/\0/g, "").trim())
    .refine((val) => val.length > 0, {
      message: 'The "prompt" field must not be empty.',
    })
    .refine((val) => val.length <= MAX_PROMPT_LENGTH, {
      message: `The prompt must not exceed ${MAX_PROMPT_LENGTH} characters.`,
    }),
  conversationId: z
    .string()
    .transform((val) => val.replace(/\0/g, "").trim())
    .refine((val) => val.length > 0, {
      message:
        'The "conversationId" field must be a non-empty string when provided.',
    })
    .optional(),
});

export const createConversationSchema = z.object({
  title: z
    .string()
    .transform((val) => val.replace(/[<>\0]/g, "").trim())
    .refine((val) => val.length > 0, {
      message: "Title must not be empty.",
    })
    .refine((val) => val.length <= 100, {
      message: "Title must not exceed 100 characters.",
    }),
});

export function validateAiTestRequest(
  body: unknown,
): AiTestRequestValidation {
  if (
    typeof body !== "object" ||
    body === null ||
    !("prompt" in body) ||
    typeof (body as { prompt?: unknown }).prompt !== "string"
  ) {
    return {
      success: false,
      status: 400,
      error: 'The "prompt" field must be a string.',
    };
  }

  const rawPrompt = (body as { prompt: string }).prompt.replace(/\0/g, "").trim();
  if (rawPrompt.length === 0) {
    return {
      success: false,
      status: 400,
      error: 'The "prompt" field must not be empty.',
    };
  }

  if (rawPrompt.length > MAX_PROMPT_LENGTH) {
    return {
      success: false,
      status: 413,
      error: `The prompt must not exceed ${MAX_PROMPT_LENGTH} characters.`,
    };
  }

  if (
    "conversationId" in body &&
    body.conversationId !== undefined &&
    (typeof body.conversationId !== "string" ||
      body.conversationId.replace(/\0/g, "").trim().length === 0)
  ) {
    return {
      success: false,
      status: 400,
      error: 'The "conversationId" field must be a non-empty string when provided.',
    };
  }

  const result = aiTestRequestSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return {
      success: false,
      status: 400,
      error: firstIssue?.message ?? "Invalid request body.",
    };
  }

  return {
    success: true,
    prompt: result.data.prompt,
    ...(result.data.conversationId
      ? { conversationId: result.data.conversationId }
      : {}),
  };
}
