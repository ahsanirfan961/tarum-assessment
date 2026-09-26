ALTER TABLE "nodes" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "finalize_attempts" integer DEFAULT 0 NOT NULL;