import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  contacts,
  contactTags,
  deals,
  pipelineStages,
  salesPipelines,
  tags,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  return db;
}

export const salesRouter = router({
  listTags: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    return db.select().from(tags).where(eq(tags.userId, ctx.user.id)).orderBy(asc(tags.name));
  }),

  createTag: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(80), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [tag] = await db.insert(tags).values({ userId: ctx.user.id, ...input }).returning();
      return tag;
    }),

  getContactTags: protectedProcedure.input(z.object({ contactId: z.number() })).query(async ({ ctx, input }) => {
    const db = await requireDb();
    return db
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(contactTags)
      .innerJoin(tags, eq(tags.id, contactTags.tagId))
      .where(and(eq(contactTags.userId, ctx.user.id), eq(contactTags.contactId, input.contactId)));
  }),

  toggleContactTag: protectedProcedure
    .input(z.object({ contactId: z.number(), tagId: z.number(), selected: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const where = and(
        eq(contactTags.userId, ctx.user.id),
        eq(contactTags.contactId, input.contactId),
        eq(contactTags.tagId, input.tagId)
      );
      if (input.selected) {
        const existing = await db.select({ id: contactTags.id }).from(contactTags).where(where).limit(1);
        if (!existing.length) await db.insert(contactTags).values({ userId: ctx.user.id, contactId: input.contactId, tagId: input.tagId });
      } else {
        await db.delete(contactTags).where(where);
      }
      return { success: true };
    }),

  listPipelines: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const pipelines = await db.select().from(salesPipelines).where(eq(salesPipelines.userId, ctx.user.id)).orderBy(asc(salesPipelines.createdAt));
    return Promise.all(pipelines.map(async (pipeline: any) => ({
      ...pipeline,
      stages: await db.select().from(pipelineStages).where(and(eq(pipelineStages.userId, ctx.user.id), eq(pipelineStages.pipelineId, pipeline.id))).orderBy(asc(pipelineStages.position)),
    })));
  }),

  createPipeline: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [pipeline] = await db.insert(salesPipelines).values({ userId: ctx.user.id, name: input.name }).returning();
      await db.insert(pipelineStages).values([
        { userId: ctx.user.id, pipelineId: pipeline.id, name: "Novos leads", color: "#3b82f6", position: 0 },
        { userId: ctx.user.id, pipelineId: pipeline.id, name: "Em atendimento", color: "#f59e0b", position: 1 },
        { userId: ctx.user.id, pipelineId: pipeline.id, name: "Proposta enviada", color: "#8b5cf6", position: 2 },
        { userId: ctx.user.id, pipelineId: pipeline.id, name: "Fechado", color: "#10b981", position: 3 },
      ]);
      return pipeline;
    }),

  createStage: protectedProcedure
    .input(z.object({ pipelineId: z.number(), name: z.string().trim().min(1).max(120), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const current = await db.select().from(pipelineStages).where(and(eq(pipelineStages.userId, ctx.user.id), eq(pipelineStages.pipelineId, input.pipelineId)));
      const [stage] = await db.insert(pipelineStages).values({ ...input, userId: ctx.user.id, position: current.length }).returning();
      return stage;
    }),

  getBoard: protectedProcedure.input(z.object({ pipelineId: z.number() })).query(async ({ ctx, input }) => {
    const db = await requireDb();
    const stages = await db.select().from(pipelineStages).where(and(eq(pipelineStages.userId, ctx.user.id), eq(pipelineStages.pipelineId, input.pipelineId))).orderBy(asc(pipelineStages.position));
    const boardDeals = await db
      .select({ deal: deals, contact: contacts })
      .from(deals)
      .innerJoin(contacts, eq(contacts.id, deals.contactId))
      .where(and(eq(deals.userId, ctx.user.id), eq(deals.pipelineId, input.pipelineId)))
      .orderBy(asc(deals.position));
    return { stages, deals: boardDeals.map(({ deal, contact }: any) => ({ ...deal, contact })) };
  }),

  createDeal: protectedProcedure
    .input(z.object({
      pipelineId: z.number(), stageId: z.number(), contactId: z.number(), conversationId: z.number().optional(),
      title: z.string().trim().min(1).max(255), value: z.number().int().min(0).default(0), notes: z.string().max(5000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const current = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.userId, ctx.user.id), eq(deals.stageId, input.stageId)));
      const [deal] = await db.insert(deals).values({ ...input, userId: ctx.user.id, position: current.length }).returning();
      return deal;
    }),

  moveDeal: protectedProcedure
    .input(z.object({ dealId: z.number(), stageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const current = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.userId, ctx.user.id), eq(deals.stageId, input.stageId)));
      await db.update(deals).set({ stageId: input.stageId, position: current.length, updatedAt: new Date() }).where(and(eq(deals.id, input.dealId), eq(deals.userId, ctx.user.id)));
      return { success: true };
    }),
});
