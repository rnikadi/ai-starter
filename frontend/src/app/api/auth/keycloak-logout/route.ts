import { NextResponse } from "next/server";

async function handleKeycloakLogout(request: Request) {
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
  const clientId = process.env.AUTH_KEYCLOAK_ID;

  if (!issuer || !clientId) {
    console.error("Keycloak logout configuration is missing.");

    return NextResponse.json(
      { error: "Keycloak logout is not configured." },
      { status: 500 },
    );
  }

  let issuerUrl: URL;

  try {
    issuerUrl = new URL(issuer);
  } catch {
    return NextResponse.json(
      { error: "The Keycloak issuer URL is invalid." },
      { status: 500 },
    );
  }

  if (
    issuerUrl.protocol !== "http:" &&
    issuerUrl.protocol !== "https:"
  ) {
    return NextResponse.json(
      { error: "The Keycloak issuer must use HTTP or HTTPS." },
      { status: 500 },
    );
  }

  const logoutUrl = new URL(
    `${issuerUrl.pathname.replace(/\/+$/, "")}/protocol/openid-connect/logout`,
    issuerUrl.origin,
  );

  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  let returnUrl: URL;

  if (authUrl) {
    returnUrl = new URL("/", authUrl);
  } else {
    returnUrl = new URL("/", request.url);
  }

  // Normalize 0.0.0.0 bind address to localhost so Keycloak receives an allowed redirect URI
  if (returnUrl.hostname === "0.0.0.0") {
    returnUrl.hostname = "localhost";
  }

  logoutUrl.searchParams.set("client_id", clientId);
  logoutUrl.searchParams.set(
    "post_logout_redirect_uri",
    returnUrl.toString(),
  );

  return NextResponse.redirect(logoutUrl, 303);
}

export async function GET(request: Request) {
  return handleKeycloakLogout(request);
}

export async function POST(request: Request) {
  return handleKeycloakLogout(request);
}
