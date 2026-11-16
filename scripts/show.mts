// Show a thread's post + triage. Usage: npm run -s show -- "title text"
import "./env.mts";
import { sql } from "drizzle-orm";
import { db } from "@/db";
const q = `%${process.argv[2]}%`;
const rows = (await db.execute(sql`
  select m.kind, m.subreddit, m.pipeline_status, m.title, m.body, t.importance, t.action, t.route_to, t.reason
  from mentions m left join triage t on t.mention_id = m.id
  where m.kind = 'post' and m.title ilike ${q} limit 2`)).rows;
for (const r of rows) console.log({ ...r, body: String(r.body ?? "").slice(0, 900) });
