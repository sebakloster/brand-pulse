import { Resend } from "resend";

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

/** Sends one email. Never throws: the caller records the error (never fail silently). */
export async function sendEmail(msg: { to: string[]; subject: string; html: string; text: string; idempotencyKey?: string }): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, error: "Email not configured (RESEND_API_KEY / EMAIL_FROM)." };
  if (msg.to.length === 0) return { ok: false, error: "No recipients. Add them in Settings." };
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send(
      { from: process.env.EMAIL_FROM!, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text },
      msg.idempotencyKey ? { idempotencyKey: msg.idempotencyKey } : undefined,
    );
    if (error || !data) return { ok: false, error: error?.message ?? "unknown error" };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** Reddit text ends up in emails: escape everything that isn't ours. */
export function esc(s: string | null | undefined) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** "YYYY-MM-DD" and the local hour in a time zone. */
export function localDay(tz: string, d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}
