ALTER TABLE "mentions" ADD COLUMN "ai_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "triage_error" text;