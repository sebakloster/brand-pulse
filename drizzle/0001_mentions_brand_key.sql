ALTER TYPE "public"."pipeline_status" ADD VALUE 'context' BEFORE 'candidate';--> statement-breakpoint
ALTER TABLE "drafts" DROP CONSTRAINT "drafts_mention_id_mentions_reddit_id_fk";
--> statement-breakpoint
ALTER TABLE "triage" DROP CONSTRAINT "triage_mention_id_mentions_reddit_id_fk";
--> statement-breakpoint
ALTER TABLE "drafts" ALTER COLUMN "mention_id" SET DATA TYPE uuid USING "mention_id"::uuid;--> statement-breakpoint
ALTER TABLE "mentions" DROP CONSTRAINT "mentions_pkey";--> statement-breakpoint
ALTER TABLE "triage" ALTER COLUMN "mention_id" SET DATA TYPE uuid USING "mention_id"::uuid;--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "upvote_ratio" real;--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "comments_per_hour" real;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_mention_id_mentions_id_fk" FOREIGN KEY ("mention_id") REFERENCES "public"."mentions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage" ADD CONSTRAINT "triage_mention_id_mentions_id_fk" FOREIGN KEY ("mention_id") REFERENCES "public"."mentions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mentions_brand_reddit_idx" ON "mentions" USING btree ("brand_id","reddit_id");--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_name_unique" UNIQUE("name");