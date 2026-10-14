"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function KeycloakSignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (pending) {
      return;
    }

    setPending(true);

    try {
      await signOut({ redirect: false });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/api/auth/keycloak-logout");
    } catch (error) {
      console.error("Unable to sign out.", error);
      setPending(false);
    }
  }

  return (
    <button
      className="secondary-button"
      type="button"
      onClick={() => void handleSignOut()}
      disabled={pending}
    >
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
