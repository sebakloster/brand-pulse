ALTER TABLE "alerts" ADD COLUMN "emailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "email_error" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "last_digest_date" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "last_digest_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "last_digest_error" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "spike_emails" boolean DEFAULT true NOT NULL;