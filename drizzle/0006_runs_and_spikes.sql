ALTER TABLE "mentions" ADD COLUMN "spike_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "spike_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "spike_rate" real;--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "spike_reason" text;--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "spike_negative" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "spike_simulated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "last_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "cost_detail" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "warning" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "manual" boolean DEFAULT false NOT NULL;