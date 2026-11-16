// Re-run relevance on items judged off-brand (e.g. after a relevance fix). Usage: npm run recheck:irrelevant
import "./env.mts";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { runTick } from "@/lib/pipeline/tick";
const r = await db.execute(sql`
  update mentions set pipeline_status = 'candidate', relevance_reason = null, ai_attempts = 0
  where pipeline_status = 'irrelevant'`);
console.log(`Re-checking ${r.rowCount} items.`);
console.log(JSON.stringify(await runTick()));
console.table((await db.execute(sql`
  select m.pipeline_status st, left(m.title, 40) title, t.importance imp, t.action, left(t.reason, 90) reason
  from mentions m left join triage t on t.mention_id = m.id and t.prompt_version = 'triage-v2'
  where m.title ilike '%Pushing through pain%' and m.kind = 'post'`)).rows);
process.exit(0);
