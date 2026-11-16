// Run a tick (writes drafts for open reply items) and print them with their checks.
import "./env.mts";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { runTick } from "@/lib/pipeline/tick";
console.log(JSON.stringify(await runTick()));
const rows = (await db.execute(sql`
  select distinct on (d.mention_id) coalesce(p.title, m.title) title, d.final_text, d.checks
  from drafts d join mentions m on m.id = d.mention_id
  left join mentions p on p.reddit_id = m.post_id and p.kind = 'post' and p.brand_id = m.brand_id
  order by d.mention_id, d.created_at desc`)).rows as { title: string; final_text: string; checks: { items: { label: string; level: string; detail?: string }[]; notes: string } }[];
for (const r of rows) {
  const issues = r.checks.items.filter((c) => c.level !== "pass").map((c) => `${c.level}: ${c.label}${c.detail ? ` (${c.detail})` : ""}`);
  console.log(`\n### ${r.title}\n${r.final_text}\nNOTES: ${r.checks.notes}\nCHECKS: ${issues.join("; ") || "all pass"}`);
}
console.table((await db.execute(sql`select purpose, count(*)::int calls, round(sum(cost_usd)::numeric,4) usd from llm_calls where purpose in ('draft','improve') group by 1`)).rows);
process.exit(0);
