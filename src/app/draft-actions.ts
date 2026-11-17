"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireSession } from "@/lib/session";
import { generateDraft, runChecks } from "@/lib/drafts/generate";

const { brands, drafts, mentions, triage } = schema;
const Id = z.uuid();

/** New suggested draft, or the user's own words turned into a reply. Returns an error message instead of throwing. */
export async function draftReply(mentionId: string, userInput?: string): Promise<{ ok: boolean; message?: string }> {
  await requireSession();
  const input = userInput?.trim() ? z.string().max(1500).safeParse(userInput.trim()) : undefined;
  if (input && !input.success) return { ok: false, message: "That's too long. Keep it under 1,500 characters." };
  try {
    await generateDraft(Id.parse(mentionId), input?.data);
  } catch (e) {
    console.error("draftReply failed", mentionId, e);
    return { ok: false, message: "The AI couldn't write a reply this time. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Re-run the code checks on text the user edited by hand (no LLM call). */
export async function checkText(mentionId: string, text: string) {
  await requireSession();
  const [m] = await db.select().from(mentions).where(eq(mentions.id, Id.parse(mentionId)));
  if (!m) return [];
  const [brand] = await db.select().from(brands).where(eq(brands.id, m.brandId));
  if (!brand) return [];
  const [t] = await db.select().from(triage).where(eq(triage.mentionId, m.id)).orderBy(desc(triage.createdAt)).limit(1);
  return runChecks(z.string().max(5000).parse(text), brand, t?.riskFlags ?? []);
}

/** Saves the final text. "copied" when the user copies it to post; "replied" when they confirm it's posted. */
export async function saveDraftStatus(draftId: string, finalText: string, status: "copied" | "replied") {
  await requireSession();
  const [d] = await db.update(drafts)
    .set({ finalText: z.string().max(5000).parse(finalText), status: z.enum(["copied", "replied"]).parse(status) })
    .where(eq(drafts.id, Id.parse(draftId))).returning();
  if (!d) throw new Error("Draft not found.");
  if (status === "replied") {
    await db.update(mentions).set({ userStatus: "replied" }).where(eq(mentions.id, d.mentionId));
  }
  revalidatePath("/", "layout");
}
