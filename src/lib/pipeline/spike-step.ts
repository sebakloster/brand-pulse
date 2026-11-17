// Tick step: apply spike rules to recent brand threads and raise alerts (one per thread per 24h).
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { SPIKE, assessSpike, median } from "./spikes";

const { alerts, mentions, snapshots } = schema;

export async function runSpikes(brandId: string) {
  // Time is measured against the newest data we have, not the wall clock, so a replayed
  // fixture behaves the same on the day of the demo as on the day it was collected.
  const [ref] = await db.select({ at: sql<Date | null>`max(${snapshots.takenAt})` }).from(snapshots)
    .innerJoin(mentions, and(eq(mentions.redditId, snapshots.postId), eq(mentions.brandId, brandId)));
  const now = ref?.at ? new Date(ref.at) : new Date();

  const posts = await db.select().from(mentions).where(and(
    eq(mentions.brandId, brandId), eq(mentions.kind, "post"), eq(mentions.isBotLike, false),
    inArray(mentions.pipelineStatus, ["relevant", "triaged"]),
    gte(mentions.createdAtReddit, new Date(now.getTime() - 7 * 86_400_000)),
  ));
  const baseline = median(posts.map((p) => p.commentsPerHour).filter((r): r is number => r != null));

  const recent = posts.filter((p) => p.spikeSimulated || now.getTime() - p.createdAtReddit.getTime() <= SPIKE.windowHours * 3_600_000);

  // Threads that aged out of the window are no longer assessed below, so clear their flag here:
  // otherwise a thread that spiked once would show as "blowing up" forever.
  await db.update(mentions).set({ spikeActive: false, spikeNegative: false, spikeSince: null }).where(and(
    eq(mentions.brandId, brandId), eq(mentions.kind, "post"), eq(mentions.spikeActive, true), eq(mentions.spikeSimulated, false),
    lt(mentions.createdAtReddit, new Date(now.getTime() - SPIKE.windowHours * 3_600_000)),
  ));
  const stats = { checked: recent.length, spiking: 0, newAlerts: 0, baseline: Number(baseline.toFixed(2)) };

  for (const p of recent) {
    const snaps = (await db.select().from(snapshots).where(eq(snapshots.postId, p.redditId))
      .orderBy(desc(snapshots.takenAt)).limit(2)).reverse();
    const r = assessSpike({ snapshots: snaps, firstSightRate: p.commentsPerHour, baselineRate: baseline });

    // Share of negative mentions in the thread decides whether it's a negative spike (P0).
    const [neg] = (await db.execute(sql`
      select count(*) filter (where t.sentiment < 0)::int as neg, count(*)::int as n
      from mentions m join (select distinct on (mention_id) * from triage order by mention_id, created_at desc) t
        on t.mention_id = m.id
      where m.brand_id = ${brandId} and m.post_id = ${p.redditId}`)).rows as { neg: number; n: number }[];
    const negative = neg.n > 0 && neg.neg / neg.n >= SPIKE.negativeShare;

    await db.update(mentions).set({
      spikeActive: r.spiking,
      spikeRate: r.rate,
      spikeReason: r.reason,
      spikeNegative: r.spiking && negative,
      spikeSince: r.spiking ? (p.spikeSince ?? new Date()) : null,
    }).where(eq(mentions.id, p.id));

    if (!r.spiking) continue;
    stats.spiking++;
    const [recentAlert] = await db.select({ id: alerts.id }).from(alerts)
      .where(and(eq(alerts.postId, p.redditId), eq(alerts.brandId, brandId), gte(alerts.sentAt, new Date(Date.now() - 86_400_000))));
    if (!recentAlert) {
      await db.insert(alerts).values({ brandId, postId: p.redditId, kind: negative ? "negative_spike" : "spike" });
      stats.newAlerts++;
    }
  }
  return stats;
}
