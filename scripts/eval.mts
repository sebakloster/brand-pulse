// Evals: runs the production relevance + triage code on hand-labeled
// fixture items with fresh model calls and scores them. Needs the fixture ingested
// (npm run ingest:fixture). Usage: npm run eval   (~$0.15 per run)
import "./env.mts";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { RELEVANCE_VERSION, TRIAGE_VERSION } from "@/lib/llm/prompts";
import { checkRelevance } from "@/lib/pipeline/relevance";
import { triageThread, type TriageItem } from "@/lib/pipeline/triage";
import { chunks, pMap } from "@/lib/util";

type Label = {
  id: string; set: "random" | "curated"; about_brand: boolean; note: string;
  importance?: string[]; action?: string[]; never_reply?: boolean; expect_reply?: boolean;
};
const labels: Label[] = JSON.parse(readFileSync("evals/labels.json", "utf8")).items;
const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.name, "Peloton"));
const rows = await db.select().from(schema.mentions)
  .where(and(eq(schema.mentions.brandId, brand.id), inArray(schema.mentions.redditId, labels.map((l) => l.id))));
const byReddit = new Map(rows.map((r) => [r.redditId, r]));
const missing = labels.filter((l) => !byReddit.has(l.id)).map((l) => l.id);
if (missing.length) throw new Error(`Not in DB (run npm run ingest:fixture): ${missing.join(", ")}`);
const t0 = Date.now();
const costBefore = Number((await db.execute(sql`select coalesce(sum(cost_usd),0)::float s from llm_calls where purpose='eval'`)).rows[0].s);

// 1. Relevance on every labeled item.
const rel = new Map<string, { about: string; reason: string }>();
await pMap(chunks(rows, 15), 4, async (batch) => {
  const out = await checkRelevance(brand, batch, { purpose: "eval", logBrandId: null });
  for (const m of batch) { const v = out.get(m.id); if (v) rel.set(m.redditId, { about: v.about_brand, reason: v.reason }); }
});

// 2. Triage on items labeled about the brand, grouped by thread like production.
const toTriage = rows.filter((r) => labels.find((l) => l.id === r.redditId)!.about_brand);
const groups = new Map<string, typeof rows>();
for (const m of toTriage) groups.set(m.postId, [...(groups.get(m.postId) ?? []), m]);
const tri = new Map<string, TriageItem>();
await pMap([...groups.entries()], 4, async ([postId, items]) => {
  const out = await triageThread(brand, postId, items, { purpose: "eval", logBrandId: null });
  for (const m of items) { const v = out.get(m.id); if (v) tri.set(m.redditId, v); }
});

// 3. Score.
type Row = { id: string; set: string; field: string; expected: string; got: string; note: string; why: string };
const misses: Row[] = [];
const score = (set?: string) => {
  const ls = labels.filter((l) => !set || l.set === set);
  const s = { n: ls.length, relevance: 0, triaged: 0, importance: 0, action: 0, neverReply: 0, neverReplyViolations: 0, expectReply: 0, replyFound: 0, missing: 0 };
  for (const l of ls) {
    const r = rel.get(l.id);
    if (!r) { s.missing++; continue; }
    const saidYes = r.about !== "no"; // "unsure" counts as relevant
    if (saidYes === l.about_brand) s.relevance++;
    else if (!set) misses.push({ id: l.id, set: l.set, field: "relevance", expected: String(l.about_brand), got: r.about, note: l.note, why: r.reason });
    if (!l.about_brand) continue;
    const t = tri.get(l.id);
    if (!t) { s.missing++; continue; }
    s.triaged++;
    if (l.importance!.includes(t.importance)) s.importance++;
    else if (!set) misses.push({ id: l.id, set: l.set, field: "importance", expected: l.importance!.join("/"), got: t.importance, note: l.note, why: t.reason });
    if (l.action!.includes(t.action)) s.action++;
    else if (!set) misses.push({ id: l.id, set: l.set, field: "action", expected: l.action!.join("/"), got: `${t.action}${t.route_to ? `→${t.route_to}` : ""}`, note: l.note, why: t.reason });
    if (l.never_reply) { s.neverReply++; if (t.action === "reply") { s.neverReplyViolations++; if (!set) misses.push({ id: l.id, set: l.set, field: "NEVER-REPLY VIOLATION", expected: "no reply", got: "reply", note: l.note, why: t.reason }); } }
    if (l.expect_reply) { s.expectReply++; if (t.action === "reply") s.replyFound++; }
  }
  return s;
};
const all = score();
const result = {
  at: new Date().toISOString(), relevanceVersion: RELEVANCE_VERSION, triageVersion: TRIAGE_VERSION,
  all, random: score("random"), curated: score("curated"),
  costUsd: Number((await db.execute(sql`select coalesce(sum(cost_usd),0)::float s from llm_calls where purpose='eval'`)).rows[0].s) - costBefore,
  seconds: Math.round((Date.now() - t0) / 1000), misses,
  // Every prediction, so a reviewer can audit the labels as well as the model.
  predictions: labels.map((l) => ({ id: l.id, set: l.set, relevance: rel.get(l.id)?.about ?? null,
    importance: tri.get(l.id)?.importance ?? null, action: tri.get(l.id)?.action ?? null, routeTo: tri.get(l.id)?.route_to ?? null })),
};
mkdirSync("evals/results", { recursive: true });
const file = `evals/results/${result.at.slice(0, 19).replace(/[:T]/g, "-")}.json`;
writeFileSync(file, JSON.stringify(result, null, 1));

const pct = (a: number, b: number) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : "—");
console.log(`\nEval ${RELEVANCE_VERSION} + ${TRIAGE_VERSION} · ${result.seconds}s · $${result.costUsd.toFixed(3)} · saved ${file}\n`);
console.table(Object.fromEntries((["random", "curated", "all"] as const).map((k) => {
  const s = result[k];
  return [k, {
    items: s.n, relevance: pct(s.relevance, s.n - s.missing), importance: pct(s.importance, s.triaged), action: pct(s.action, s.triaged),
    "never-reply violations": `${s.neverReplyViolations} of ${s.neverReply}`, "reply recall": pct(s.replyFound, s.expectReply),
  }];
})));
for (const m of misses) console.log(`✗ [${m.set}] ${m.field}: expected ${m.expected}, got ${m.got}\n    label: ${m.note}\n    model: ${m.why}`);
process.exit(0);
