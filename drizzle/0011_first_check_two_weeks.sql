ALTER TABLE "brands" ALTER COLUMN "backfill_days" SET DEFAULT 14;--> statement-breakpoint
-- Brands that still use the old 2-day default get the new 2-week first check.
UPDATE "brands" SET "backfill_days" = 14 WHERE "backfill_days" = 2;
