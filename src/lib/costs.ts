// Real costs: Apify run cost as reported per run + Claude tokens × price per call.
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { monthStart } from "@/lib/pipeline/runs";

export type BrandCost = {
  brandId: string;
  apifyUsd: number;
  claudeUsd: number;
  byPurpose: Record<string, number>;
  totalUsd: number;
  perDayUsd: number;
  projectedMonthUsd: number;
  runs: number;
  llmCalls: number;
};

export async function brandCosts(): Promise<Map<string, BrandCost>> {
  const from = monthStart();
  const now = new Date();
  const daysElapsed = Math.max(1, (now.getTime() - from.getTime()) / 86_400_000);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();

  const apify = (await db.execute(sql`
    select brand_id, coalesce(sum(cost_usd), 0)::float as usd, count(*)::int as runs
    from runs where started_at >= ${from} group by brand_id`)).rows as { brand_id: string; usd: number; runs: number }[];
  const claude = (await db.execute(sql`
    select brand_id, purpose, coalesce(sum(cost_usd), 0)::float as usd, count(*)::int as calls
    from llm_calls where created_at >= ${from} and brand_id is not null group by brand_id, purpose`)).rows as
    { brand_id: string; purpose: string; usd: number; calls: number }[];

  const out = new Map<string, BrandCost>();
  const get = (id: string) => {
    if (!out.has(id)) out.set(id, { brandId: id, apifyUsd: 0, claudeUsd: 0, byPurpose: {}, totalUsd: 0, perDayUsd: 0, projectedMonthUsd: 0, runs: 0, llmCalls: 0 });
    return out.get(id)!;
  };
  for (const a of apify) { const c = get(a.brand_id); c.apifyUsd = a.usd; c.runs = a.runs; }
  for (const l of claude) {
    const c = get(l.brand_id);
    c.claudeUsd += l.usd; c.llmCalls += l.calls;
    c.byPurpose[l.purpose] = (c.byPurpose[l.purpose] ?? 0) + l.usd;
  }
  for (const c of out.values()) {
    c.totalUsd = c.apifyUsd + c.claudeUsd;
    c.perDayUsd = c.totalUsd / daysElapsed;
    c.projectedMonthUsd = c.perDayUsd * daysInMonth;
  }
  return out;
}

export type ScheduleEstimates = Record<number, { perCheck: number; perMonth: number }>;

/**
 * What automatic checks would cost for this brand. The scraping rate (cost per day of Reddit
 * covered) is learned from the brand's own live checks: cost ÷ length of the window each one
 * covered. Brands without live checks yet use a busy-brand default (~$0.95/day).
 */
export async function scheduleEstimates(brandId: string): Promise<ScheduleEstimates> {
  const [r] = (await db.execute(sql`
    select sum(cost_usd)::float as cost,
      sum(extract(epoch from (started_at - (input->>'postedAfter')::timestamptz)) / 86400)::float as days
    from runs
    where brand_id = ${brandId} and source = 'apify' and purpose = 'search' and status = 'succeeded'
      and cost_usd is not null and input ? 'postedAfter' and started_at >= now() - interval '30 days'`)).rows as
    { cost: number | null; days: number | null }[];
  const scrapePerDay = r.cost != null && r.days && r.days > 0.05 ? r.cost / r.days : 0.95;
  const aiPerDay = Math.min(0.5, scrapePerDay * 0.6); // analysis cost grows with volume
  const out: ScheduleEstimates = {};
  for (const h of [6, 12, 24]) {
    const perCheck = 0.02 + scrapePerDay * ((h + 1) / 24); // each check re-reads a 1-hour overlap
    out[h] = { perCheck, perMonth: perCheck * (24 / h) * 30 + aiPerDay * 30 };
  }
  return out;
}
