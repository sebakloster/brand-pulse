// Summarize triage results. Usage: npm run -s triage:report [-- "title search"]
import "./env.mts";
import { sql } from "drizzle-orm";
import { db } from "@/db";
const q = process.argv[2];
if (!q) {
  console.table((await db.execute(sql`
    select t.importance, t.action, count(*)::int as n from triage t group by 1, 2 order by 1, 2`)).rows);
  console.table((await db.execute(sql`
    select m.kind, coalesce(p.title, m.title) as thread, left(coalesce(m.body,''), 60) as text from mentions m
    left join mentions p on p.reddit_id = m.post_id and p.brand_id = m.brand_id and p.kind = 'post'
    where m.pipeline_status = 'irrelevant' limit 40`)).rows);
} else {
  console.table((await db.execute(sql`
    select m.kind, t.importance as imp, t.action, t.route_to, t.sentiment as s, t.risk_flags, left(t.reason, 110) as reason
    from triage t join mentions m on m.id = t.mention_id
    left join mentions p on p.reddit_id = m.post_id and p.brand_id = m.brand_id and p.kind = 'post'
    where coalesce(p.title, m.title) ilike ${"%" + q + "%"} order by m.kind desc, t.importance limit 12`)).rows);
}
