DROP INDEX "snapshots_post_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_post_time_idx" ON "snapshots" USING btree ("post_id","taken_at");