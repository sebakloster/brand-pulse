// One-off: clean stored triage text with the same function new rows go through.
import "./env.mts";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanText } from "@/lib/llm/clean";
const rows = await db.select().from(schema.triage);
let fixed = 0;
for (const r of rows) {
  const reason = cleanText(r.reason, 300), topic = cleanText(r.topic, 80);
  if (reason.repaired || topic.repaired) {
    await db.update(schema.triage).set({ reason: reason.text, topic: topic.text }).where(eq(schema.triage.id, r.id));
    fixed++;
  }
}
console.log(`Repaired ${fixed} of ${rows.length} triage rows.`);
const left = await db.execute(sql`select count(*)::int n from triage where reason ~ '[{}<>\\[\\]]'`);
console.log("Rows still containing brackets/markup:", left.rows[0].n);
process.exit(0);
