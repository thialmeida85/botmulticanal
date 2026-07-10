CREATE TYPE "public"."deal_status" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "contact_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"contactId" integer NOT NULL,
	"tagId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"pipelineId" integer NOT NULL,
	"stageId" integer NOT NULL,
	"contactId" integer NOT NULL,
	"conversationId" integer,
	"title" varchar(255) NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" "deal_status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"pipelineId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"color" varchar(20) DEFAULT '#64748b' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_pipelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(80) NOT NULL,
	"color" varchar(20) DEFAULT '#2563eb' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_contact_tags_contact" ON "contact_tags" USING btree ("contactId");--> statement-breakpoint
CREATE INDEX "idx_contact_tags_tag" ON "contact_tags" USING btree ("tagId");--> statement-breakpoint
CREATE INDEX "idx_deals_pipeline" ON "deals" USING btree ("pipelineId");--> statement-breakpoint
CREATE INDEX "idx_deals_stage" ON "deals" USING btree ("stageId");--> statement-breakpoint
CREATE INDEX "idx_deals_contact" ON "deals" USING btree ("contactId");--> statement-breakpoint
CREATE INDEX "idx_pipeline_stages_pipeline" ON "pipeline_stages" USING btree ("pipelineId");--> statement-breakpoint
CREATE INDEX "idx_sales_pipelines_user" ON "sales_pipelines" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_tags_user_id" ON "tags" USING btree ("userId");