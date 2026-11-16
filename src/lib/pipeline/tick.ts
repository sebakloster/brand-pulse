// The one background job. Each step picks up pending rows, so a
// tick that runs out of time leaves the rest for the next one, and re-running is safe.
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Deadline } from "@/lib/util";
import { applyRulesForBrand } from "./ingest";
import { acquireLease, releaseLease } from "./lock";
import { runRelevance } from "./relevance";
import { runTriage } from "./triage";
import { runDrafts } from "@/lib/drafts/generate";
import { collectRuns, dueBrands, startSearchRun } from "./runs";
import { runSpikes } from "./spike-step";
import { sendPendingAlerts } from "@/lib/email/digest";

export const TICK_BUDGET_MS = 240_000; // stays under Vercel's 300s function limit
const LEASE_MS = 300_000;

export async function runTick({ budgetMs = TICK_BUDGET_MS } = {}) {
  const holder = await acquireLease("tick", LEASE_MS);
  if (!holder) return { skipped: "another tick is running" };
  const deadline = Deadline.in(budgetMs);
  const report: Record<string, unknown> = {};
  try {
    // 1. Collect finished scraper runs (ingest + rules), then start the ones that are due.
    report.collected = await collectRuns();
    const started: string[] = [];
    for (const b of await dueBrands()) {
      try { await startSearchRun(b); started.push(b.name); } catch (e) { started.push(`${b.name}: ${e instanceof Error ? e.message : e}`); }
    }
    report.started = started;

    // 2. AI and spike steps per brand. Spikes run before drafts so spiking threads get no drafts.
    const active = await db.select().from(schema.brands).where(eq(schema.brands.enabled, true));
    for (const brand of active) {
      if (deadline.passed) break;
      const rules = await applyRulesForBrand(brand.id);
      const relevance = await runRelevance(brand.id, deadline);
      const triage = deadline.passed ? null : await runTriage(brand.id, deadline);
      const spikes = await runSpikes(brand.id);
      const drafts = deadline.passed ? null : await runDrafts(brand.id, deadline);
      report[brand.name] = { rules, relevance, triage, spikes, drafts };
    }
    // 3. Instant spike emails.
    report.alerts = await sendPendingAlerts();
    return report;
  } finally {
    await releaseLease("tick", holder);
  }
}
