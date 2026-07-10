import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getApiCredential,
  upsertApiCredential,
  getChatbotRules,
  saveChatbotRule,
  updateChatbotRule,
  deleteChatbotRule,
  getNotificationSettings,
  upsertNotificationSettings,
} from "../db";
import { getDb } from "../db";
import { botResources, botSettings } from "../../drizzle/schema";
import { storagePut } from "../storage";

export const settingsRouter = router({
  getBotSettings: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Banco indisponível");
    const [settings] = await db.select().from(botSettings).where(eq(botSettings.userId, ctx.user.id)).limit(1);
    return settings || {
      isEnabled: true, behaviorGeneral: "", knowledgeGeneral: "", knowledgeSpecific: "", pricingKnowledge: "",
      fallbackMessage: "", humanHandoffRules: "", prohibitedTopics: "", businessHours: "",
      audioUnderstandingEnabled: false, imageUnderstandingEnabled: false, mediaStorageEnabled: false,
      responseDelayMs: 1500, maxResponseLength: 600,
    };
  }),

  saveBotSettings: protectedProcedure.input(z.object({
    isEnabled: z.boolean(), behaviorGeneral: z.string().max(20000), knowledgeGeneral: z.string().max(50000),
    knowledgeSpecific: z.string().max(50000), pricingKnowledge: z.string().max(30000), fallbackMessage: z.string().max(5000),
    humanHandoffRules: z.string().max(10000), prohibitedTopics: z.string().max(10000), businessHours: z.string().max(5000),
    audioUnderstandingEnabled: z.boolean(), imageUnderstandingEnabled: z.boolean(), mediaStorageEnabled: z.boolean(),
    responseDelayMs: z.number().int().min(0).max(15000), maxResponseLength: z.number().int().min(100).max(4000),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Banco indisponível");
    const [existing] = await db.select().from(botSettings).where(eq(botSettings.userId, ctx.user.id)).limit(1);
    if (existing) await db.update(botSettings).set({ ...input, updatedAt: new Date() }).where(eq(botSettings.id, existing.id));
    else await db.insert(botSettings).values({ userId: ctx.user.id, ...input });
    return { success: true };
  }),

  listBotResources: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Banco indisponível");
    return db.select().from(botResources).where(eq(botResources.userId, ctx.user.id)).orderBy(desc(botResources.createdAt));
  }),

  uploadBotResource: protectedProcedure.input(z.object({
    name: z.string().min(1).max(255), resourceType: z.enum(["document", "image", "video", "audio", "link"]),
    mimeType: z.string().max(120).optional(), base64: z.string().max(20_000_000).optional(), externalUrl: z.string().url().optional(),
    description: z.string().max(5000).optional(), triggerKeywords: z.string().max(2000).optional(),
  }).refine((data) => data.base64 || data.externalUrl, "Envie um arquivo ou URL")).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Banco indisponível");
    let url = input.externalUrl || "";
    let storageKey: string | undefined;
    if (input.base64) {
      const data = Buffer.from(input.base64.replace(/^data:[^;]+;base64,/, ""), "base64");
      const stored = await storagePut(`bot-resources/${ctx.user.id}/${input.name}`, data, input.mimeType);
      url = stored.url;
      storageKey = stored.key;
    }
    const [resource] = await db.insert(botResources).values({ userId: ctx.user.id, name: input.name, resourceType: input.resourceType, mimeType: input.mimeType, storageKey, url, description: input.description, triggerKeywords: input.triggerKeywords }).returning();
    return resource;
  }),

  deleteBotResource: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Banco indisponível");
    await db.delete(botResources).where(and(eq(botResources.id, input.id), eq(botResources.userId, ctx.user.id)));
    return { success: true };
  }),
  /**
   * Obter credenciais de API
   */
  getApiCredentials: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["whatsapp", "instagram"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const credential = await getApiCredential(ctx.user.id, input.platform);

      if (!credential) {
        return null;
      }

      // Não retornar o token completo por segurança
      return {
        id: credential.id,
        platform: credential.platform,
        isActive: credential.isActive,
        phoneNumberId: credential.phoneNumberId,
        businessAccountId: credential.businessAccountId,
        hasToken: !!credential.token,
      };
    }),

  /**
   * Salvar credenciais de API
   */
  saveApiCredentials: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["whatsapp", "instagram"]),
        token: z.string().min(1),
        secretKey: z.string().optional(),
        phoneNumberId: z.string().optional(),
        businessAccountId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await upsertApiCredential(ctx.user.id, input.platform, {
          token: input.token,
          secretKey: input.secretKey,
          phoneNumberId: input.phoneNumberId,
          businessAccountId: input.businessAccountId,
        });

        return { success: true };
      } catch (error) {
        console.error("[Settings] Erro ao salvar credenciais:", error);
        throw new Error("Falha ao salvar credenciais");
      }
    }),

  /**
   * Obter regras de chatbot
   */
  getChatbotRules: protectedProcedure.query(async ({ ctx }) => {
    return getChatbotRules(ctx.user.id);
  }),

  /**
   * Criar nova regra de chatbot
   */
  createChatbotRule: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        triggerKeywords: z.string().min(1),
        responseTemplate: z.string().min(1),
        platform: z.enum(["whatsapp", "instagram", "both"]).default("both"),
        priority: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const ruleId = await saveChatbotRule({
          userId: ctx.user.id,
          name: input.name,
          triggerKeywords: input.triggerKeywords,
          responseTemplate: input.responseTemplate,
          platform: input.platform,
          priority: input.priority,
        });

        return { success: true, ruleId };
      } catch (error) {
        console.error("[Settings] Erro ao criar regra:", error);
        throw new Error("Falha ao criar regra");
      }
    }),

  /**
   * Atualizar regra de chatbot
   */
  updateChatbotRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.number(),
        name: z.string().optional(),
        triggerKeywords: z.string().optional(),
        responseTemplate: z.string().optional(),
        platform: z.enum(["whatsapp", "instagram", "both"]).optional(),
        priority: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { ruleId, ...data } = input;
        await updateChatbotRule(ruleId, data);

        return { success: true };
      } catch (error) {
        console.error("[Settings] Erro ao atualizar regra:", error);
        throw new Error("Falha ao atualizar regra");
      }
    }),

  /**
   * Deletar regra de chatbot
   */
  deleteChatbotRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteChatbotRule(input.ruleId);

        return { success: true };
      } catch (error) {
        console.error("[Settings] Erro ao deletar regra:", error);
        throw new Error("Falha ao deletar regra");
      }
    }),

  /**
   * Obter configurações de notificação
   */
  getNotificationSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getNotificationSettings(ctx.user.id);

    return (
      settings || {
        emailNotificationsEnabled: true,
        unreadMessageThreshold: 10,
        notifyOnEveryMessage: false,
        notifyOnImportantKeywords: "",
      }
    );
  }),

  /**
   * Salvar configurações de notificação
   */
  saveNotificationSettings: protectedProcedure
    .input(
      z.object({
        emailNotificationsEnabled: z.boolean().optional(),
        unreadMessageThreshold: z.number().optional(),
        notifyOnEveryMessage: z.boolean().optional(),
        notifyOnImportantKeywords: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await upsertNotificationSettings(ctx.user.id, input);

        return { success: true };
      } catch (error) {
        console.error("[Settings] Erro ao salvar configurações:", error);
        throw new Error("Falha ao salvar configurações");
      }
    }),
});
