import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { supportTickets, conversations, contacts } from "../../drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import {
  getConversationsByUserId,
  getMessagesByConversation,
  saveMessage,
  getContactsByUserId,
  getOrCreateContact,
  getOrCreateConversation,
  updateConversationUnreadCount,
  getNotificationSettings,
} from "../db";
import { generateResponseSuggestion } from "../services/llm";
import { sendInstagramMessage } from "../services/messaging";
import { sendEvolutionText } from "../services/evolution";

export const messagesRouter = router({
  /**
   * Obter todas as conversas do usuário
   */
  getConversations: protectedProcedure
    .input(
      z.object({
        status: z.enum(["open", "closed", "pending"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const conversations = await getConversationsByUserId(
          ctx.user.id,
          input.status
        );
        const allContacts = await getContactsByUserId(ctx.user.id);

        const enriched = conversations.map((conv: any) => {
          const contactData = allContacts.find(
            (c: any) => c.id === conv.contactId
          );
          return {
            ...conv,
            contact: contactData || {
              name: "Desconhecido",
              phoneNumber: "Sem número",
            },
          };
        });

        return enriched;
      } catch (error) {
        console.error("[Messages Router] Erro ao buscar conversas:", error);
        return [];
      }
    }),

  /**
   * Obter mensagens de uma conversa
   */
  getMessages: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      const [ownedConversation] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!ownedConversation) throw new Error("Conversa não encontrada");
      return getMessagesByConversation(input.conversationId, input.limit);
    }),

  /**
   * Enviar mensagem manual
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        contactId: z.number(),
        content: z.string().min(1).max(500),
        platform: z.enum(["whatsapp", "instagram"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let deliveryAttempt: {
        conversationId: number;
        contactId: number;
        platform: "whatsapp" | "instagram";
      } | null = null;
      try {
        const db = await getDb();
        if (!db) throw new Error("Banco de dados indisponível");
        const [conversation] = await db
          .select({ conversation: conversations, contact: contacts })
          .from(conversations)
          .innerJoin(contacts, eq(contacts.id, conversations.contactId))
          .where(
            and(
              eq(conversations.id, input.conversationId),
              eq(conversations.userId, ctx.user.id)
            )
          )
          .limit(1);
        if (!conversation) throw new Error("Conversa não encontrada");
        if (
          conversation.contact.id !== input.contactId ||
          conversation.conversation.platform !== input.platform
        ) {
          throw new Error("Contato ou canal inválido para esta conversa");
        }
        deliveryAttempt = {
          conversationId: input.conversationId,
          contactId: input.contactId,
          platform: input.platform,
        };

        let externalMessageId: string | undefined;
        if (input.platform === "whatsapp") {
          if (!conversation.contact.phoneNumber)
            throw new Error("Contato sem número de WhatsApp");
          const delivery = await sendEvolutionText(
            conversation.contact.phoneNumber,
            input.content
          );
          externalMessageId = delivery.externalMessageId;
        } else {
          await sendInstagramMessage(
            ctx.user.id,
            conversation.contact.externalId,
            input.content
          );
        }

        const messageId = await saveMessage({
          conversationId: input.conversationId,
          contactId: input.contactId,
          userId: ctx.user.id,
          platform: input.platform,
          direction: "outbound",
          messageType: "text",
          content: input.content,
          externalMessageId,
          status: "sent",
        });

        return { success: true, messageId };
      } catch (error) {
        console.error("[Messages] Erro ao enviar mensagem:", error);
        if (deliveryAttempt) {
          try {
            await saveMessage({
              ...deliveryAttempt,
              userId: ctx.user.id,
              direction: "outbound",
              messageType: "text",
              content: input.content,
              status: "failed",
            });
          } catch (auditError) {
            console.error(
              "[Messages] Erro ao auditar falha de envio:",
              auditError
            );
          }
        }
        const reason =
          error instanceof Error ? error.message : "erro desconhecido";
        throw new Error(`Falha ao enviar mensagem: ${reason}`);
      }
    }),

  /**
   * Obter sugestão de resposta para uma mensagem
   */
  getSuggestion: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        messageContent: z.string(),
        contactName: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const suggestion = await generateResponseSuggestion(
        input.conversationId,
        input.messageContent,
        input.contactName
      );

      return { suggestion };
    }),

  /**
   * Marcar conversa como lida
   */
  markAsRead: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      const [ownedConversation] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!ownedConversation) throw new Error("Conversa não encontrada");
      await updateConversationUnreadCount(input.conversationId, 0);
      return { success: true };
    }),

  /**
   * Obter contatos
   */
  getContacts: protectedProcedure
    .input(
      z.object({
        platform: z.enum(["whatsapp", "instagram"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const allContacts = await getContactsByUserId(
        ctx.user.id,
        input.platform
      );

      if (!db) return allContacts;

      // Enriquecer com métricas de chamados e conversas
      const enriched = await Promise.all(
        allContacts.map(async (c: any) => {
          const tks = await db
            .select({ id: supportTickets.id })
            .from(supportTickets)
            .where(eq(supportTickets.contactId, c.id));
          const convs = await db
            .select({ id: conversations.id })
            .from(conversations)
            .where(eq(conversations.contactId, c.id));
          return {
            ...c,
            customerCode: `CLI-${String(c.id).padStart(4, "0")}`,
            ticketCount: tks.length,
            interactionsCount: convs.length,
          };
        })
      );

      return enriched;
    }),

  /**
   * Obter chamados do contato
   */
  getContactTickets: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(supportTickets)
        .where(
          and(
            eq(supportTickets.contactId, input.contactId),
            eq(supportTickets.userId, ctx.user.id)
          )
        )
        .orderBy(desc(supportTickets.createdAt));
    }),

  /**
   * Importar contatos em lote (CSV/Excel)
   */
  importContacts: protectedProcedure
    .input(
      z.object({
        contacts: z.array(
          z.object({
            name: z.string(),
            phoneNumber: z.string(),
            platform: z.enum(["whatsapp", "instagram"]),
            externalId: z.string(),
            company: z.string().optional(),
            cnpj: z.string().optional(),
            segment: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            email: z.string().optional(),
            leadStatus: z.string().optional(),
            leadScore: z.number().int().min(0).max(100).optional(),
            source: z.string().optional(),
            customMessage: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let imported = 0;
      for (const contact of input.contacts) {
        try {
          await getOrCreateContact(
            ctx.user.id,
            contact.externalId,
            contact.platform,
            {
              name: contact.name,
              phoneNumber: contact.phoneNumber,
              company: contact.company,
              cnpj: contact.cnpj,
              segment: contact.segment,
              city: contact.city,
              state: contact.state,
              email: contact.email,
              leadStatus: contact.leadStatus,
              leadScore: contact.leadScore,
              source: contact.source,
              customMessage: contact.customMessage,
            }
          );
          imported++;
        } catch (error) {
          console.error("[Messages Router] Erro ao importar contato:", error);
        }
      }
      return { success: true, imported };
    }),

  /**
   * Obter estatísticas do dashboard
   */
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const conversations = await getConversationsByUserId(ctx.user.id);
    const openConversations = conversations.filter(
      (c: any) => c.status === "open"
    );
    const totalUnread = openConversations.reduce(
      (sum: number, c: any) => sum + c.unreadCount,
      0
    );

    const settings = await getNotificationSettings(ctx.user.id);

    return {
      totalConversations: conversations.length,
      openConversations: openConversations.length,
      totalUnread,
      unreadThreshold: settings?.unreadMessageThreshold || 10,
    };
  }),
});
