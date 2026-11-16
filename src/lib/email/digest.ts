// Daily digest + instant spike alerts. Both record what happened, so a
// failed send shows up in Settings instead of disappearing.
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { digestSubject, renderDigest, renderSpikeAlert, type DigestBrand, type DigestItem } from "./render";
import { appUrl, localDay, sendEmail } from "./send";

const { alerts, brands, mentions, settings } = schema;

export async function getSettings() {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  return s;
}

export async function buildDigestData(): Promise<DigestBrand[]> {
  const active = await db.select().from(brands).where(eq(brands.enabled, true)).orderBy(brands.name);
  const out: DigestBrand[] = [];
  for (const b of active) {
    const items = (await db.execute(sql`
      select m.id, t.importance, t.action, t.route_to as "routeTo", m.subreddit, t.reason,
        (m.first_seen_at > now() - interval '24 hours') as "isNew"
      from mentions m
      join (select distinct on (mention_id) * from triage order by mention_id, created_at desc) t on t.mention_id = m.id
      where m.brand_id = ${b.id} and m.user_status = 'open' and t.importance in ('P0','P1','P2') and t.action <> 'ignore'
      order by t.importance, (t.action = 'reply') desc, m.created_at_reddit desc`)).rows as DigestItem[];
    const spikes = (await db.execute(sql`
      select id, title, subreddit, spike_reason as reason, spike_negative as negative, spike_simulated as simulated
      from mentions where brand_id = ${b.id} and kind = 'post' and spike_active and user_status = 'open'`)).rows as DigestBrand["spikes"];
    const [n] = (await db.execute(sql`
      select count(*)::int as n from mentions
      where brand_id = ${b.id} and first_seen_at > now() - interval '24 hours' and pipeline_status = 'triaged'`)).rows as { n: number }[];
    out.push({
      name: b.name,
      counts: {
        P0: items.filter((i) => i.importance === "P0").length,
        P1: items.filter((i) => i.importance === "P1").length,
        P2: items.filter((i) => i.importance === "P2").length,
        replies: items.filter((i) => i.action === "reply").length,
      },
      spikes,
      items,
      newToday: n.n,
    });
  }
  return out;
}

/**
 * Sends the digest once per local day at the configured hour (called hourly by cron).
 * `force` sends now (Settings → "Send test digest"), without marking the day as done.
 */
export async function sendDigest({ force = false } = {}) {
  const s = await getSettings();
  const { date, hour } = localDay(s.timezone);
  if (!force && (hour < s.digestHour || s.lastDigestDate === date)) {
    return { sent: false, reason: s.lastDigestDate === date ? "already sent today" : `before ${s.digestHour}:00 ${s.timezone}` };
  }
  const data = await buildDigestData();
  const { html, text } = renderDigest(data, date, appUrl());
  const res = await sendEmail({
    to: s.emailRecipients,
    subject: `${force ? "[Test] " : ""}${digestSubject(data, date)}`,
    html, text,
    idempotencyKey: force ? undefined : `digest/${date}`,
  });
  await db.update(settings).set(res.ok
    ? { ...(force ? {} : { lastDigestDate: date }), lastDigestAt: new Date(), lastDigestError: null }
    : { lastDigestError: res.error }).where(eq(settings.id, 1));
  return res.ok ? { sent: true, id: res.id } : { sent: false, reason: res.error };
}

/** Instant spike emails: one per alert row (alerts are already de-duplicated per thread per 24h). */
export async function sendPendingAlerts() {
  const s = await getSettings();
  const pending = await db.select({ alert: alerts, post: mentions, brand: brands.name })
    .from(alerts)
    .innerJoin(mentions, and(eq(mentions.brandId, alerts.brandId), eq(mentions.redditId, alerts.postId), eq(mentions.kind, "post")))
    .innerJoin(brands, eq(brands.id, alerts.brandId))
    .where(and(isNull(alerts.emailedAt), isNull(alerts.emailError), gte(alerts.sentAt, new Date(Date.now() - 86_400_000))));
  if (!s.spikeEmails) return { sent: 0, skipped: pending.length, reason: "spike emails off" };
  let sent = 0;
  for (const { alert, post, brand } of pending) {
    const msg = renderSpikeAlert({
      brand, id: post.id, title: post.title ?? "", subreddit: post.subreddit, reason: post.spikeReason ?? "Thread is spiking",
      negative: post.spikeNegative, simulated: post.spikeSimulated,
    }, appUrl());
    const res = await sendEmail({ to: s.emailRecipients, ...msg, idempotencyKey: `alert/${alert.id}` });
    await db.update(alerts).set(res.ok ? { emailedAt: new Date() } : { emailError: res.error }).where(eq(alerts.id, alert.id));
    if (res.ok) sent++;
  }
  return { sent, pending: pending.length };
}
