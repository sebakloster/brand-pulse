ALTER TABLE "llm_calls" DROP CONSTRAINT "llm_calls_brand_id_brands_id_fk";
--> statement-breakpoint
ALTER TABLE "runs" DROP CONSTRAINT "runs_brand_id_brands_id_fk";
--> statement-breakpoint
ALTER TABLE "runs" ALTER COLUMN "brand_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;