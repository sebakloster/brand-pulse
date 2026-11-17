import { isCronRequest } from "@/lib/auth";
import { sendDigest } from "@/lib/email/digest";

export const maxDuration = 60;

// Called hourly by Vercel Cron; sends once per local day at the configured hour.
export async function GET(req: Request) {
  if (!isCronRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await sendDigest());
}
