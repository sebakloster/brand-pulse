// Starting and collecting scraper runs. Runs are started and never awaited
// inside a request; each tick checks the ones in progress and ingests finished ones.
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ApifySource, FixtureSource, getRedditSource, type RedditSource } from "@/lib/reddit/source";
import { applyRulesForBrand, ingestRun } from "./ingest";

const { brands, mentions, runs, settings } = schema;
type Brand = typeof brands.$inferSelect;

export const RUN_LIMITS = {
  maxPostsCount: 50,
  maxCommentsPerPost: 50,
  maxCommentsCount: 200,
  maxChargePerRunUsd: 1.0, // hard cap passed to Apify
  snapshotWindowHours: 48,
  maxSnapshotPosts: 40,
  runTimeoutMinutes: 30,
  overlapMinutes: 60,
};

/** A brand's first live check reaches further back and fetches more, to build its history in one go. */
export const FIRST_RUN_LIMITS = {
  maxPostsCount: 200,
  maxCommentsPerPost: 50,
  maxCommentsCount: 1000,
  maxChargePerRunUsd: 3.0, // or whatever is left of the monthly budget, if less
};

export function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Apify spend this calendar month (all brands): the spend guard compares this to the budget. */
export async function apifySpendThisMonth() {
  const [r] = await db.select({ usd: sql<number>`coalesce(sum(${runs.costUsd}), 0)::float` }).from(runs)
    .where(and(eq(runs.source, "apify"), gte(runs.startedAt, monthStart())));
  return r.usd;
}

async function budget() {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  return s?.monthlyApifyBudgetUsd ?? 5;
}

export class RunRefused extends Error {}

/**
 * Last successful search run's start time, for the same kind of source: the next run fetches
 * from there (minus an overlap). Replays of the saved dataset never move a live cursor.
 */
async function cursor(brandId: string, kind: RedditSource["kind"]) {
  const [last] = await db.select().from(runs)
    .where(and(eq(runs.brandId, brandId), eq(runs.purpose, "search"), eq(runs.status, "succeeded"), eq(runs.source, kind)))
    .orderBy(desc(runs.startedAt)).limit(1);
  return last?.startedAt ?? null;
}

async function inProgress(brandId: string) {
  const rows = await db.select({ id: runs.id }).from(runs)
    .where(and(eq(runs.brandId, brandId), inArray(runs.status, ["starting", "running"])));
  return rows.length > 0;
}

export async function startSearchRun(brand: Brand, { manual = false, source = getRedditSource() } = {}) {
  if (await inProgress(brand.id)) throw new RunRefused("A run for this brand is already in progress.");
  const last = await cursor(brand.id, source.kind);
  const first = !last;
  const limits = first ? FIRST_RUN_LIMITS : RUN_LIMITS;
  let charge: number = limits.maxChargePerRunUsd;
  if (source.kind === "apify") {
    const [spent, limit] = await Promise.all([apifySpendThisMonth(), budget()]);
    // The first check may use less than its full cap if that's all the budget has left.
    charge = Math.min(charge, limit - spent);
    if (charge < RUN_LIMITS.maxChargePerRunUsd) {
      throw new RunRefused(`Monthly scraper budget reached ($${spent.toFixed(2)} of $${limit.toFixed(2)}). Raise it in Settings.`);
    }
  }
  const since = last
    ? new Date(last.getTime() - RUN_LIMITS.overlapMinutes * 60_000)
    : new Date(Date.now() - brand.backfillDays * 86_400_000);
  const [row] = await db.insert(runs).values({ brandId: brand.id, source: source.kind, purpose: "search", manual, status: "starting" }).returning();
  try {
    const started = await source.startSearch({
      searchTerms: brand.searchTerms,
      postedAfter: since,
      commentedAfter: since,
      maxPostsCount: limits.maxPostsCount,
      maxCommentsPerPost: limits.maxCommentsPerPost,
      maxCommentsCount: limits.maxCommentsCount,
      maxTotalChargeUsd: Math.round(charge * 100) / 100,
    });
    await db.update(runs).set({ apifyRunId: started.externalId, input: started.input as object, status: "running" }).where(eq(runs.id, row.id));
  } catch (e) {
    await db.update(runs).set({ status: "failed", error: `start failed: ${e instanceof Error ? e.message : e}`, finishedAt: new Date() }).where(eq(runs.id, row.id));
    throw e;
  }
  // Snapshots of recent relevant threads ride along with each search run.
  await startSnapshotRun(brand, source).catch(() => {});
  return row.id;
}

async function startSnapshotRun(brand: Brand, source: RedditSource) {
  const since = new Date(Date.now() - RUN_LIMITS.snapshotWindowHours * 3_600_000);
  const posts = await db.select({ url: mentions.url }).from(mentions)
    .where(and(eq(mentions.brandId, brand.id), eq(mentions.kind, "post"),
      inArray(mentions.pipelineStatus, ["relevant", "triaged"]), eq(mentions.isDeleted, false),
      gte(mentions.createdAtReddit, since)))
    .orderBy(desc(mentions.createdAtReddit)).limit(RUN_LIMITS.maxSnapshotPosts);
  const urls = posts.map((p) => p.url).filter((u): u is string => !!u);
  if (source.kind === "apify" && urls.length === 0) return;
  const started = await source.startSnapshot(urls, 0.2);
  await db.insert(runs).values({
    brandId: brand.id, source: source.kind, purpose: "snapshot", status: "running",
    apifyRunId: started.externalId, input: started.input as object,
  });
}

/** Brands whose scheduled live polling is due. */
export async function dueBrands() {
  const active = await db.select().from(brands)
    .where(and(eq(brands.enabled, true), eq(brands.livePollingEnabled, true), isNull(brands.deletedAt)));
  const due: Brand[] = [];
  for (const b of active) {
    const [last] = await db.select({ at: runs.startedAt }).from(runs)
      .where(and(eq(runs.brandId, b.id), eq(runs.purpose, "search"), inArray(runs.status, ["starting", "running", "succeeded"])))
      .orderBy(desc(runs.startedAt)).limit(1);
    if (!last || Date.now() - last.at.getTime() >= b.pollEveryHours * 3_600_000) due.push(b);
  }
  return due;
}

/** A live scrape: manual checks always use this, whatever the default source is. */
export function liveSource() {
  return new ApifySource(); // throws a clear error when APIFY_TOKEN is missing
}

/** Checks runs in progress (each with the source that started it); ingests the finished ones. */
export async function collectRuns() {
  const open = await db.select().from(runs).where(inArray(runs.status, ["starting", "running"]));
  const report: Record<string, string> = {};
  const sources: Partial<Record<RedditSource["kind"], RedditSource | null>> = {};
  const sourceFor = (kind: RedditSource["kind"]) => {
    if (!(kind in sources)) {
      try { sources[kind] = kind === "apify" ? new ApifySource() : new FixtureSource(); } catch { sources[kind] = null; }
    }
    return sources[kind];
  };
  for (const run of open) {
    if (!run.brandId) {
      // The brand was deleted while this run was in flight: close it, never ingest it.
      await db.update(runs).set({ status: "failed", finishedAt: new Date(), error: "Brand deleted" }).where(eq(runs.id, run.id));
      continue;
    }
    const ageMin = (Date.now() - run.startedAt.getTime()) / 60_000;
    const source = sourceFor(run.source);
    if (!run.apifyRunId || !source) {
      // A start that crashed halfway leaves a run with no external id; without this it would
      // count as "in progress" forever and block every future check for the brand.
      if (ageMin > RUN_LIMITS.runTimeoutMinutes) {
        await db.update(runs).set({ status: "timed_out", finishedAt: new Date(), error: run.error ?? "never started" }).where(eq(runs.id, run.id));
        report[run.id] = "timed_out";
      }
      continue;
    }
    try {
      const state = await source.getRun(run.apifyRunId);
      if (state.status === "running") {
        if (ageMin > RUN_LIMITS.runTimeoutMinutes) {
          await db.update(runs).set({ status: "timed_out", finishedAt: new Date(), error: `still running after ${Math.round(ageMin)} min` }).where(eq(runs.id, run.id));
          report[run.id] = "timed_out";
        }
        continue;
      }
      if (state.status !== "succeeded") {
        await db.update(runs).set({ status: state.status, finishedAt: new Date(), error: state.error, costUsd: state.costUsd, costDetail: state.costDetail as object }).where(eq(runs.id, run.id));
        report[run.id] = state.status;
        continue;
      }
      const ing = await ingestRun(run.id, source);
      // A cap hit means the window may have more items than we fetched: say so (never silent).
      const postCap = (run.input as { maxPostsCount?: number } | null)?.maxPostsCount ?? RUN_LIMITS.maxPostsCount;
      const capHit = run.purpose === "search" && ing.posts >= postCap;
      await db.update(runs).set({
        status: "succeeded", finishedAt: new Date(), costUsd: state.costUsd, costDetail: state.costDetail as object,
        capHit, warning: capHit ? "Hit the post cap: some mentions in this window may be missing. Poll more often or raise the cap." : null,
      }).where(eq(runs.id, run.id));
      await applyRulesForBrand(run.brandId!);
      report[run.id] = `ingested ${ing.items}`;
    } catch (e) {
      // Keep retrying on later ticks, but not forever: a run we can never read times out too.
      const expired = ageMin > RUN_LIMITS.runTimeoutMinutes * 2;
      await db.update(runs).set({
        error: `collect failed: ${e instanceof Error ? e.message : e}`,
        ...(expired ? { status: "timed_out" as const, finishedAt: new Date() } : {}),
      }).where(eq(runs.id, run.id));
      report[run.id] = expired ? "timed_out" : "error";
    }
  }
  return report;
}

export async function recentRuns(brandId: string, limit = 10) {
  return db.select().from(runs).where(eq(runs.brandId, brandId)).orderBy(desc(runs.startedAt)).limit(limit);
}
