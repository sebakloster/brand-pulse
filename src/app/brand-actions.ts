"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import { RunRefused, collectRuns, liveSource, startSearchRun } from "@/lib/pipeline/runs";
import { runTick } from "@/lib/pipeline/tick";
import { suggestBrandSetup, type BrandSuggestion } from "@/lib/brands/suggest";

const { brands, runs } = schema;
const Id = z.uuid();

async function requireSession() {
  if (!(await isValidSession((await cookies()).get(SESSION_COOKIE)?.value))) throw new Error("Not signed in.");
}

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

const BrandForm = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  domain: z.string().trim().min(1, "Website is required").max(200),
  description: z.string().trim().max(2000),
  searchTerms: z.array(z.string().max(80)).max(10),
  exclusionTerms: z.array(z.string().max(80)).max(50),
  blockedSubreddits: z.array(z.string().max(60)).max(100),
  brandSubreddits: z.array(z.string().max(60)).max(30),
  neverDo: z.array(z.string().max(200)).max(30),
  voiceGuide: z.string().max(20000),
  supportUrl: z.string().trim().max(200).optional(),
  backfillDays: z.coerce.number().int().min(1).max(30),
});

export type BrandFormState = { error?: string; saved?: boolean; values?: Record<string, string> };

export async function saveBrand(_prev: BrandFormState | undefined, form: FormData): Promise<BrandFormState> {
  await requireSession();
  const parsed = BrandForm.safeParse({
    name: form.get("name"), domain: form.get("domain") ?? "", description: form.get("description") ?? "",
    searchTerms: list(form.get("searchTerms")), exclusionTerms: list(form.get("exclusionTerms")),
    blockedSubreddits: list(form.get("blockedSubreddits")).map((s) => s.replace(/^\/?r\//i, "").toLowerCase()),
    brandSubreddits: list(form.get("brandSubreddits")).map((s) => s.replace(/^\/?r\//i, "").toLowerCase()),
    neverDo: String(form.get("neverDo") ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    voiceGuide: form.get("voiceGuide") ?? "", supportUrl: form.get("supportUrl") || undefined,
    backfillDays: form.get("backfillDays"),
  });
  if (!parsed.success) {
    // Echo the input back: React 19 resets the form after an action.
    const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
    return { error: parsed.error.issues[0]?.message ?? "Invalid form", values };
  }
  const id = String(form.get("id") ?? "");
  const echo = () => Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  // Only name and website are required; searching for the brand name is the sensible default.
  const data = {
    ...parsed.data,
    domain: cleanDomain(parsed.data.domain),
    searchTerms: parsed.data.searchTerms.length ? parsed.data.searchTerms : [parsed.data.name],
  };

  // Names are unique among live brands (case-insensitive here, so "dahon" can't sneak in next to "Dahon").
  const [taken] = await db.select({ id: brands.id }).from(brands)
    .where(and(sql`lower(${brands.name}) = lower(${data.name})`, isNull(brands.deletedAt), id ? ne(brands.id, Id.parse(id)) : undefined));
  if (taken) return { error: `A brand called ${data.name} already exists.`, values: echo() };

  let createdId: string | null = null;
  try {
    if (id) {
      const [current] = await db.select().from(brands).where(and(eq(brands.id, Id.parse(id)), isNull(brands.deletedAt)));
      if (!current) return { error: "This brand no longer exists.", values: echo() };
      // Editing the voice guide bumps its version, so drafts show which guide wrote them.
      const voiceVersion = current.voiceGuide !== data.voiceGuide ? current.voiceVersion + 1 : current.voiceVersion;
      await db.update(brands).set({ ...data, voiceVersion }).where(eq(brands.id, current.id));
    } else {
      const [created] = await db.insert(brands).values(data).returning({ id: brands.id });
      createdId = created.id;
    }
  } catch (e) {
    // Safety net for a race (two saves at once): the database's unique-name rule.
    if (isUniqueViolation(e)) return { error: `A brand called ${data.name} already exists.`, values: echo() };
    throw e;
  }
  revalidatePath("/", "layout");
  if (createdId) redirect(`/b/${createdId}`); // outside try/catch: redirect() works by throwing
  return { saved: true };
}

/** "https://usa.dahon.com/" → "usa.dahon.com" */
function cleanDomain(d: string | undefined) {
  if (!d) return undefined;
  return d.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase() || undefined;
}

/** Postgres unique violation (23505), wherever the driver nests it. */
function isUniqueViolation(e: unknown): boolean {
  for (let cur: unknown = e, i = 0; cur && i < 5; cur = (cur as { cause?: unknown }).cause, i++) {
    if ((cur as { code?: string }).code === "23505") return true;
  }
  return false;
}

/** Automatic checks: null = off, otherwise every N hours. */
export async function setSchedule(id: string, hours: number | null) {
  await requireSession();
  const h = hours === null ? null : z.union([z.literal(6), z.literal(12), z.literal(24)]).parse(hours);
  await db.update(brands)
    .set(h === null ? { livePollingEnabled: false } : { livePollingEnabled: true, pollEveryHours: h })
    .where(eq(brands.id, Id.parse(id)));
  revalidatePath("/", "layout");
}

/** "Fill in with AI": drafts every setup field from the brand's name and website. Nothing is saved. */
export async function suggestBrand(name: string, domain: string): Promise<{ ok: true; suggestion: BrandSuggestion } | { ok: false; message: string }> {
  await requireSession();
  const n = name.trim(), d = cleanDomain(domain);
  if (!n || !d) return { ok: false, message: "Add the brand's name and website first." };
  try {
    return { ok: true, suggestion: await suggestBrandSetup(n, d) };
  } catch {
    return { ok: false, message: "The AI couldn't draft this brand right now. Please try again." };
  }
}

/**
 * Soft delete: the brand disappears from the app and is never checked, analyzed or emailed
 * again. Nothing is removed from the database; its mentions, drafts and costs stay as they were.
 */
export async function deleteBrand(id: string): Promise<{ ok: boolean; message?: string }> {
  await requireSession();
  const [brand] = await db.update(brands)
    .set({ deletedAt: new Date(), enabled: false, livePollingEnabled: false })
    .where(and(eq(brands.id, Id.parse(id)), isNull(brands.deletedAt)))
    .returning({ id: brands.id });
  if (!brand) return { ok: false, message: "This brand no longer exists." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * "Check Reddit now": always a live scrape. Starts the run and returns right away; the
 * app's activity tracker shows progress, and keeps the pipeline moving while it polls.
 */
export async function runNow(id: string): Promise<{ ok: boolean; message: string }> {
  await requireSession();
  const [brand] = await db.select().from(brands).where(and(eq(brands.id, Id.parse(id)), isNull(brands.deletedAt)));
  if (!brand) return { ok: false, message: "Brand not found." };
  let source;
  try { source = liveSource(); } catch {
    return { ok: false, message: "Live Reddit checks aren't set up on this deployment (missing APIFY_TOKEN)." };
  }
  let runId: string;
  try {
    runId = await startSearchRun(brand, { manual: true, source });
  } catch (e) {
    return { ok: false, message: e instanceof RunRefused ? e.message : `Couldn't start the check: ${e instanceof Error ? e.message : e}` };
  }
  after(async () => {
    // Collect as soon as the scrape finishes (the tracker's polling also nudges this along).
    const until = Date.now() + 240_000;
    while (Date.now() < until) {
      await collectRuns();
      const [r] = await db.select({ status: runs.status }).from(runs).where(eq(runs.id, runId));
      if (r.status !== "running" && r.status !== "starting") break;
      await new Promise((res) => setTimeout(res, 10_000));
    }
    await runTick({ budgetMs: Math.max(30_000, until - Date.now()) });
  });
  revalidatePath("/", "layout");
  return { ok: true, message: `Checking Reddit for ${brand.name}…` };
}
