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

/**
 * Steady-state estimate for live polling, from the brand's real recent runs when there
 * are any, else from a default estimate (~378 rows/day at $2/1k, ~$0.5/day Claude).
 */
export async function liveEstimate(brandId: string, pollEveryHours: number) {
  const [r] = (await db.execute(sql`
    select avg(cost_usd)::float as avg_run from runs
    where brand_id = ${brandId} and source = 'apify' and purpose = 'search' and status = 'succeeded'
      and started_at >= now() - interval '30 days'`)).rows as { avg_run: number | null }[];
  const runsPerDay = 24 / pollEveryHours;
  const apifyPerDay = r.avg_run != null ? r.avg_run * runsPerDay : 0.95;
  const claudePerDay = 0.5;
  return { basis: r.avg_run != null ? "recent runs" : "default estimate", apifyPerDay, claudePerDay, perMonth: (apifyPerDay + claudePerDay) * 30 };
}
