// Re-run the AI steps on stored data after a prompt change.
// Old triage rows are kept (they carry their prompt_version). Usage: npm run reset:ai
import "./env.mts";
import { sql } from "drizzle-orm";
import { db } from "@/db";
const a = await db.execute(sql`
  update mentions set pipeline_status = 'candidate', ai_attempts = 0, triage_error = null, relevance_reason = null
  where pipeline_status in ('relevant', 'irrelevant', 'triaged', 'triage_failed')
     or (pipeline_status = 'filtered' and filtered_reason = 'non_english')`);
const b = await db.execute(sql`
  update mentions set pipeline_status = 'context', filtered_reason = null
  where pipeline_status = 'filtered' and filtered_reason = 'thread_not_about_brand'`);
console.log(`Reset ${a.rowCount} items to candidate and ${b.rowCount} thread comments to context.`);
