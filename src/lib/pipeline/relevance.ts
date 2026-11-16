// Step 5: is each candidate about the brand? Cheap model, batched.
// Comments in threads judged off-brand inherit that verdict without a model call.
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { MODELS, structuredCall } from "@/lib/llm/client";
import { relevanceSystem } from "@/lib/llm/prompts";
import { cleanText } from "@/lib/llm/clean";
import { chunks, excerpt, pMap, truncate, type Deadline } from "@/lib/util";
import { compileRules } from "./rules";

const { brands, mentions } = schema;
const BATCH = 15;

const Output = z.object({
  items: z.array(z.object({
    id: z.string(),
    about_brand: z.enum(["yes", "no", "unsure"]),
    language: z.string(),
    reason: z.string(),
  })),
});

export type RelevanceVerdict = z.infer<typeof Output>["items"][number];

/** One relevance call for a batch (production and evals use the same prompt and code). */
export async function checkRelevance(
  brand: typeof brands.$inferSelect,
  batch: (typeof mentions.$inferSelect)[],
  { purpose = "relevance", logBrandId = brand.id as string | null }: { purpose?: "relevance" | "eval"; logBrandId?: string | null } = {},
) {
  const brandRe = compileRules(brand).brand;
  const user = batch.map((m) => [
    `<item id="${m.id}" kind="${m.kind}" subreddit="r/${m.subreddit}">`,
    m.kind === "comment" && m.title ? `Post title: ${truncate(m.title, 200)}` : null,
    m.kind === "post" ? `Title: ${truncate(m.title, 300)}` : null,
    `Text: ${excerpt(m.body, 1200, brandRe)}`,
    `</item>`,
  ].filter(Boolean).join("\n")).join("\n\n");
  const out = await structuredCall({
    purpose, brandId: logBrandId, model: MODELS.relevance,
    system: relevanceSystem(brand), user: `Check these ${batch.length} items:\n\n${user}`,
    schema: Output, maxTokens: 4000, effort: "low", thinkingOff: true,
  });
  return new Map(out.items.map((i) => [i.id, i]));
}

export async function runRelevance(brandId: string, deadline: Deadline, { limit = 300, concurrency = 4 } = {}) {
  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId));
  const pending = await db.select().from(mentions)
    .where(and(eq(mentions.brandId, brandId), eq(mentions.pipelineStatus, "candidate")))
    .orderBy(mentions.kind) // comments before posts alphabetically; order doesn't matter here
    .limit(limit);
  if (pending.length === 0) return { checked: 0, relevant: 0, irrelevant: 0, nonEnglish: 0, failed: 0 };

  const stats = { checked: 0, relevant: 0, irrelevant: 0, nonEnglish: 0, failed: 0 };

  const batches = chunks(pending, BATCH);
  const results = await pMap(batches, concurrency, async (batch) => {
    if (deadline.passed) return; // leave for the next tick
    const byId = await checkRelevance(brand, batch);
    const yes: string[] = [], no: string[] = [], foreign: { id: string; lang: string }[] = [];
    const reasons = new Map<string, string>();
    for (const m of batch) {
      const v = byId.get(m.id);
      if (!v) continue; // model skipped it: stays a candidate, retried next tick
      reasons.set(m.id, cleanText(v.reason, 200).text);
      const lang = v.language.toLowerCase().slice(0, 2);
      if (lang !== "en" && v.about_brand !== "no") foreign.push({ id: m.id, lang });
      else if (v.about_brand === "no") no.push(m.id);
      else yes.push(m.id); // "unsure" counts as relevant (conservative)
    }
    if (yes.length) await db.update(mentions).set({ pipelineStatus: "relevant", language: "en" }).where(inArray(mentions.id, yes));
    // Keep the model's reason for rejected items: the UI shows why something was dropped.
    for (const id of no) {
      await db.update(mentions).set({ pipelineStatus: "irrelevant", relevanceReason: reasons.get(id) }).where(eq(mentions.id, id));
    }
    for (const f of foreign) {
      await db.update(mentions)
        .set({ pipelineStatus: "filtered", filteredReason: "non_english", language: f.lang })
        .where(eq(mentions.id, f.id));
    }
    stats.checked += yes.length + no.length + foreign.length;
    stats.relevant += yes.length;
    stats.irrelevant += no.length;
    stats.nonEnglish += foreign.length;
  });
  // Failed batches: count an attempt. After 2 failures, keep the items (conservative: treat as
  // relevant so a human sees them) instead of retrying forever and paying each time.
  for (const [i, r] of results.entries()) {
    if (r.ok) continue;
    const ids = batches[i].map((m) => m.id);
    stats.failed += ids.length;
    await db.update(mentions).set({ aiAttempts: sql`${mentions.aiAttempts} + 1` }).where(inArray(mentions.id, ids));
    await db.update(mentions).set({ pipelineStatus: "relevant", language: "en" })
      .where(and(inArray(mentions.id, ids), sql`${mentions.aiAttempts} >= 2`));
  }

  // Off-brand threads: their context comments go nowhere, at no cost.
  await db.execute(sql`
    update ${mentions} c set pipeline_status = 'filtered', filtered_reason = 'thread_not_about_brand'
    from ${mentions} p
    where c.brand_id = ${brandId} and p.brand_id = ${brandId}
      and c.kind = 'comment' and c.pipeline_status = 'context'
      and p.kind = 'post' and p.reddit_id = c.post_id
      and (p.pipeline_status = 'irrelevant' or (p.pipeline_status = 'filtered' and p.filtered_reason = 'non_english'))`);

  return stats;
}
