// Read-only queries for pages. Pages only read stored data; nothing here calls an LLM.
import "server-only";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Action, Importance } from "@/lib/labels";

export type View = "todo" | "done";

export type InboxItem = {
  id: string;
  brandId: string;
  kind: "post" | "comment";
  subreddit: string;
  author: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  createdAt: string;
  pipelineStatus: string;
  userStatus: "open" | "discarded" | "replied" | "handled";
  limitedContext: boolean;
  triageError: string | null;
  importance: Importance | null;
  action: Action | null;
  routeTo: string | null;
  sentiment: number | null;
  riskFlags: string[] | null;
  reason: string | null;
  threadSpiking: boolean | null;
};

// Latest triage per mention, whatever prompt version made it.
const LATEST_TRIAGE = sql`(select distinct on (mention_id) * from triage order by mention_id, created_at desc)`;

// "To do": things a person should look at. FYI-level items and "no action" items stay out.
const TODO = sql`m.user_status = 'open' and (m.pipeline_status = 'triage_failed'
  or (t.importance in ('P0','P1','P2') and t.action <> 'ignore'))`;
const DONE = sql`m.user_status <> 'open'`;

const FROM = (brandId: string) => sql`
  from mentions m
  left join ${LATEST_TRIAGE} t on t.mention_id = m.id
  left join mentions p on p.brand_id = m.brand_id and p.reddit_id = m.post_id and p.kind = 'post'
  where m.brand_id = ${brandId} and m.pipeline_status in ('triaged', 'triage_failed')`;

const COLUMNS = sql`
  m.id, m.brand_id as "brandId", m.kind, m.subreddit, m.author,
  coalesce(p.title, m.title) as title, m.body, m.url, m.created_at_reddit as "createdAt",
  m.pipeline_status as "pipelineStatus", m.user_status as "userStatus",
  m.limited_context as "limitedContext", m.triage_error as "triageError",
  t.importance, t.action, t.route_to as "routeTo", t.sentiment, t.risk_flags as "riskFlags", t.reason,
  p.spike_active as "threadSpiking"`;

export async function listBrands() {
  const brands = await db.select().from(schema.brands).where(isNull(schema.brands.deletedAt)).orderBy(schema.brands.name);
  const counts = (await db.execute(sql`
    select m.brand_id,
      count(*) filter (where ${TODO})::int as todo,
      count(*) filter (where m.kind = 'post' and m.spike_active and m.user_status = 'open')::int as spikes
    from mentions m left join ${LATEST_TRIAGE} t on t.mention_id = m.id
    where m.pipeline_status in ('triaged', 'triage_failed')
    group by m.brand_id`)).rows as { brand_id: string; todo: number; spikes: number }[];
  const byBrand = new Map(counts.map((c) => [c.brand_id, c]));
  return brands.map((b) => ({ ...b, todo: byBrand.get(b.id)?.todo ?? 0, spikes: byBrand.get(b.id)?.spikes ?? 0 }));
}

export async function getBrand(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [b] = await db.select().from(schema.brands).where(and(eq(schema.brands.id, id), isNull(schema.brands.deletedAt)));
  return b ?? null;
}

export async function getInbox(brandId: string, view: View) {
  const where: SQL = view === "todo" ? TODO : DONE;
  const order = view === "todo"
    ? sql`case when m.pipeline_status = 'triage_failed' then 1 else 0 end, t.importance nulls last, m.created_at_reddit desc`
    : sql`m.last_seen_at desc`;
  const items = (await db.execute(sql`select ${COLUMNS} ${FROM(brandId)} and ${where} order by ${order} limit 100`)).rows as InboxItem[];
  const [c] = (await db.execute(sql`
    select count(*) filter (where ${TODO})::int as todo, count(*) filter (where ${DONE})::int as done ${FROM(brandId)}`)).rows as { todo: number; done: number }[];
  return { items, counts: c };
}

export type Spike = { id: string; title: string; subreddit: string; reason: string | null; negative: boolean; simulated: boolean };

/** Threads that are blowing up right now (shown above the inbox). */
export async function getSpikes(brandId: string) {
  return (await db.execute(sql`
    select id, title, subreddit, spike_reason as reason, spike_negative as negative, spike_simulated as simulated
    from mentions where brand_id = ${brandId} and kind = 'post' and spike_active and user_status = 'open'
    order by spike_negative desc, spike_rate desc nulls last`)).rows as Spike[];
}

export type ThreadNode = InboxItem & { parentId: string | null; redditId: string; score: number | null; numComments: number | null };

/** The item, its post, and every stored comment in the thread. */
export async function getThread(mentionId: string) {
  if (!/^[0-9a-f-]{36}$/.test(mentionId)) return null;
  const [focus] = (await db.execute(sql`select brand_id, post_id from mentions where id = ${mentionId}`)).rows as
    { brand_id: string; post_id: string }[];
  if (!focus) return null;
  const rows = (await db.execute(sql`
    select m.id, m.brand_id as "brandId", m.kind, m.subreddit, m.author, m.title, m.body, m.url,
      m.created_at_reddit as "createdAt", m.pipeline_status as "pipelineStatus", m.user_status as "userStatus",
      m.limited_context as "limitedContext", m.triage_error as "triageError",
      m.parent_id as "parentId", m.reddit_id as "redditId", m.score, m.num_comments as "numComments",
      t.importance, t.action, t.route_to as "routeTo", t.sentiment, t.risk_flags as "riskFlags", t.reason,
      m.spike_active as "threadSpiking", m.spike_reason as "spikeReason", m.spike_simulated as "spikeSimulated"
    from mentions m left join ${LATEST_TRIAGE} t on t.mention_id = m.id
    where m.brand_id = ${focus.brand_id} and m.post_id = ${focus.post_id}
      and not m.is_deleted and not (m.kind = 'comment' and m.is_bot_like)
    order by m.kind desc, m.created_at_reddit`)).rows as (ThreadNode & { spikeReason: string | null; spikeSimulated: boolean })[];
  const item = rows.find((r) => r.id === mentionId) ?? null;
  const post = rows.find((r) => r.kind === "post") ?? null;
  const comments = rows.filter((r) => r.kind === "comment");
  return { item, post, comments, brandId: focus.brand_id };
}

/** When the brand was last checked on Reddit (live scrapes only), and whether a check is running. */
export async function getLastCheck(brandId: string) {
  const [r] = (await db.execute(sql`
    select started_at as at, status in ('starting', 'running') as running from runs
    where brand_id = ${brandId} and purpose = 'search' and source = 'apify'
    order by started_at desc limit 1`)).rows as { at: string; running: boolean }[];
  return r ?? null;
}
