// Seeds the demo brand and the settings row. Safe to run repeatedly.
// Usage: npm run db:seed
import "./env.mts";
import { db, schema } from "@/db";
import { PELOTON } from "@/lib/brands/peloton";

export async function seed() {
  const [brand] = await db.insert(schema.brands).values(PELOTON)
    .onConflictDoUpdate({
      target: schema.brands.name,
      set: {
        description: PELOTON.description,
        searchTerms: PELOTON.searchTerms,
        exclusionTerms: PELOTON.exclusionTerms,
        blockedSubreddits: PELOTON.blockedSubreddits,
        brandSubreddits: PELOTON.brandSubreddits,
        supportUrl: PELOTON.supportUrl,
      },
    })
    .returning();
  await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing();
  return brand;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const brand = await seed();
  console.log(`Seeded brand ${brand.name} (${brand.id})`);
}
