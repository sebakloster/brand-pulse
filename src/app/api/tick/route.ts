import { runTick } from "@/lib/pipeline/tick";

export const maxDuration = 300;

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
// The "Run now" button and local scripts use the same endpoint.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const report = await runTick();
  return Response.json(report);
}
