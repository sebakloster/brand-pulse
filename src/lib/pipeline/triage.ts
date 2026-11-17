// Step 6: triage relevant mentions with thread context.
// One call per thread: the post and its comments are sent once and every
// relevant mention in that thread is triaged together (cheaper, more consistent).
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { MODELS, structuredCall } from "@/lib/llm/client";
import { TRIAGE_VERSION, triageSystem } from "@/lib/llm/prompts";
import { cleanText } from "@/lib/llm/clean";
import { chunks, excerpt, pMap, truncate, type Deadline } from "@/lib/util";
import { compileRules } from "./rules";

const { brands, mentions, triage } = schema;
const MAX_ITEMS_PER_CALL = 12;
const CONTEXT_COMMENTS = 15;

export const ROUTE_TO = ["support", "product", "content_talent", "security", "legal", "marketing", "partnerships", "pr_comms"] as const;
export const RISK_FLAGS = ["safety_medical", "legal", "security_privacy", "named_staff", "crisis_signal", "competitor", "misinformation"] as const;
export const INTENTS = ["complaint", "question", "praise", "purchase_intent", "feedback", "discussion", "other"] as const;

const Item = z.object({
  id: z.string(),
  sentiment: z.number(),
  topic: z.string(),
  intent: z.enum(INTENTS),
  risk_flags: z.array(z.enum(RISK_FLAGS)),
  importance: z.enum(["P0", "P1", "P2", "P3"]),
  action: z.enum(["reply", "route", "monitor", "ignore"]),
  route_to: z.enum(ROUTE_TO).nullable(),
  reason: z.string(),
});
const Output = z.object({ items: z.array(Item) });
export type TriageItem = z.infer<typeof Item>;

type Mention = typeof mentions.$inferSelect;

function renderMention(m: Mention, tag: "item" | "comment", extra = "", brandRe: RegExp | null = null) {
  return [
    `<${tag} id="${m.id}" kind="${m.kind}" author="${m.author ?? "unknown"}" score="${m.score ?? 0}"` +
      ` posted="${m.createdAtReddit.toISOString().slice(0, 16)}"${extra}>`,
    excerpt(m.body, tag === "item" ? 1500 : 400, brandRe),
    `</${tag}>`,
  ].join("\n");
}

export async function buildThreadPrompt(brandId: string, postId: string, items: Mention[], brandRe: RegExp | null) {
  const [post] = await db.select().from(mentions)
    .where(and(eq(mentions.brandId, brandId), eq(mentions.redditId, postId)));
  const itemIds = new Set(items.map((i) => i.redditId));

  // Top comments for context (excluding the items themselves).
  const context = (await db.select().from(mentions)
    .where(and(eq(mentions.brandId, brandId), eq(mentions.postId, postId), eq(mentions.kind, "comment"),
      inArray(mentions.pipelineStatus, ["context", "relevant", "triaged"])))
    .orderBy(desc(mentions.score))
    .limit(CONTEXT_COMMENTS + items.length))
    .filter((c) => !itemIds.has(c.redditId))
    .slice(0, CONTEXT_COMMENTS);

  // Parent chain for comment items (what are they replying to?).
  const parentIds = items.map((i) => i.parentId).filter((p): p is string => !!p && p !== postId && !itemIds.has(p));
  const parents = parentIds.length
    ? await db.select().from(mentions).where(and(eq(mentions.brandId, brandId), inArray(mentions.redditId, parentIds)))
    : [];
  const parentById = new Map(parents.map((p) => [p.redditId, p]));

  const threadHeader = post
    ? [
        `<thread subreddit="r/${post.subreddit}" score="${post.score ?? 0}" comments="${post.numComments ?? 0}"` +
          ` upvote_ratio="${post.upvoteRatio ?? ""}" posted="${post.createdAtReddit.toISOString().slice(0, 16)}">`,
        `Title: ${truncate(post.title, 300)}`,
        `Post by ${post.author ?? "unknown"}: ${excerpt(post.body, 2000, brandRe)}`,
        context.length ? `\nTop comments (context only):\n${context.map((c) => renderMention(c, "comment", "", brandRe)).join("\n")}` : "",
        `</thread>`,
      ].join("\n")
    : `<thread subreddit="r/${items[0].subreddit}" fetched="false">\nPost title: ${truncate(items[0].title, 300) || "(unknown)"}\n</thread>`;

  const itemText = items.map((m) => {
    if (m.kind === "post") return renderMention({ ...m, body: `${m.title ?? ""}\n\n${m.body ?? ""}` }, "item", "", brandRe);
    const parent = m.parentId ? parentById.get(m.parentId) : undefined;
    const replyTo = parent ? `\nReplying to ${parent.author ?? "someone"}: "${truncate(parent.body, 300)}"` : "";
    const limited = m.limitedContext ? ` limited_context="true"` : "";
    return renderMention({ ...m, body: `${m.body ?? ""}${replyTo}` }, "item", limited, brandRe);
  }).join("\n\n");

  return `${threadHeader}\n\nTriage these ${items.length} item(s):\n\n${itemText}`;
}

/** One triage call for items of one thread (production and evals use the same prompt and code). */
export async function triageThread(
  brand: typeof brands.$inferSelect,
  postId: string,
  items: Mention[],
  { purpose = "triage", logBrandId = brand.id as string | null }: { purpose?: "triage" | "eval"; logBrandId?: string | null } = {},
) {
  const out = await structuredCall({
    purpose, brandId: logBrandId, model: MODELS.triage, system: triageSystem(brand),
    user: await buildThreadPrompt(brand.id, postId, items, compileRules(brand).brand),
    schema: Output, maxTokens: 8000, effort: "medium",
  });
  return new Map(out.items.map((i) => [i.id, i]));
}

export async function runTriage(brandId: string, deadline: Deadline, { limit = 200, concurrency = 4 } = {}) {
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId));
  const pending = await db.select().from(mentions)
    .where(and(eq(mentions.brandId, brandId), eq(mentions.pipelineStatus, "relevant")))
    .limit(limit);
  const stats = { triaged: 0, failed: 0, calls: 0 };
  if (pending.length === 0) return stats;

  const byThread = new Map<string, Mention[]>();
  for (const m of pending) {
    const thread = byThread.get(m.postId);
    if (thread) thread.push(m); else byThread.set(m.postId, [m]);
  }
  const jobs = [...byThread.entries()].flatMap(([postId, ms]) => chunks(ms, MAX_ITEMS_PER_CALL).map((items) => ({ postId, items })));

  const results = await pMap(jobs, concurrency, async ({ postId, items }) => {
    if (deadline.passed) return;
    stats.calls++;
    const byId = await triageThread(brand, postId, items);
    const done: string[] = [];
    const rows = items.flatMap((m) => {
      const t = byId.get(m.id);
      if (!t) return [];
      done.push(m.id);
      return [{
        mentionId: m.id,
        sentiment: Math.max(-2, Math.min(2, Math.round(t.sentiment))),
        topic: cleanText(t.topic, 80).text,
        intent: t.intent,
        riskFlags: t.risk_flags,
        importance: t.importance,
        action: t.action,
        routeTo: t.action === "route" || t.action === "reply" ? t.route_to : null,
        reason: cleanText(t.reason, 300).text,
        model: MODELS.triage,
        promptVersion: TRIAGE_VERSION,
      }];
    });
    if (rows.length) {
      await db.insert(triage).values(rows).onConflictDoNothing();
      await db.update(mentions).set({ pipelineStatus: "triaged", triageError: null }).where(inArray(mentions.id, done));
    }
    stats.triaged += rows.length;
  });

  // Failures: count attempts; after 2, show the item as "triage failed" with the error (never silent).
  for (const [i, r] of results.entries()) {
    if (r.ok) continue;
    const ids = jobs[i].items.map((m) => m.id);
    const msg = r.error instanceof Error ? r.error.message : String(r.error);
    stats.failed += ids.length;
    await db.update(mentions).set({ aiAttempts: sql`${mentions.aiAttempts} + 1`, triageError: msg.slice(0, 300) })
      .where(inArray(mentions.id, ids));
    await db.update(mentions).set({ pipelineStatus: "triage_failed" })
      .where(and(inArray(mentions.id, ids), sql`${mentions.aiAttempts} >= 2`));
  }
  return stats;
}
