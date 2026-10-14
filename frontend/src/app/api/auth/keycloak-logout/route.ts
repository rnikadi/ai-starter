import { NextResponse } from "next/server";
import { getFrontendEnv } from "@/lib/env";

async function handleKeycloakLogout() {
  let env;
  try {
    env = getFrontendEnv();
  } catch (err) {
    console.error("Keycloak logout configuration is missing:", err);
    return NextResponse.json(
      { error: "Keycloak logout is not configured." },
      { status: 500 },
    );
  }

  const issuer = env.AUTH_KEYCLOAK_ISSUER;
  const clientId = env.AUTH_KEYCLOAK_ID;
  const authUrl = env.AUTH_URL;

  let issuerUrl: URL;
  try {
    issuerUrl = new URL(issuer);
  } catch {
    return NextResponse.json(
      { error: "The Keycloak issuer URL is invalid." },
      { status: 500 },
    );
  }

  if (issuerUrl.protocol !== "http:" && issuerUrl.protocol !== "https:") {
    return NextResponse.json(
      { error: "The Keycloak issuer must use HTTP or HTTPS." },
      { status: 500 },
    );
  }

  const logoutUrl = new URL(
    `${issuerUrl.pathname.replace(/\/+$/, "")}/protocol/openid-connect/logout`,
    issuerUrl.origin,
  );

  const returnUrl = new URL("/", authUrl);

  logoutUrl.searchParams.set("client_id", clientId);
  logoutUrl.searchParams.set(
    "post_logout_redirect_uri",
    returnUrl.toString(),
  );

  return NextResponse.redirect(logoutUrl, 303);
}

export async function GET() {
  return handleKeycloakLogout();
}

export async function POST() {
  return handleKeycloakLogout();
}
