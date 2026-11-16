// Single-user password gate. The session cookie holds an HMAC of a
// fixed label with SESSION_SECRET: no session table, and rotating the secret logs
// everyone out. Web Crypto only, so it also runs in proxy.ts.
export const SESSION_COOKIE = "bp_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison (avoids leaking how much of a guess was right). */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sessionToken() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  return hmac(secret, "brand-pulse-session-v1");
}

export async function isValidSession(value: string | undefined) {
  if (!value || !process.env.SESSION_SECRET) return false;
  return safeEqual(value, await sessionToken());
}

export async function checkPassword(input: string) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  // Compare HMACs so both sides have equal length regardless of input.
  const key = process.env.SESSION_SECRET ?? "pw";
  return safeEqual(await hmac(key, input), await hmac(key, expected));
}
