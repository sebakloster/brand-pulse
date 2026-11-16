// What the floating tracker shows: each brand's latest manual check, and where it is.
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type Activity = {
  runId: string;
  brandId: string;
  brand: string;
  domain: string | null;
  phase: "searching" | "analyzing" | "done" | "failed";
  pending: number; // mentions still being analyzed
  newCount: number; // new items that need a look
  found: number; // new mentions about the brand
  error: string | null;
  startedAt: string;
};

export async function getActivity(): Promise<Activity[]> {
  const rows = (await db.execute(sql`
    with latest as (
      select distinct on (r.brand_id) r.*
      from runs r
      where r.manual and r.purpose = 'search' and r.started_at > now() - interval '3 hours'
      order by r.brand_id, r.started_at desc
    )
    select l.id as "runId", b.id as "brandId", b.name as brand, b.domain, l.status, l.error,
      l.ingested_at as "ingestedAt", l.started_at as "startedAt",
      (select count(*)::int from mentions m where m.brand_id = b.id
        and m.pipeline_status in ('new', 'candidate', 'relevant')) as pending,
      (select count(*)::int from mentions m
        left join (select distinct on (mention_id) * from triage order by mention_id, created_at desc) t on t.mention_id = m.id
        where m.brand_id = b.id and m.first_seen_at >= l.started_at and m.user_status = 'open'
          and (m.pipeline_status = 'triage_failed' or (t.importance in ('P0','P1','P2') and t.action <> 'ignore'))) as "newCount",
      (select count(*)::int from mentions m where m.brand_id = b.id and m.first_seen_at >= l.started_at
        and m.pipeline_status in ('triaged', 'triage_failed')) as found
    from latest l join brands b on b.id = l.brand_id
    order by l.started_at desc`)).rows as (Omit<Activity, "phase"> & { status: string; ingestedAt: string | null })[];

  return rows.map(({ status, ingestedAt, ...r }) => ({
    ...r,
    phase: status === "failed" || status === "timed_out" ? "failed"
      : status !== "succeeded" || !ingestedAt ? "searching"
      : r.pending > 0 ? "analyzing"
      : "done",
  }));
}
