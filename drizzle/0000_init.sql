CREATE TYPE "public"."draft_status" AS ENUM('suggested', 'copied', 'replied');--> statement-breakpoint
CREATE TYPE "public"."importance" AS ENUM('P0', 'P1', 'P2', 'P3');--> statement-breakpoint
CREATE TYPE "public"."mention_kind" AS ENUM('post', 'comment');--> statement-breakpoint
CREATE TYPE "public"."pipeline_status" AS ENUM('new', 'filtered', 'candidate', 'irrelevant', 'relevant', 'triaged', 'triage_failed', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."run_source" AS ENUM('apify', 'fixture');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('starting', 'running', 'succeeded', 'failed', 'timed_out');--> statement-breakpoint
CREATE TYPE "public"."triage_action" AS ENUM('reply', 'route', 'monitor', 'ignore');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('open', 'discarded', 'replied', 'handled');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"post_id" text NOT NULL,
	"kind" text DEFAULT 'spike' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"description" text DEFAULT '' NOT NULL,
	"search_terms" text[] DEFAULT '{}' NOT NULL,
	"exclusion_terms" text[] DEFAULT '{}' NOT NULL,
	"blocked_subreddits" text[] DEFAULT '{}' NOT NULL,
	"voice_guide" text DEFAULT '' NOT NULL,
	"voice_version" integer DEFAULT 1 NOT NULL,
	"never_do" text[] DEFAULT '{}' NOT NULL,
	"support_url" text,
	"poll_every_hours" integer DEFAULT 6 NOT NULL,
	"live_polling_enabled" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"backfill_days" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mention_id" text NOT NULL,
	"ai_text" text,
	"user_input" text,
	"improved_text" text,
	"final_text" text,
	"checks" jsonb,
	"voice_version" integer NOT NULL,
	"status" "draft_status" DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"purpose" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locks" (
	"name" text PRIMARY KEY NOT NULL,
	"holder" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentions" (
	"reddit_id" text PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"kind" "mention_kind" NOT NULL,
	"post_id" text NOT NULL,
	"parent_id" text,
	"depth" integer DEFAULT 0 NOT NULL,
	"subreddit" text NOT NULL,
	"author" text,
	"title" text,
	"body" text,
	"url" text,
	"created_at_reddit" timestamp with time zone NOT NULL,
	"score" integer,
	"num_comments" integer,
	"is_direct_match" boolean DEFAULT false NOT NULL,
	"limited_context" boolean DEFAULT false NOT NULL,
	"pipeline_status" "pipeline_status" DEFAULT 'new' NOT NULL,
	"filtered_reason" text,
	"language" text,
	"user_status" "user_status" DEFAULT 'open' NOT NULL,
	"discard_reason" text,
	"followed" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_items" (
	"reddit_id" text PRIMARY KEY NOT NULL,
	"run_id" uuid,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"source" "run_source" NOT NULL,
	"purpose" text DEFAULT 'search' NOT NULL,
	"apify_run_id" text,
	"status" "run_status" DEFAULT 'starting' NOT NULL,
	"input" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ingested_at" timestamp with time zone,
	"items_count" integer,
	"cap_hit" boolean DEFAULT false NOT NULL,
	"cost_usd" real,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"email_recipients" text[] DEFAULT '{}' NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"digest_hour" integer DEFAULT 8 NOT NULL,
	"monthly_apify_budget_usd" real DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" text NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"score" integer,
	"num_comments" integer,
	"upvote_ratio" real,
	"simulated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "triage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mention_id" text NOT NULL,
	"sentiment" integer NOT NULL,
	"topic" text NOT NULL,
	"intent" text NOT NULL,
	"risk_flags" text[] DEFAULT '{}' NOT NULL,
	"importance" "importance" NOT NULL,
	"action" "triage_action" NOT NULL,
	"route_to" text,
	"reason" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_mention_id_mentions_reddit_id_fk" FOREIGN KEY ("mention_id") REFERENCES "public"."mentions"("reddit_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_items" ADD CONSTRAINT "raw_items_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triage" ADD CONSTRAINT "triage_mention_id_mentions_reddit_id_fk" FOREIGN KEY ("mention_id") REFERENCES "public"."mentions"("reddit_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mentions_brand_pipeline_idx" ON "mentions" USING btree ("brand_id","pipeline_status");--> statement-breakpoint
CREATE INDEX "mentions_post_idx" ON "mentions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "runs_brand_status_idx" ON "runs" USING btree ("brand_id","status");--> statement-breakpoint
CREATE INDEX "snapshots_post_idx" ON "snapshots" USING btree ("post_id","taken_at");--> statement-breakpoint
CREATE UNIQUE INDEX "triage_mention_version_idx" ON "triage" USING btree ("mention_id","prompt_version");