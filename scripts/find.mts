// Find mentions by text. Usage: npm run -s find -- "text"
import "./env.mts";
import { sql } from "drizzle-orm";
import { db } from "@/db";
const q = `%${process.argv[2]}%`;
console.table((await db.execute(sql`
  select kind, subreddit, pipeline_status as status, filtered_reason as reason, is_direct_match as direct,
         limited_context as limited, left(coalesce(title,''),50) as title, left(coalesce(body,''),50) as body
  from mentions where (title ilike ${q} or body ilike ${q}) order by kind desc limit 8`)).rows);
