"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import { RunRefused, collectRuns, startSearchRun } from "@/lib/pipeline/runs";
import { runTick } from "@/lib/pipeline/tick";

const { brands, runs } = schema;
const Id = z.uuid();

async function requireSession() {
  if (!(await isValidSession((await cookies()).get(SESSION_COOKIE)?.value))) throw new Error("Not signed in.");
}

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

const BrandForm = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  domain: z.string().trim().max(200).optional(),
  description: z.string().trim().min(10, "Describe the brand in a sentence or two, so the AI can tell it apart from other meanings").max(2000),
  searchTerms: z.array(z.string().max(80)).min(1, "At least one search term").max(10),
  exclusionTerms: z.array(z.string().max(80)).max(50),
  blockedSubreddits: z.array(z.string().max(60)).max(100),
  brandSubreddits: z.array(z.string().max(60)).max(30),
  neverDo: z.array(z.string().max(200)).max(30),
  voiceGuide: z.string().max(20000),
  supportUrl: z.string().trim().max(200).optional(),
  pollEveryHours: z.coerce.number().int().min(1).max(24),
  backfillDays: z.coerce.number().int().min(1).max(7),
});

export type BrandFormState = { error?: string; saved?: boolean; values?: Record<string, string> };

export async function saveBrand(_prev: BrandFormState | undefined, form: FormData): Promise<BrandFormState> {
  await requireSession();
  const parsed = BrandForm.safeParse({
    name: form.get("name"), domain: form.get("domain") || undefined, description: form.get("description"),
    searchTerms: list(form.get("searchTerms")), exclusionTerms: list(form.get("exclusionTerms")),
    blockedSubreddits: list(form.get("blockedSubreddits")).map((s) => s.replace(/^\/?r\//i, "").toLowerCase()),
    brandSubreddits: list(form.get("brandSubreddits")).map((s) => s.replace(/^\/?r\//i, "").toLowerCase()),
    neverDo: String(form.get("neverDo") ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    voiceGuide: form.get("voiceGuide") ?? "", supportUrl: form.get("supportUrl") || undefined,
    pollEveryHours: form.get("pollEveryHours"), backfillDays: form.get("backfillDays"),
  });
  if (!parsed.success) {
    // Echo the input back: React 19 resets the form after an action.
    const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
    return { error: parsed.error.issues[0]?.message ?? "Invalid form", values };
  }
  const id = String(form.get("id") ?? "");
  try {
    if (id) {
      const [current] = await db.select().from(brands).where(eq(brands.id, Id.parse(id)));
      // Editing the voice guide bumps its version, so drafts show which guide wrote them.
      const voiceVersion = current.voiceGuide !== parsed.data.voiceGuide ? current.voiceVersion + 1 : current.voiceVersion;
      await db.update(brands).set({ ...parsed.data, voiceVersion }).where(eq(brands.id, current.id));
      revalidatePath("/", "layout");
            return { saved: true };
    }
    const [created] = await db.insert(brands).values(parsed.data).returning();
    revalidatePath("/", "layout");
    redirect(`/b/${created.id}`);
  } catch (e) {
    if (e instanceof Error && /brands_name_unique|duplicate key/.test(e.message)) {
      return { error: "A brand with this name already exists.", values: Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) };
    }
    throw e;
  }
}

export async function setBrandFlag(id: string, flag: "enabled" | "livePollingEnabled", value: boolean) {
  await requireSession();
  await db.update(brands).set({ [z.enum(["enabled", "livePollingEnabled"]).parse(flag)]: z.boolean().parse(value) })
    .where(eq(brands.id, Id.parse(id)));
  revalidatePath("/", "layout");
}

/** "Run now": starts a search run, then keeps working after the response (up to ~4 min) to collect and process it. */
export async function runNow(id: string): Promise<{ ok: boolean; message: string }> {
  await requireSession();
  const [brand] = await db.select().from(brands).where(eq(brands.id, Id.parse(id)));
  if (!brand) return { ok: false, message: "Brand not found." };
  let runId: string;
  try {
    runId = await startSearchRun(brand, { manual: true });
  } catch (e) {
    return { ok: false, message: e instanceof RunRefused ? e.message : `Couldn't start the run: ${e instanceof Error ? e.message : e}` };
  }
  after(async () => {
    const until = Date.now() + 240_000;
    while (Date.now() < until) {
      await collectRuns();
      const [r] = await db.select({ status: runs.status }).from(runs).where(eq(runs.id, runId));
      if (r.status !== "running" && r.status !== "starting") break;
      await new Promise((res) => setTimeout(res, 15_000));
    }
    await runTick({ budgetMs: Math.max(30_000, until - Date.now()) });
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Run started. Results appear here as it finishes (usually a few minutes)." };
}
