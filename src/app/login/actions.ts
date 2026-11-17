"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, checkPassword, safeNext, sessionToken } from "@/lib/auth";

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  if (!(await checkPassword(password))) {
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing a little
    return { error: "Wrong password." };
  }
  (await cookies()).set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(safeNext(next));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
