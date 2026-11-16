import Link from "next/link";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { RunNowButton, Toggle } from "@/components/brand-controls";
import { brandCosts } from "@/lib/costs";
import { timeAgo } from "@/lib/labels";
import { getRedditSource } from "@/lib/reddit/source";

export const metadata = { title: "Brands · Brand Pulse" };

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;

export default async function BrandsPage() {
  const list = await db.select().from(schema.brands).orderBy(schema.brands.name);
  const costs = await brandCosts();
  const stats = (await db.execute(sql`
    select m.brand_id,
      count(*) filter (where m.user_status = 'open' and ((t.importance in ('P0','P1','P2') and t.action <> 'ignore') or (m.kind = 'post' and m.spike_active)))::int as attention,
      count(*) filter (where m.kind = 'post' and m.spike_active)::int as spikes,
      (select max(started_at) from runs r where r.brand_id = m.brand_id) as last_run
    from mentions m left join (select distinct on (mention_id) * from triage order by mention_id, created_at desc) t on t.mention_id = m.id
    group by m.brand_id`)).rows as { brand_id: string; attention: number; spikes: number; last_run: string | null }[];
  const byBrand = new Map(stats.map((s) => [s.brand_id, s]));
  const source = getRedditSource().kind;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tracked <span className="text-gradient">brands</span></h1>
          <p className="text-sm text-muted">
            Data source: {source === "apify" ? "live (Apify)" : "demo replay of a saved Peloton dataset"}. Costs are real and this month only.
          </p>
        </div>
        <Link href="/brands/new" className="rounded-full bg-surface-2 px-4 py-2 text-sm hover:bg-border">+ Add brand</Link>
      </div>

      {list.map((b) => {
        const c = costs.get(b.id);
        const s = byBrand.get(b.id);
        return (
          <article key={b.id} className="space-y-4 rounded-3xl border border-border bg-surface p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/brands/${b.id}`} className="text-xl font-semibold hover:underline">{b.name}</Link>
                <p className="text-sm text-muted">
                  {b.domain} · last run {s?.last_run ? timeAgo(s.last_run) : "never"} · polls every {b.pollEveryHours}h when live
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/brands/${b.id}/overview`} className="rounded-full bg-surface-2 px-4 py-1.5 text-sm hover:bg-border">Overview</Link>
                <Link href={`/brands/${b.id}`} className="rounded-full bg-surface-2 px-4 py-1.5 text-sm hover:bg-border">Settings & runs</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Needs attention" value={String(s?.attention ?? 0)} href="/queue" />
              <Stat label="Spiking threads" value={String(s?.spikes ?? 0)} tone={s?.spikes ? "text-p1" : undefined} />
              <Stat label="Spent this month" value={usd(c?.totalUsd ?? 0)} sub={`Scraper ${usd(c?.apifyUsd ?? 0)} · AI ${usd(c?.claudeUsd ?? 0)}`} />
              <Stat label="Projected month" value={usd(c?.projectedMonthUsd ?? 0)} sub="at this month's pace" />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Toggle brandId={b.id} flag="enabled" initial={b.enabled} label="Tracking on" />
              <Toggle brandId={b.id} flag="livePollingEnabled" initial={b.livePollingEnabled} label={`Scheduled live polling (every ${b.pollEveryHours}h)`} />
              <span className="flex-1" />
              <RunNowButton brandId={b.id} source={source} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Stat({ label, value, sub, href, tone }: { label: string; value: string; sub?: string; href?: string; tone?: string }) {
  const body = (
    <div className="rounded-2xl bg-background/60 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-xl font-semibold ${tone ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
