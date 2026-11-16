// DEMO ONLY: simulates a spike on one thread by adding two labeled snapshots
// (+60 comments in an hour). Everything it touches is marked `simulated` and the
// UI says so. Usage: npm run demo:spike [-- "title text"] | -- --clear
import "./env.mts";
import { and, eq, ilike, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { runSpikes } from "@/lib/pipeline/spike-step";
const { mentions, snapshots } = schema;

if (process.argv.includes("--clear")) {
  await db.delete(snapshots).where(eq(snapshots.simulated, true));
  await db.update(mentions).set({ spikeSimulated: false }).where(eq(mentions.spikeSimulated, true));
  console.log("Removed simulated spike data.");
} else {
  const q = process.argv[2] ?? "wtf was this class";
  const [p] = await db.select().from(mentions).where(and(eq(mentions.kind, "post"), ilike(mentions.title, `%${q}%`)));
  if (!p) throw new Error(`no post matching "${q}"`);
  const [{ at }] = (await db.execute(sql`select max(taken_at) as at from snapshots`)).rows as { at: string }[];
  const t1 = new Date(new Date(at).getTime() + 60_000), t2 = new Date(t1.getTime() + 3_600_000);
  const n = p.numComments ?? 0;
  await db.insert(snapshots).values([
    { postId: p.redditId, takenAt: t1, numComments: n, score: p.score, simulated: true },
    { postId: p.redditId, takenAt: t2, numComments: n + 60, score: (p.score ?? 0) + 40, simulated: true },
  ]).onConflictDoNothing();
  await db.update(mentions).set({ spikeSimulated: true }).where(eq(mentions.id, p.id));
  console.log(`Simulated +60 comments/hour on "${p.title}".`);
  console.log(await runSpikes(p.brandId));
}
process.exit(0);
