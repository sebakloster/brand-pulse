import "./env.mts";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { runTick } from "@/lib/pipeline/tick";
console.log(JSON.stringify(await runTick()));
console.table((await db.execute(sql`
  select left(title, 45) title, subreddit, num_comments n, round(comments_per_hour::numeric,1) cph, spike_active spike, spike_negative neg, spike_reason
  from mentions where kind='post' and (spike_active or comments_per_hour > 5) order by comments_per_hour desc nulls last limit 10`)).rows);
process.exit(0);
