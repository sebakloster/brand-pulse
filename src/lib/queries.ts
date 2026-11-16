// Read-only queries for pages. Pages only read stored data; nothing here calls an LLM.
import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";

export type Tab = "attention" | "reply" | "route" | "monitor" | "followed" | "all" | "done";
export const TABS: { id: Tab; label: string }[] = [
  { id: "attention", label: "Needs attention" },
  { id: "reply", label: "Reply" },
  { id: "route", label: "Route" },
  { id: "monitor", label: "Monitor" },
  { id: "followed", label: "Followed" },
  { id: "all", label: "All" },
  { id: "done", label: "Done" },
];

export type QueueItem = {
  id: string;
  brand: string;
  kind: "post" | "comment";
  subreddit: string;
  author: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  createdAt: string;
  score: number | null;
  numComments: number | null;
  pipelineStatus: string;
  userStatus: "open" | "discarded" | "replied" | "handled";
  discardReason: string | null;
  limitedContext: boolean;
  triageError: string | null;
  threadId: string | null; // mention id of the post, when we have it
  followed: boolean;
  importance: "P0" | "P1" | "P2" | "P3" | null;
  action: "reply" | "route" | "monitor" | "ignore" | null;
  routeTo: string | null;
  sentiment: number | null;
  topic: string | null;
  intent: string | null;
  riskFlags: string[] | null;
  reason: string | null;
};

// Latest triage per mention, whatever prompt version made it.
const LATEST_TRIAGE = sql`(
  select distinct on (mention_id) * from triage order by mention_id, created_at desc
)`;

function tabFilter(tab: Tab): SQL {
  switch (tab) {
    case "attention":
      return sql`m.user_status = 'open' and (m.pipeline_status = 'triage_failed'
        or (t.importance in ('P0','P1','P2') and t.action <> 'ignore'))`;
    case "reply": return sql`m.user_status = 'open' and t.action = 'reply'`;
    case "route": return sql`m.user_status = 'open' and t.action = 'route'`;
    case "monitor": return sql`m.user_status = 'open' and t.action = 'monitor'`;
    case "followed": return sql`coalesce(p.followed, m.followed)`;
    case "all": return sql`m.user_status = 'open'`;
    case "done": return sql`m.user_status <> 'open'`;
  }
}

const BASE = sql`
  from mentions m
  join brands b on b.id = m.brand_id
  left join ${LATEST_TRIAGE} t on t.mention_id = m.id
  left join mentions p on p.brand_id = m.brand_id and p.reddit_id = m.post_id and p.kind = 'post'
  where m.pipeline_status in ('triaged', 'triage_failed')`;

export const PAGE_SIZE = 30;

export async function getQueue(tab: Tab, page = 1): Promise<{ items: QueueItem[]; total: number }> {
  const where = tabFilter(tab);
  const rows = await db.execute(sql`
    select m.id, b.name as brand, m.kind, m.subreddit, m.author,
      coalesce(p.title, m.title) as title, m.body, m.url,
      m.created_at_reddit as "createdAt", m.score, coalesce(p.num_comments, m.num_comments) as "numComments",
      m.pipeline_status as "pipelineStatus", m.user_status as "userStatus", m.discard_reason as "discardReason",
      m.limited_context as "limitedContext", m.triage_error as "triageError",
      p.id as "threadId", coalesce(p.followed, m.followed) as followed,
      t.importance, t.action, t.route_to as "routeTo", t.sentiment, t.topic, t.intent,
      t.risk_flags as "riskFlags", t.reason
    ${BASE} and ${where}
    order by
      case when m.pipeline_status = 'triage_failed' then 1 else 2 end,
      t.importance nulls last, m.created_at_reddit desc
    limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`);
  const [count] = (await db.execute(sql`select count(*)::int as n ${BASE} and ${where}`)).rows as { n: number }[];
  return { items: rows.rows as QueueItem[], total: count.n };
}

export async function getTabCounts(): Promise<Record<Tab, number>> {
  const parts = TABS.map(({ id }) => sql`count(*) filter (where ${tabFilter(id)})::int as ${sql.identifier(id)}`);
  const [row] = (await db.execute(sql`select ${sql.join(parts, sql`, `)} ${BASE}`)).rows;
  return row as Record<Tab, number>;
}

export type ThreadNode = QueueItem & { parentId: string | null; redditId: string; depth: number; isBotLike: boolean };

/** A thread: the post (if we have it) and every stored comment, with triage where it exists. */
export async function getThread(mentionId: string) {
  const [focus] = (await db.execute(sql`select brand_id, post_id from mentions where id = ${mentionId}`)).rows as
    { brand_id: string; post_id: string }[];
  if (!focus) return null;
  const rows = (await db.execute(sql`
    select m.id, b.name as brand, m.kind, m.subreddit, m.author, m.title, m.body, m.url,
      m.created_at_reddit as "createdAt", m.score, m.num_comments as "numComments",
      m.pipeline_status as "pipelineStatus", m.user_status as "userStatus", m.discard_reason as "discardReason",
      m.limited_context as "limitedContext", m.triage_error as "triageError",
      null as "threadId", m.followed, m.parent_id as "parentId", m.reddit_id as "redditId", m.depth,
      m.is_bot_like as "isBotLike", m.upvote_ratio as "upvoteRatio",
      t.importance, t.action, t.route_to as "routeTo", t.sentiment, t.topic, t.intent,
      t.risk_flags as "riskFlags", t.reason
    from mentions m
    join brands b on b.id = m.brand_id
    left join ${LATEST_TRIAGE} t on t.mention_id = m.id
    where m.brand_id = ${focus.brand_id} and m.post_id = ${focus.post_id}
      and not m.is_deleted
    order by m.kind desc, m.created_at_reddit`)).rows as (ThreadNode & { upvoteRatio: number | null })[];
  const post = rows.find((r) => r.kind === "post") ?? null;
  const comments = rows.filter((r) => r.kind === "comment");
  return { post, comments, focusId: mentionId };
}
