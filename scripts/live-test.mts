// One small live Apify run through the real code path.
// Usage: npm run live:test   (~5 posts, 1 day back, hard cap $0.40)
import "./env.mts";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ApifySource } from "@/lib/reddit/source";
import { collectRuns } from "@/lib/pipeline/runs";

const source = new ApifySource();
const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.name, "Peloton"));
const since = new Date(Date.now() - 86_400_000);
const started = await source.startSearch({
  searchTerms: brand.searchTerms, postedAfter: since, commentedAfter: since,
  maxPostsCount: 5, maxCommentsPerPost: 10, maxCommentsCount: 20, maxTotalChargeUsd: 0.4,
});
const [run] = await db.insert(schema.runs).values({
  brandId: brand.id, source: "apify", purpose: "search", manual: true, status: "running",
  apifyRunId: started.externalId, input: started.input as object,
}).returning();
console.log("Started Apify run", started.externalId, "input:", JSON.stringify(started.input));

const t0 = Date.now();
for (;;) {
  await new Promise((r) => setTimeout(r, 15_000));
  const report = await collectRuns(source);
  const [r] = await db.select().from(schema.runs).where(eq(schema.runs.id, run.id));
  console.log(`${Math.round((Date.now() - t0) / 1000)}s: ${r.status}`, JSON.stringify(report));
  if (r.status !== "running") {
    console.log({ status: r.status, items: r.itemsCount, costUsd: r.costUsd, costDetail: r.costDetail, warning: r.warning, error: r.error });
    break;
  }
  if (Date.now() - t0 > 9 * 60_000) { console.log("Still running after 9 min; the next tick will collect it."); break; }
}
process.exit(0);
