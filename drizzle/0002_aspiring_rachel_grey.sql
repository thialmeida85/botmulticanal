ALTER TABLE "contacts" ADD COLUMN "company" varchar(255);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "cnpj" varchar(14);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "segment" varchar(255);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "city" varchar(255);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "state" varchar(2);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "email" varchar(320);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "leadStatus" varchar(50);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "leadScore" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "source" varchar(255);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "customMessage" text;