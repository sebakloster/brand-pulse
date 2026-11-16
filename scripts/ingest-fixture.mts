// Replays the saved Peloton dataset through the real ingest + rule-filter code.
// Usage: npm run ingest:fixture  (safe to run repeatedly; writes are idempotent)
import "./env.mts";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { FixtureSource } from "@/lib/reddit/source";
import { ingestRun, applyRulesForBrand } from "@/lib/pipeline/ingest";
import { seed } from "./seed.mts";

const brand = await seed();
if (process.argv.includes("--reset")) {
  // Start over for this brand (dev only): rules changed and everything should be re-filtered.
  await db.execute(sql`delete from triage where mention_id in (select id from mentions where brand_id = ${brand.id})`);
  await db.execute(sql`delete from drafts where mention_id in (select id from mentions where brand_id = ${brand.id})`);
  await db.execute(sql`delete from mentions where brand_id = ${brand.id}`);
  await db.execute(sql`delete from raw_items where run_id in (select id from runs where brand_id = ${brand.id})`);
  await db.execute(sql`delete from runs where brand_id = ${brand.id}`);
  console.log("Reset brand data.");
}
const source = new FixtureSource();
const started = await source.startSearch({
  searchTerms: brand.searchTerms,
  postedAfter: new Date(0),
  commentedAfter: new Date(0),
  maxPostsCount: 50,
  maxCommentsPerPost: 200,
  maxCommentsCount: 400,
  maxTotalChargeUsd: 0,
});
const state = await source.getRun(started.externalId);
const [run] = await db.insert(schema.runs).values({
  brandId: brand.id,
  source: "fixture",
  apifyRunId: started.externalId,
  status: "succeeded",
  input: started.input as object,
  finishedAt: new Date(),
  costUsd: state.costUsd,
}).returning();

const t0 = Date.now();
const report = await ingestRun(run.id, source);
const rules = await applyRulesForBrand(brand.id);
console.log(`Ingested in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, report);
console.log("Rule outcomes for new mentions:", rules);

const totals = await db.execute(sql`
  select kind, pipeline_status, coalesce(filtered_reason, '') as reason, count(*)::int as n
  from mentions where brand_id = ${brand.id}
  group by 1, 2, 3 order by 1, 2, 3`);
console.table(totals.rows);
const limited = await db.execute(sql`
  select count(*)::int as n from mentions
  where brand_id = ${brand.id} and limited_context and pipeline_status = 'candidate'`);
console.log("Candidates with limited context (thread not fetched):", limited.rows[0].n);
