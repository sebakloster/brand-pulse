// Prints a stratified sample of fixture candidates WITHOUT model output, for blind labeling.
import "./env.mts";
import { sql } from "drizzle-orm";
import { db } from "@/db";
const rows = (await db.execute(sql`
  with c as (
    select m.reddit_id, m.kind, m.subreddit, coalesce(p.title, m.title) as thread, m.body, m.pipeline_status,
      row_number() over (partition by m.pipeline_status order by md5(m.reddit_id)) as rn
    from mentions m left join mentions p on p.reddit_id = m.post_id and p.kind = 'post' and p.brand_id = m.brand_id
    where m.pipeline_status in ('triaged', 'irrelevant') and m.first_seen_at < now() - interval '2 hours'
  )
  select * from c where (pipeline_status = 'triaged' and rn <= 34) or (pipeline_status = 'irrelevant' and rn <= 10)
  order by md5(reddit_id)`)).rows as { reddit_id: string; kind: string; subreddit: string; thread: string; body: string }[];
for (const r of rows) {
  console.log(`\n#${r.reddit_id} [${r.kind}] r/${r.subreddit} | thread: ${(r.thread ?? "").slice(0, 90)}`);
  console.log(`   ${(r.body ?? "").replace(/\s+/g, " ").slice(0, 420)}`);
}
console.log("\n", rows.length, "items");
process.exit(0);
