"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import { sendDigest } from "@/lib/email/digest";

async function requireSession() {
  if (!(await isValidSession((await cookies()).get(SESSION_COOKIE)?.value))) throw new Error("Not signed in.");
}

const Settings = z.object({
  emailRecipients: z.array(z.email("One of the recipients isn't a valid email address")).max(20),
  timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } }, "Unknown time zone"),
  digestHour: z.coerce.number().int().min(0).max(23),
  monthlyApifyBudgetUsd: z.coerce.number().min(0).max(1000),
  spikeEmails: z.boolean(),
});

// `values` echoes what was submitted: React 19 resets uncontrolled fields after a form
// action, so without it a validation error would wipe what the user typed.
export type SettingsState = { error?: string; saved?: boolean; message?: string; values?: Record<string, string> };

export async function saveSettings(_prev: SettingsState | undefined, form: FormData): Promise<SettingsState> {
  await requireSession();
  const parsed = Settings.safeParse({
    emailRecipients: String(form.get("emailRecipients") ?? "").split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean),
    timezone: String(form.get("timezone") ?? "").trim(),
    digestHour: form.get("digestHour"),
    monthlyApifyBudgetUsd: form.get("monthlyApifyBudgetUsd"),
    spikeEmails: form.get("spikeEmails") === "on",
  });
  if (!parsed.success) {
    const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
    return { error: parsed.error.issues[0]?.message, values };
  }
  await db.update(schema.settings).set(parsed.data).where(eq(schema.settings.id, 1));
  revalidatePath("/settings");
  return { saved: true };
}

export async function sendTestDigest(): Promise<SettingsState> {
  await requireSession();
  const r = await sendDigest({ force: true });
  revalidatePath("/settings");
  return r.sent ? { message: "Test digest sent. Check the inbox." } : { error: `Not sent: ${r.reason}` };
}
