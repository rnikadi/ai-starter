import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessAdmin } from "@/lib/role-access";

export async function GET() {
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

  if (!canAccessAdmin(roles)) {
    return NextResponse.json(
      { error: "Administrator access is required." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    authenticated: true,
    authorized: true,
    capabilities: ["admin:access"],
  });
}
