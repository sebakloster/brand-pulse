// Runs ticks locally until there is no AI work left. Usage: npm run tick
import "./env.mts";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { runTick } from "@/lib/pipeline/tick";

for (let i = 1; i <= 10; i++) {
  const t0 = Date.now();
  const report = await runTick();
  console.log(`Tick ${i} (${((Date.now() - t0) / 1000).toFixed(0)}s):`, JSON.stringify(report));
  const [left] = (await db.execute(sql`
    select count(*)::int as n from mentions where pipeline_status in ('new', 'candidate', 'relevant')`)).rows;
  if (left.n === 0 || "skipped" in report) break;
}

const cost = await db.execute(sql`
  select purpose, model, count(*)::int as calls, sum(case when ok then 0 else 1 end)::int as failed,
         sum(input_tokens)::int as input, sum(cache_read_tokens)::int as cache_read,
         sum(cache_write_tokens)::int as cache_write, sum(output_tokens)::int as output,
         round(sum(cost_usd)::numeric, 4) as usd
  from llm_calls group by 1, 2 order by 1`);
console.table(cost.rows);
