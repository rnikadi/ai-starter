import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectionTestAgent } from "@/mastra/agents/connection-test-agent";
import { validateAiTestRequest } from "@/lib/ai-test-request";

const AI_ACCESS_ROLES = new Set<string>(["developer", "admin"]);

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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const validation = validateAiTestRequest(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status },
    );
  }

  try {
    const result = await connectionTestAgent.generate(validation.prompt);

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
