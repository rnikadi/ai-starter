"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithKeycloak() {
  await signIn("keycloak", { redirectTo: "/" });
}

export async function signOutOfApp() {
  await signOut({ redirectTo: "/" });
}
