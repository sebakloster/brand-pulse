// Shows what a brand has stored. Usage: npx tsx scripts/brand-data.mts <name>
import "./env.mts";
import { sql } from "drizzle-orm";
import { db } from "@/db";
const name = process.argv[2];
console.table((await db.execute(sql`
  select r.source, r.purpose, r.status, r.manual, r.items_count, r.started_at from runs r join brands b on b.id = r.brand_id
  where b.name = ${name} order by r.started_at`)).rows);
console.table((await db.execute(sql`
  select m.pipeline_status, count(*)::int n from mentions m join brands b on b.id = m.brand_id
  where b.name = ${name} group by 1`)).rows);
process.exit(0);
