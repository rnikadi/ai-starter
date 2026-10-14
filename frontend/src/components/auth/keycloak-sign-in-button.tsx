"use client";

import { signIn } from "next-auth/react";

export function KeycloakSignInButton() {
  async function handleSignIn() {
    await signIn(
      "keycloak",
      {
        callbackUrl: "/",
      },
      {
        prompt: "login",
      },
    );
  }

  return (
    <button
      className="primary-button full-width"
      type="button"
      onClick={() => void handleSignIn()}
    >
      Sign in with Keycloak
    </button>
  );
}
