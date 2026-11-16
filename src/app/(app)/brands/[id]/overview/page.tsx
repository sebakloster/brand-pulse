import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { SpikeBadge } from "@/components/badges";
import { SENTIMENT } from "@/lib/labels";

export const metadata = { title: "Overview · Brand Pulse" };

const LATEST = sql`(select distinct on (mention_id) * from triage order by mention_id, created_at desc)`;

function Bar({ label, value, max, className = "bg-gradient-accent", suffix = "" }: { label: string; value: number; max: number; className?: string; suffix?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-3 text-sm">
      <span className="truncate text-muted" title={label}>{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${max ? Math.max(2, (100 * value) / max) : 0}%` }} />
      </div>
      <span className="text-right tabular-nums">{value}{suffix}</span>
    </div>
  );
}

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="space-y-3 rounded-3xl border border-border bg-surface p-4 sm:p-6">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, id));
  if (!brand) notFound();

  const q = async <T,>(query: ReturnType<typeof sql>) => (await db.execute(query)).rows as T[];
  const [[funnel], sentiment, daily, intents, subs, threads] = await Promise.all([
    q<Record<string, number>>(sql`
      select count(*)::int as fetched,
        count(*) filter (where pipeline_status = 'filtered')::int as filtered,
        count(*) filter (where pipeline_status = 'context')::int as context,
        count(*) filter (where pipeline_status in ('irrelevant','relevant','triaged','triage_failed') or (pipeline_status = 'filtered' and filtered_reason = 'non_english'))::int as checked,
        count(*) filter (where pipeline_status = 'irrelevant')::int as irrelevant,
        count(*) filter (where pipeline_status = 'triaged')::int as triaged
      from mentions where brand_id = ${id}`),
    q<{ sentiment: number; n: number }>(sql`
      select t.sentiment, count(*)::int as n from mentions m join ${LATEST} t on t.mention_id = m.id
      where m.brand_id = ${id} and m.pipeline_status = 'triaged' group by 1 order by 1`),
    q<{ day: string; n: number; neg: number }>(sql`
      select to_char(date_trunc('day', m.created_at_reddit), 'Mon DD') as day, count(*)::int as n,
        count(*) filter (where t.sentiment < 0)::int as neg
      from mentions m join ${LATEST} t on t.mention_id = m.id
      where m.brand_id = ${id} and m.pipeline_status = 'triaged' group by date_trunc('day', m.created_at_reddit) order by date_trunc('day', m.created_at_reddit) desc limit 14`),
    q<{ intent: string; n: number }>(sql`
      select t.intent, count(*)::int as n from mentions m join ${LATEST} t on t.mention_id = m.id
      where m.brand_id = ${id} and m.pipeline_status = 'triaged' group by 1 order by 2 desc`),
    q<{ subreddit: string; n: number; neg: number }>(sql`
      select m.subreddit, count(*)::int as n, count(*) filter (where t.sentiment < 0)::int as neg
      from mentions m join ${LATEST} t on t.mention_id = m.id
      where m.brand_id = ${id} and m.pipeline_status = 'triaged' group by 1 order by 2 desc limit 8`),
    q<{ id: string; title: string; subreddit: string; comments: number; mentions: number; avg: number; spike: boolean; neg: boolean; sim: boolean }>(sql`
      select p.id, p.title, p.subreddit, p.num_comments as comments, count(t.id)::int as mentions,
        round(avg(t.sentiment)::numeric, 1)::float as avg, p.spike_active as spike, p.spike_negative as neg, p.spike_simulated as sim
      from mentions p
      join mentions m on m.brand_id = p.brand_id and m.post_id = p.reddit_id
      join ${LATEST} t on t.mention_id = m.id
      where p.brand_id = ${id} and p.kind = 'post' and m.pipeline_status = 'triaged'
      group by p.id order by p.spike_active desc, count(t.id) desc, p.num_comments desc limit 8`),
  ]);

  const totalSent = sentiment.reduce((n, s) => n + s.n, 0);
  const neg = sentiment.filter((s) => s.sentiment < 0).reduce((n, s) => n + s.n, 0);
  const pos = sentiment.filter((s) => s.sentiment > 0).reduce((n, s) => n + s.n, 0);
  const maxDaily = Math.max(1, ...daily.map((d) => d.n));
  const steps = [
    { label: "Fetched from Reddit", value: funnel.fetched },
    { label: "Filtered by rules (free)", value: funnel.filtered },
    { label: "Thread context only", value: funnel.context },
    { label: "Checked by AI", value: funnel.checked },
    { label: "Not about the brand", value: funnel.irrelevant },
    { label: "Triaged", value: funnel.triaged },
  ];

  return (
    <div className="space-y-6">
      <Link href={`/brands/${id}`} className="text-sm text-muted hover:text-foreground">← {brand.name}</Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{brand.name} <span className="text-gradient">overview</span></h1>
        <p className="text-sm text-muted">
          {totalSent} triaged mentions · {totalSent ? Math.round((100 * neg) / totalSent) : 0}% negative · {totalSent ? Math.round((100 * pos) / totalSent) : 0}% positive
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="From Reddit to the queue" note="Rules run first and cost nothing; only what's left reaches the AI.">
          {steps.map((s) => <Bar key={s.label} label={s.label} value={s.value} max={funnel.fetched} />)}
        </Card>

        <Card title="How people feel" note="Sentiment toward the brand, all triaged mentions.">
          {[2, 1, 0, -1, -2].map((v) => (
            <Bar key={v} label={SENTIMENT[String(v)].label} value={sentiment.find((s) => s.sentiment === v)?.n ?? 0} max={totalSent} className={SENTIMENT[String(v)].className} />
          ))}
        </Card>

        <Card title="Mentions per day" note="Bar = triaged mentions posted that day; red part = negative.">
          {daily.length === 0 ? <p className="text-sm text-muted">No data yet.</p> : daily.map((d) => (
            <div key={d.day} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 text-sm">
              <span className="text-muted">{d.day}</span>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" style={{ width: `${Math.max(4, (100 * d.n) / maxDaily)}%` }}>
                <div className="h-full bg-p0" style={{ width: `${(100 * d.neg) / d.n}%` }} />
                <div className="bg-gradient-accent h-full flex-1" />
              </div>
              <span className="text-right tabular-nums">{d.n}</span>
            </div>
          ))}
        </Card>

        <Card title="What people are doing" note="Intent of each mention.">
          {intents.map((i) => <Bar key={i.intent} label={i.intent.replace("_", " ")} value={i.n} max={totalSent} />)}
        </Card>

        <Card title="Where" note="Top communities; red share = negative.">
          {subs.map((s) => (
            <Bar key={s.subreddit} label={`r/${s.subreddit}`} value={s.n} max={subs[0]?.n ?? 1}
              className={s.neg / s.n >= 0.5 ? "bg-p0" : "bg-gradient-accent"} suffix="" />
          ))}
        </Card>

        <Card title="Top threads" note="Spiking first, then by number of mentions.">
          <ul className="space-y-2 text-sm">
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`/m/${t.id}`} className="block rounded-2xl p-2 hover:bg-surface-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <SpikeBadge active={t.spike} negative={t.neg} simulated={t.sim} />
                    <span className="font-medium">{t.title}</span>
                  </span>
                  <span className="text-xs text-muted">
                    r/{t.subreddit} · {t.comments ?? 0} comments · {t.mentions} mention{t.mentions === 1 ? "" : "s"} · avg sentiment {t.avg > 0 ? "+" : ""}{t.avg}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
