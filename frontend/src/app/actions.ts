"use server";

import { signIn, signOut } from "@/auth";
import { redirect } from "next/navigation";

export async function signInWithKeycloak() {
  await signIn(
    "keycloak",
    {
      redirectTo: "/",
    },
    {
      prompt: "login",
    },
  );
}

export async function signOutOfApp() {
  await signOut({
    redirect: false,
  });

  redirect("/api/auth/keycloak-logout");
}
