// Ad-hoc look at filtered items. Usage: npm run -s inspect -- <reason> [kind]
import "./env.mts";
import { sql } from "drizzle-orm";
import { db } from "@/db";
const [reason, kind = "post"] = process.argv.slice(2);
const r = await db.execute(sql`
  select subreddit, author, left(coalesce(title, ''), 70) as title, left(coalesce(body, ''), 90) as body
  from mentions where filtered_reason = ${reason} and kind = ${kind}::mention_kind limit 12`);
console.table(r.rows);
