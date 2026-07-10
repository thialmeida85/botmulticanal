CREATE TABLE "bot_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"resourceType" varchar(40) NOT NULL,
	"mimeType" varchar(120),
	"storageKey" varchar(512),
	"url" varchar(1024) NOT NULL,
	"description" text,
	"triggerKeywords" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"isEnabled" boolean DEFAULT true NOT NULL,
	"behaviorGeneral" text,
	"knowledgeGeneral" text,
	"knowledgeSpecific" text,
	"pricingKnowledge" text,
	"fallbackMessage" text,
	"humanHandoffRules" text,
	"prohibitedTopics" text,
	"businessHours" text,
	"audioUnderstandingEnabled" boolean DEFAULT false NOT NULL,
	"imageUnderstandingEnabled" boolean DEFAULT false NOT NULL,
	"mediaStorageEnabled" boolean DEFAULT false NOT NULL,
	"responseDelayMs" integer DEFAULT 1500 NOT NULL,
	"maxResponseLength" integer DEFAULT 600 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bot_settings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE INDEX "idx_bot_resources_user" ON "bot_resources" USING btree ("userId");