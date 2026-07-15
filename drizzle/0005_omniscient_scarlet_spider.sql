CREATE TYPE "public"."installation_status" AS ENUM('draft', 'provisioning', 'active', 'failed', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tenant_role" AS ENUM('owner', 'admin', 'agent', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('trial', 'active', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"actorUserId" integer,
	"action" varchar(120) NOT NULL,
	"entityType" varchar(80) NOT NULL,
	"entityId" varchar(80),
	"metadataJson" text DEFAULT '{}' NOT NULL,
	"ipAddress" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_installations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"status" "installation_status" DEFAULT 'draft' NOT NULL,
	"renderServiceId" varchar(255),
	"renderOwnerId" varchar(255),
	"publicUrl" text,
	"repositoryUrl" text,
	"branch" varchar(120) DEFAULT 'main' NOT NULL,
	"neonProjectId" varchar(255),
	"neonBranchId" varchar(255),
	"installedVersion" varchar(80),
	"lastHealthStatus" varchar(40),
	"lastHealthCheckedAt" timestamp,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployment_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"installationId" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"externalId" varchar(255),
	"detailsJson" text DEFAULT '{}' NOT NULL,
	"error" text,
	"startedAt" timestamp,
	"finishedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installation_secrets" (
	"id" serial PRIMARY KEY NOT NULL,
	"installationId" integer NOT NULL,
	"key" varchar(120) NOT NULL,
	"encryptedValue" text NOT NULL,
	"valueHint" varchar(32),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"installationId" integer,
	"provider" varchar(60) NOT NULL,
	"displayName" varchar(120),
	"configJson" text DEFAULT '{}' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastTestStatus" varchar(40),
	"lastTestedAt" timestamp,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(80) NOT NULL,
	"priceCents" integer DEFAULT 0 NOT NULL,
	"billingInterval" varchar(20) DEFAULT 'month' NOT NULL,
	"limitsJson" text DEFAULT '{}' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"planId" integer NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"provider" varchar(40),
	"externalCustomerId" varchar(255),
	"externalSubscriptionId" varchar(255),
	"currentPeriodEndsAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"userId" integer NOT NULL,
	"role" "tenant_role" DEFAULT 'agent' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"legalName" varchar(255),
	"document" varchar(32),
	"slug" varchar(100) NOT NULL,
	"contactEmail" varchar(320),
	"status" "tenant_status" DEFAULT 'trial' NOT NULL,
	"trialEndsAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "idx_audit_logs_tenant" ON "audit_logs" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" USING btree ("actorUserId");--> statement-breakpoint
CREATE INDEX "idx_installations_tenant" ON "customer_installations" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_deployment_jobs_installation" ON "deployment_jobs" USING btree ("installationId");--> statement-breakpoint
CREATE INDEX "idx_installation_secrets_installation" ON "installation_secrets" USING btree ("installationId");--> statement-breakpoint
CREATE INDEX "idx_integrations_tenant" ON "integration_connections" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_tenant" ON "subscriptions" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_tenant_members_tenant" ON "tenant_members" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idx_tenant_members_user" ON "tenant_members" USING btree ("userId");