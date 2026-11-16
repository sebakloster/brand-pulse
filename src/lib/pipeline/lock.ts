// Lease lock for the tick. The Neon HTTP driver has no sessions, so a
// Postgres advisory lock would be released right away. A row with an expiry
// works on any driver, and a crashed tick's lease simply runs out.
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { locks } = schema;

export async function acquireLease(name: string, ttlMs: number): Promise<string | null> {
  const holder = randomUUID();
  const expiresAt = new Date(Date.now() + ttlMs);
  const rows = await db.insert(locks).values({ name, holder, expiresAt })
    .onConflictDoUpdate({
      target: locks.name,
      set: { holder, expiresAt },
      setWhere: sql`${locks.expiresAt} < now()`, // only take over an expired lease
    })
    .returning({ holder: locks.holder });
  return rows[0]?.holder === holder ? holder : null;
}

export async function releaseLease(name: string, holder: string) {
  await db.delete(locks).where(and(eq(locks.name, name), eq(locks.holder, holder)));
}
