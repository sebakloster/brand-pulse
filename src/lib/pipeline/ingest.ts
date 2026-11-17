// Ingest a finished run: raw items → validated → normalized → upserted → rule-filtered.
// Every write is idempotent, so re-ingesting the same run (or overlapping runs) is safe.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { parseItem, type NormalizedMention } from "@/lib/reddit/normalize";
import type { RedditSource } from "@/lib/reddit/source";
import { applyRules, compileRules, type RuleOutcome } from "./rules";

const { brands, mentions, rawItems, runs, snapshots } = schema;
const BATCH = 200;

function chunks<T>(xs: T[], n = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export type IngestReport = {
  items: number;
  invalid: number;
  posts: number;
  comments: number;
  deleted: number;
};

export async function ingestRun(runId: string, source: RedditSource): Promise<IngestReport> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (!run?.apifyRunId) throw new Error(`run ${runId} has no external id`);
  if (!run.brandId) throw new Error(`run ${runId} belongs to a deleted brand`);
  const brandId = run.brandId;

  const parsed: { mention: NormalizedMention; raw: unknown }[] = [];
  const invalid: { id: string | null; error: string }[] = [];
  const seen = new Set<string>();

  for await (const page of source.items(run.apifyRunId)) {
    for (const raw of page) {
      const r = parseItem(raw);
      if (!r.ok) { invalid.push({ id: r.redditId, error: r.error }); continue; }
      if (seen.has(r.redditId)) continue; // duplicates inside one dataset
      seen.add(r.redditId);
      parsed.push({ mention: r.mention, raw });
    }
  }

  // 1. Raw items: insert once, never modified.
  for (const batch of chunks(parsed)) {
    await db.insert(rawItems)
      .values(batch.map((p) => ({ redditId: p.mention.redditId, runId, payload: p.raw as object })))
      .onConflictDoNothing();
  }

  // 2. Mentions: insert new; refresh engagement on ones we already have.
  for (const batch of chunks(parsed)) {
    await db.insert(mentions)
      .values(batch.map(({ mention: m }) => ({
        brandId,
        redditId: m.redditId,
        kind: m.kind,
        postId: m.postId,
        parentId: m.parentId,
        depth: m.depth,
        subreddit: m.subreddit,
        author: m.author,
        title: m.title,
        body: m.isDeleted ? null : m.body,
        url: m.url,
        createdAtReddit: m.createdAtReddit,
        score: m.score,
        numComments: m.numComments,
        upvoteRatio: m.upvoteRatio,
        commentsPerHour: m.commentsPerHour,
        isDeleted: m.isDeleted,
        isBotLike: m.isBotLike,
      })))
      .onConflictDoUpdate({
        target: [mentions.brandId, mentions.redditId],
        set: {
          score: sql`excluded.score`,
          numComments: sql`coalesce(excluded.num_comments, ${mentions.numComments})`,
          upvoteRatio: sql`coalesce(excluded.upvote_ratio, ${mentions.upvoteRatio})`,
          lastSeenAt: sql`now()`,
          // New comments on a thread we already had: "new activity" for followed threads.
          lastActivityAt: sql`case when excluded.num_comments > ${mentions.numComments} then now() else ${mentions.lastActivityAt} end`,
          // Respect deletions: once Reddit shows it deleted, drop the text and keep it dropped.
          isDeleted: sql`${mentions.isDeleted} or excluded.is_deleted`,
          body: sql`case when ${mentions.isDeleted} or excluded.is_deleted then null else excluded.body end`,
        },
      });
  }

  // 3. Engagement snapshot for every post seen.
  const postSnaps = parsed.filter((p) => p.mention.kind === "post").map(({ mention: m }) => ({
    postId: m.redditId,
    takenAt: m.crawledAt ?? new Date(),
    score: m.score,
    numComments: m.numComments,
    upvoteRatio: m.upvoteRatio,
  }));
  for (const batch of chunks(postSnaps)) {
    await db.insert(snapshots).values(batch).onConflictDoNothing();
  }

  // 4. Wipe text from raw payloads of deleted items too.
  const deletedIds = parsed.filter((p) => p.mention.isDeleted).map((p) => p.mention.redditId);
  for (const batch of chunks(deletedIds)) {
    await db.update(rawItems)
      .set({ payload: sql`${rawItems.payload} - 'body' - 'bodyHtml' - 'title'` })
      .where(inArray(rawItems.redditId, batch));
  }

  const report: IngestReport = {
    items: parsed.length + invalid.length,
    invalid: invalid.length,
    posts: parsed.filter((p) => p.mention.kind === "post").length,
    comments: parsed.filter((p) => p.mention.kind === "comment").length,
    deleted: deletedIds.length,
  };
  await db.update(runs).set({
    ingestedAt: new Date(),
    itemsCount: report.items,
    error: invalid.length ? `${invalid.length} items failed validation (first: ${invalid[0].error.slice(0, 200)})` : run.error,
  }).where(eq(runs.id, runId));
  return report;
}

/**
 * Apply the rule filters to every mention of a brand that is still `new`.
 * Posts first, so comments can inherit their post's outcome.
 */
export async function applyRulesForBrand(brandId: string) {
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId));
  if (!brand) throw new Error(`brand ${brandId} not found`);
  const rules = compileRules(brand);

  const pending = await db.select().from(mentions)
    .where(and(eq(mentions.brandId, brandId), eq(mentions.pipelineStatus, "new")));
  if (pending.length === 0) return {};

  // Outcomes of posts already processed earlier (for comments arriving in later runs).
  const postIds = [...new Set(pending.filter((m) => m.kind === "comment").map((m) => m.postId))];
  const knownPosts = postIds.length
    ? await db.select({ redditId: mentions.redditId, status: mentions.pipelineStatus, reason: mentions.filteredReason, isBotLike: mentions.isBotLike })
        .from(mentions)
        .where(and(eq(mentions.brandId, brandId), eq(mentions.kind, "post"), inArray(mentions.redditId, postIds)))
    : [];
  const postOutcome = new Map<string, RuleOutcome>();
  for (const p of knownPosts) {
    if (p.status === "new") continue; // computed below
    // Anything past the rule stage (candidate, relevant, triaged…) counts as a brand thread.
    postOutcome.set(p.redditId, p.status === "filtered"
      ? { status: "filtered", reason: (p.reason ?? "no_brand_word") as never, isDirectMatch: false }
      : p.status === "context"
        ? { status: "context", isDirectMatch: false, ...(p.isBotLike ? { megathread: true as const } : {}) }
      : p.status === "irrelevant"
        ? { status: "filtered", reason: "thread_not_about_brand", isDirectMatch: false }
        : { status: "candidate", isDirectMatch: true });
  }
  const knownPostIds = new Set([
    ...knownPosts.map((p) => p.redditId),
    ...pending.filter((m) => m.kind === "post").map((m) => m.redditId),
  ]);

  type Update = { id: string; outcome: RuleOutcome; limitedContext: boolean };
  const updates: Update[] = [];
  for (const m of pending.filter((x) => x.kind === "post")) {
    const outcome = applyRules(m, rules);
    postOutcome.set(m.redditId, outcome);
    updates.push({ id: m.id, outcome, limitedContext: false });
  }
  for (const m of pending.filter((x) => x.kind === "comment")) {
    const outcome = applyRules(m, rules, postOutcome.get(m.postId));
    const limitedContext = !knownPostIds.has(m.postId);
    updates.push({ id: m.id, outcome, limitedContext });
  }

  // Few distinct outcomes → a handful of UPDATE … WHERE id IN (…) statements, not one per row.
  const groups = new Map<string, Update[]>();
  for (const u of updates) {
    const key = JSON.stringify([u.outcome.status, "reason" in u.outcome ? u.outcome.reason : null, u.outcome.isDirectMatch, u.limitedContext]);
    groups.set(key, [...(groups.get(key) ?? []), u]);
  }
  const counts: Record<string, number> = {};
  for (const [key, us] of groups) {
    const [status, reason, isDirectMatch, limitedContext] = JSON.parse(key) as [RuleOutcome["status"], string | null, boolean, boolean];
    for (const batch of chunks(us.map((u) => u.id))) {
      await db.update(mentions)
        .set({ pipelineStatus: status, filteredReason: reason, isDirectMatch, limitedContext })
        .where(inArray(mentions.id, batch));
    }
    const label = reason ? `${status}:${reason}` : status;
    counts[label] = (counts[label] ?? 0) + us.length;
  }
  return counts;
}
