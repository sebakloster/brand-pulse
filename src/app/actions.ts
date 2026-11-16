"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import { DISCARD_REASONS } from "@/lib/labels";

const { mentions } = schema;

// The proxy is only an optimistic check; every action verifies the session itself.
async function requireSession() {
  if (!(await isValidSession((await cookies()).get(SESSION_COOKIE)?.value))) throw new Error("Not signed in.");
}

const Id = z.uuid();

// Discards need a reason (one tap). Every discard is labeled data for evals.
export async function discardMention(id: string, reason: keyof typeof DISCARD_REASONS) {
  await requireSession();
  z.enum(Object.keys(DISCARD_REASONS) as [keyof typeof DISCARD_REASONS]).parse(reason);
  await db.update(mentions).set({ userStatus: "discarded", discardReason: reason }).where(eq(mentions.id, Id.parse(id)));
  revalidatePath("/", "layout");
}

export async function markMention(id: string, status: "handled" | "replied" | "open") {
  await requireSession();
  z.enum(["handled", "replied", "open"]).parse(status);
  await db.update(mentions)
    .set({ userStatus: status, ...(status === "open" ? { discardReason: null } : {}) })
    .where(eq(mentions.id, Id.parse(id)));
  revalidatePath("/", "layout");
}

/** Follow is a property of the thread: stored on the post mention. */
export async function setFollowed(postMentionId: string, followed: boolean) {
  await requireSession();
  await db.update(mentions).set({ followed: z.boolean().parse(followed) })
    .where(and(eq(mentions.id, Id.parse(postMentionId)), eq(mentions.kind, "post")));
  revalidatePath("/", "layout");
}
