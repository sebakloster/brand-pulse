import Link from "next/link";
import { sql } from "drizzle-orm";
import { Card } from "@heroui/react";
import { db } from "@/db";

export const metadata = { title: "Insights · Brand Pulse" };

const LATEST = sql`(select distinct on (mention_id) * from triage order by mention_id, created_at desc)`;

export default async function Insights({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const q = async <T,>(query: ReturnType<typeof sql>) => (await db.execute(query)).rows as T[];
  const base = sql`from mentions m join ${LATEST} t on t.mention_id = m.id where m.brand_id = ${brandId} and m.pipeline_status = 'triaged'`;

  const [[totals], subs, threads] = await Promise.all([
    q<{ n: number; neg: number; pos: number; days: number }>(sql`
      select count(*)::int n, count(*) filter (where t.sentiment < 0)::int neg, count(*) filter (where t.sentiment > 0)::int pos,
        greatest(1, ceil(extract(epoch from (max(m.created_at_reddit) - min(m.created_at_reddit))) / 86400))::int days ${base}`),
    q<{ subreddit: string; n: number }>(sql`select m.subreddit, count(*)::int n ${base} group by 1 order by 2 desc limit 5`),
    q<{ id: string; title: string; subreddit: string; n: number; spike: boolean }>(sql`
      select p.id, p.title, p.subreddit, count(*)::int n, p.spike_active spike
      from mentions m join ${LATEST} t on t.mention_id = m.id
      join mentions p on p.brand_id = m.brand_id and p.reddit_id = m.post_id and p.kind = 'post'
      where m.brand_id = ${brandId} and m.pipeline_status = 'triaged'
      group by p.id order by p.spike_active desc, count(*) desc limit 5`),
  ]);

  if (!totals || totals.n === 0) {
    return <p className="animate-rise py-16 text-center text-muted">No mentions analyzed yet.</p>;
  }
  const pct = (x: number) => Math.round((100 * x) / totals.n);
  const neutral = totals.n - totals.neg - totals.pos;
  const maxSub = subs[0]?.n ?? 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Mentions", value: String(totals.n), sub: `last ${totals.days} day${totals.days === 1 ? "" : "s"}` },
          { label: "Positive", value: `${pct(totals.pos)}%`, sub: `${totals.pos} mentions` },
          { label: "Negative", value: `${pct(totals.neg)}%`, sub: `${totals.neg} mentions` },
        ].map((s, i) => (
          <Card key={s.label} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
            <Card.Content>
              <p className="text-xs text-muted">{s.label}</p>
              <p className="text-2xl font-semibold tracking-tight">{s.value}</p>
              <p className="text-xs text-muted">{s.sub}</p>
            </Card.Content>
          </Card>
        ))}
      </div>

      <Card className="animate-rise" style={{ animationDelay: "150ms" }}>
        <Card.Header><Card.Title>How people feel</Card.Title></Card.Header>
        <Card.Content className="space-y-3">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-secondary">
            <div className="bg-success transition-all duration-700" style={{ width: `${pct(totals.pos)}%` }} />
            <div className="bg-muted/50" style={{ width: `${pct(neutral)}%` }} />
            <div className="bg-danger" style={{ width: `${pct(totals.neg)}%` }} />
          </div>
          <div className="flex gap-4 text-xs text-muted">
            <span><span className="mr-1.5 inline-block size-2 rounded-full bg-success" />Positive</span>
            <span><span className="mr-1.5 inline-block size-2 rounded-full bg-muted/50" />Neutral</span>
            <span><span className="mr-1.5 inline-block size-2 rounded-full bg-danger" />Negative</span>
          </div>
        </Card.Content>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="animate-rise" style={{ animationDelay: "200ms" }}>
          <Card.Header><Card.Title>Where people talk</Card.Title></Card.Header>
          <Card.Content className="space-y-3">
            {subs.map((s) => (
              <div key={s.subreddit} className="space-y-1 text-sm">
                <div className="flex justify-between"><span>r/{s.subreddit}</span><span className="text-muted">{s.n}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(100 * s.n) / maxSub}%` }} />
                </div>
              </div>
            ))}
          </Card.Content>
        </Card>

        <Card className="animate-rise" style={{ animationDelay: "250ms" }}>
          <Card.Header><Card.Title>Busiest conversations</Card.Title></Card.Header>
          <Card.Content>
            <ul className="space-y-1">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link href={`/b/${brandId}/m/${t.id}`} className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-secondary">
                    <p className="truncate text-sm">{t.spike && <span className="mr-1.5 inline-block size-2 rounded-full bg-danger" />}{t.title}</p>
                    <p className="text-xs text-muted">r/{t.subreddit} · {t.n} mention{t.n === 1 ? "" : "s"}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
