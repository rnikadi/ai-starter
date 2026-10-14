CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"metadata" text,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "documents_title_idx" ON "documents" USING btree ("title");