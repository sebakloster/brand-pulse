import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

/** The proxy is only an optimistic check: every server action and API route verifies the session itself. */
export async function hasSession() {
  return isValidSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireSession() {
  if (!(await hasSession())) throw new Error("Not signed in.");
}
