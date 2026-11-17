ALTER TABLE "brands" DROP CONSTRAINT "brands_name_unique";--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_name_live_idx" ON "brands" USING btree ("name") WHERE "brands"."deleted_at" is null;--> statement-breakpoint
-- Pausing is gone: every brand that is not deleted is active again (automatic checks keep their own setting).
UPDATE "brands" SET "enabled" = true WHERE "deleted_at" is null;
