import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectionTestAgent } from "@/mastra/agents/connection-test-agent";

const MAX_PROMPT_LENGTH = 10_000;
const AI_ACCESS_ROLES = new Set<string>(["developer", "admin"]);

interface TestRequest {
  prompt?: unknown;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );
  }

  const roles: string[] = Array.isArray(session.user.roles)
    ? session.user.roles.filter(
        (role: unknown): role is string => typeof role === "string",
      )
    : [];

  if (!roles.some((role: string) => AI_ACCESS_ROLES.has(role))) {
    return NextResponse.json(
      { error: "Your account does not have permission to run AI tests." },
      { status: 403 },
    );
  }

  let body: TestRequest;

  try {
    body = (await request.json()) as TestRequest;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof body.prompt !== "string"
  ) {
    return NextResponse.json(
      { error: 'The "prompt" field must be a string.' },
      { status: 400 },
    );
  }

  const prompt = body.prompt.trim();

  if (!prompt) {
    return NextResponse.json(
      { error: 'The "prompt" field must not be empty.' },
      { status: 400 },
    );
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      {
        error: `The prompt must not exceed ${MAX_PROMPT_LENGTH} characters.`,
      },
      { status: 413 },
    );
  }

  try {
    const result = await connectionTestAgent.generate(prompt);

    return NextResponse.json({
      result: result.text,
    });
  } catch (error) {
    console.error("AI connection test failed.", error);

    return NextResponse.json(
      { error: "AI request failed. Check the server logs for details." },
      { status: 502 },
    );
  }
}
