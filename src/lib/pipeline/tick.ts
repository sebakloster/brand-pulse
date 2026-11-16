// The one background job. Each step picks up pending rows, so a
// tick that runs out of time leaves the rest for the next one, and re-running is safe.
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Deadline } from "@/lib/util";
import { applyRulesForBrand } from "./ingest";
import { acquireLease, releaseLease } from "./lock";
import { runRelevance } from "./relevance";
import { runTriage } from "./triage";

export const TICK_BUDGET_MS = 240_000; // stays under Vercel's 300s function limit
const LEASE_MS = 300_000;

export async function runTick({ budgetMs = TICK_BUDGET_MS } = {}) {
  const holder = await acquireLease("tick", LEASE_MS);
  if (!holder) return { skipped: "another tick is running" };
  const deadline = Deadline.in(budgetMs);
  const report: Record<string, unknown> = {};
  try {
    const active = await db.select().from(schema.brands).where(eq(schema.brands.enabled, true));
    for (const brand of active) {
      if (deadline.passed) break;
            const rules = await applyRulesForBrand(brand.id);
      const relevance = await runRelevance(brand.id, deadline);
      const triage = deadline.passed ? null : await runTriage(brand.id, deadline);
      report[brand.name] = { rules, relevance, triage };
    }
    return report;
  } finally {
    await releaseLease("tick", holder);
  }
}
