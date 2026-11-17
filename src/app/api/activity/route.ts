import { after } from "next/server";
import { hasSession } from "@/lib/session";
import { getActivity } from "@/lib/activity";
import { collectRuns } from "@/lib/pipeline/runs";
import { runTick } from "@/lib/pipeline/tick";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Polled by the floating tracker. While a check is in flight, each poll also moves the
// pipeline along so results don't wait for the 15-minute cron:
// - a finished scrape is collected right here (a quick status call; ingest is idempotent),
// - the analysis runs in a short background tick (its lease lock makes overlaps harmless).
export async function GET() {
  if (!(await hasSession())) {
    return new Response("Unauthorized", { status: 401 });
  }
  let activity = await getActivity();
  if (activity.some((a) => a.phase === "searching")) {
    await collectRuns().catch(() => {});
    activity = await getActivity();
  }
  if (activity.some((a) => a.phase === "searching" || a.phase === "analyzing")) {
    after(() => runTick({ budgetMs: 60_000 }).catch(() => {}));
  }
  return Response.json(activity, { headers: { "Cache-Control": "no-store" } });
}
