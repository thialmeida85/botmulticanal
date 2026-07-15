import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  auditLogs,
  customerInstallations,
  deploymentJobs,
  installationSecrets,
  integrationConnections,
  plans,
  subscriptions,
  tenantMembers,
  tenants,
} from "../../drizzle/schema";
import { decryptSecret, encryptSecret, secretHint } from "../_core/secrets";
import {
  checkPublicHealth,
  getNeonProject,
  getRenderService,
  syncRenderEnvironment,
  testAiProvider,
  testDatabaseConnection,
  triggerRenderDeploy,
} from "../services/provisioning";

const secretKey = z.enum([
  "RENDER_API_KEY",
  "NEON_API_KEY",
  "DATABASE_URL",
  "EVOLUTION_API_URL",
  "EVOLUTION_API_KEY",
  "EVOLUTION_INSTANCE_NAME",
  "GROQ_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "DEEPSEEK_API_KEY",
  "JWT_SECRET",
]);
async function database() {
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível");
  return db;
}
async function audit(
  actorUserId: number,
  action: string,
  entityType: string,
  entityId?: number,
  tenantId?: number,
  metadata: Record<string, unknown> = {}
) {
  const db = await database();
  await db
    .insert(auditLogs)
    .values({
      actorUserId,
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      tenantId,
      metadataJson: JSON.stringify(metadata),
    });
}
async function installationById(id: number) {
  const db = await database();
  const [item] = await db
    .select()
    .from(customerInstallations)
    .where(eq(customerInstallations.id, id))
    .limit(1);
  if (!item) throw new Error("Instalação não encontrada");
  return item;
}
async function secretMap(installationId: number) {
  const db = await database();
  const rows = await db
    .select()
    .from(installationSecrets)
    .where(eq(installationSecrets.installationId, installationId));
  return Object.fromEntries(
    rows.map((row: { key: string; encryptedValue: string }) => [
      row.key,
      decryptSecret(row.encryptedValue),
    ])
  );
}

export const adminRouter = router({
  overview: adminProcedure.query(async () => {
    const db = await database();
    const [tenantRows, installationRows, subscriptionRows, recentJobs] =
      await Promise.all([
        db.select().from(tenants).orderBy(desc(tenants.createdAt)),
        db.select().from(customerInstallations),
        db.select().from(subscriptions),
        db
          .select()
          .from(deploymentJobs)
          .orderBy(desc(deploymentJobs.createdAt))
          .limit(8),
      ]);
    return {
      tenants: tenantRows,
      installations: installationRows,
      subscriptions: subscriptionRows,
      recentJobs,
    };
  }),
  listPlans: adminProcedure.query(async () =>
    (await database()).select().from(plans).orderBy(plans.priceCents)
  ),
  savePlan: adminProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(2),
        code: z.string().regex(/^[a-z0-9-]+$/),
        priceCents: z.number().int().min(0),
        billingInterval: z.enum(["month", "year"]),
        limits: z.record(z.string(), z.number().int().nonnegative()),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const { id, limits, ...values } = input;
      let savedId = id;
      if (id)
        await db
          .update(plans)
          .set({
            ...values,
            limitsJson: JSON.stringify(limits),
            updatedAt: new Date(),
          })
          .where(eq(plans.id, id));
      else {
        const [created] = await db
          .insert(plans)
          .values({ ...values, limitsJson: JSON.stringify(limits) })
          .returning();
        savedId = created.id;
      }
      await audit(
        ctx.user.id,
        id ? "plan.updated" : "plan.created",
        "plan",
        savedId
      );
      return { id: savedId };
    }),
  createTenant: adminProcedure
    .input(
      z.object({
        name: z.string().min(2),
        legalName: z.string().optional(),
        document: z.string().optional(),
        slug: z.string().regex(/^[a-z0-9-]+$/),
        contactEmail: z.string().email(),
        planId: z.number().optional(),
        trialDays: z.number().int().min(0).max(90).default(14),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const trialEndsAt = input.trialDays
        ? new Date(Date.now() + input.trialDays * 86_400_000)
        : undefined;
      const [tenant] = await db
        .insert(tenants)
        .values({
          name: input.name,
          legalName: input.legalName,
          document: input.document,
          slug: input.slug,
          contactEmail: input.contactEmail,
          trialEndsAt,
        })
        .returning();
      await db
        .insert(tenantMembers)
        .values({ tenantId: tenant.id, userId: ctx.user.id, role: "owner" });
      if (input.planId)
        await db
          .insert(subscriptions)
          .values({
            tenantId: tenant.id,
            planId: input.planId,
            status: input.trialDays ? "trialing" : "active",
            currentPeriodEndsAt: trialEndsAt,
          });
      await audit(
        ctx.user.id,
        "tenant.created",
        "tenant",
        tenant.id,
        tenant.id
      );
      return tenant;
    }),
  updateTenantStatus: adminProcedure
    .input(
      z.object({
        tenantId: z.number(),
        status: z.enum(["trial", "active", "suspended", "cancelled"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      await db
        .update(tenants)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(tenants.id, input.tenantId));
      await audit(
        ctx.user.id,
        "tenant.status_changed",
        "tenant",
        input.tenantId,
        input.tenantId,
        { status: input.status }
      );
      return { success: true };
    }),
  createInstallation: adminProcedure
    .input(
      z.object({
        tenantId: z.number(),
        repositoryUrl: z.string().url(),
        branch: z.string().min(1).default("main"),
        renderServiceId: z.string().optional(),
        renderOwnerId: z.string().optional(),
        publicUrl: z.string().url().optional(),
        neonProjectId: z.string().optional(),
        neonBranchId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const [item] = await db
        .insert(customerInstallations)
        .values(input)
        .returning();
      await audit(
        ctx.user.id,
        "installation.created",
        "installation",
        item.id,
        input.tenantId
      );
      return item;
    }),
  getInstallation: adminProcedure
    .input(z.object({ installationId: z.number() }))
    .query(async ({ input }) => {
      const db = await database();
      const item = await installationById(input.installationId);
      const secretRows = await db
        .select({
          key: installationSecrets.key,
          valueHint: installationSecrets.valueHint,
          updatedAt: installationSecrets.updatedAt,
        })
        .from(installationSecrets)
        .where(eq(installationSecrets.installationId, input.installationId));
      const integrations = await db
        .select()
        .from(integrationConnections)
        .where(eq(integrationConnections.installationId, input.installationId));
      return { item, secrets: secretRows, integrations };
    }),
  saveSecret: adminProcedure
    .input(
      z.object({
        installationId: z.number(),
        key: secretKey,
        value: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const installation = await installationById(input.installationId);
      const [existing] = await db
        .select()
        .from(installationSecrets)
        .where(
          and(
            eq(installationSecrets.installationId, input.installationId),
            eq(installationSecrets.key, input.key)
          )
        )
        .limit(1);
      const values = {
        encryptedValue: encryptSecret(input.value),
        valueHint: secretHint(input.value),
        updatedAt: new Date(),
      };
      if (existing)
        await db
          .update(installationSecrets)
          .set(values)
          .where(eq(installationSecrets.id, existing.id));
      else
        await db
          .insert(installationSecrets)
          .values({
            installationId: input.installationId,
            key: input.key,
            ...values,
          });
      await audit(
        ctx.user.id,
        "secret.rotated",
        "installation",
        input.installationId,
        installation.tenantId,
        { key: input.key }
      );
      return { hint: secretHint(input.value) };
    }),
  saveIntegration: adminProcedure
    .input(
      z.object({
        installationId: z.number(),
        provider: z.enum([
          "render",
          "neon",
          "evolution",
          "groq",
          "openai",
          "gemini",
          "deepseek",
        ]),
        displayName: z.string().optional(),
        config: z.record(z.string(), z.string()).default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const installation = await installationById(input.installationId);
      const [existing] = await db
        .select()
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.installationId, input.installationId),
            eq(integrationConnections.provider, input.provider)
          )
        )
        .limit(1);
      const values = {
        displayName: input.displayName,
        configJson: JSON.stringify(input.config),
        updatedAt: new Date(),
      };
      if (existing)
        await db
          .update(integrationConnections)
          .set(values)
          .where(eq(integrationConnections.id, existing.id));
      else
        await db
          .insert(integrationConnections)
          .values({
            tenantId: installation.tenantId,
            installationId: input.installationId,
            provider: input.provider,
            ...values,
          });
      await audit(
        ctx.user.id,
        "integration.configured",
        "installation",
        input.installationId,
        installation.tenantId,
        { provider: input.provider }
      );
      return { success: true };
    }),
  testConnection: adminProcedure
    .input(
      z.object({
        installationId: z.number(),
        provider: z.enum([
          "render",
          "neon",
          "database",
          "groq",
          "openai",
          "gemini",
          "deepseek",
          "health",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const installation = await installationById(input.installationId);
      const secrets = await secretMap(input.installationId);
      try {
        if (input.provider === "render")
          await getRenderService(
            secrets.RENDER_API_KEY,
            installation.renderServiceId || ""
          );
        else if (input.provider === "neon")
          await getNeonProject(
            secrets.NEON_API_KEY,
            installation.neonProjectId || ""
          );
        else if (input.provider === "database")
          await testDatabaseConnection(secrets.DATABASE_URL);
        else if (input.provider === "health")
          await checkPublicHealth(installation.publicUrl || "");
        else
          await testAiProvider(
            input.provider,
            secrets[`${input.provider.toUpperCase()}_API_KEY`]
          );
        await db
          .update(integrationConnections)
          .set({
            lastTestStatus: "success",
            lastTestedAt: new Date(),
            lastError: null,
          })
          .where(
            and(
              eq(integrationConnections.installationId, input.installationId),
              eq(integrationConnections.provider, input.provider)
            )
          );
        await audit(
          ctx.user.id,
          "integration.test_succeeded",
          "installation",
          input.installationId,
          installation.tenantId,
          { provider: input.provider }
        );
        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Falha desconhecida";
        await db
          .update(integrationConnections)
          .set({
            lastTestStatus: "failed",
            lastTestedAt: new Date(),
            lastError: message,
          })
          .where(
            and(
              eq(integrationConnections.installationId, input.installationId),
              eq(integrationConnections.provider, input.provider)
            )
          );
        await audit(
          ctx.user.id,
          "integration.test_failed",
          "installation",
          input.installationId,
          installation.tenantId,
          { provider: input.provider }
        );
        throw new Error(message);
      }
    }),
  deploy: adminProcedure
    .input(z.object({ installationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const installation = await installationById(input.installationId);
      const secrets = await secretMap(input.installationId);
      if (!installation.renderServiceId || !secrets.RENDER_API_KEY)
        throw new Error("Render não configurado");
      const [job] = await db
        .insert(deploymentJobs)
        .values({
          installationId: input.installationId,
          type: "deploy",
          status: "running",
          startedAt: new Date(),
        })
        .returning();
      try {
        const environment = Object.fromEntries(
          Object.entries(secrets).filter(
            ([key]) => !["RENDER_API_KEY", "NEON_API_KEY"].includes(key)
          )
        );
        await syncRenderEnvironment(
          secrets.RENDER_API_KEY,
          installation.renderServiceId,
          { ...environment, NODE_ENV: "production" }
        );
        const deploy = await triggerRenderDeploy(
          secrets.RENDER_API_KEY,
          installation.renderServiceId
        );
        await db
          .update(deploymentJobs)
          .set({
            status: "succeeded",
            externalId: deploy?.id,
            finishedAt: new Date(),
            detailsJson: JSON.stringify({ deployId: deploy?.id }),
          })
          .where(eq(deploymentJobs.id, job.id));
        await db
          .update(customerInstallations)
          .set({
            status: "provisioning",
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(customerInstallations.id, input.installationId));
        await audit(
          ctx.user.id,
          "installation.deploy_started",
          "installation",
          input.installationId,
          installation.tenantId
        );
        return { jobId: job.id, deployId: deploy?.id };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Falha no deploy";
        await db
          .update(deploymentJobs)
          .set({ status: "failed", error: message, finishedAt: new Date() })
          .where(eq(deploymentJobs.id, job.id));
        await db
          .update(customerInstallations)
          .set({ status: "failed", lastError: message, updatedAt: new Date() })
          .where(eq(customerInstallations.id, input.installationId));
        throw new Error(message);
      }
    }),
  auditLog: adminProcedure
    .input(z.object({ tenantId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await database();
      return input?.tenantId
        ? db
            .select()
            .from(auditLogs)
            .where(eq(auditLogs.tenantId, input.tenantId))
            .orderBy(desc(auditLogs.createdAt))
            .limit(100)
        : db
            .select()
            .from(auditLogs)
            .orderBy(desc(auditLogs.createdAt))
            .limit(100);
    }),
});
