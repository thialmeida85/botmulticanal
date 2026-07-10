import { eq, and, or, desc, asc, like, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser,
  users,
  apiCredentials,
  contacts,
  conversations,
  messages,
  chatbotRules,
  notificationSettings,
  notificationLogs,
  supportTickets,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: any = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL, { prepare: false });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// API Credentials
export async function getApiCredential(
  userId: number,
  platform: "whatsapp" | "instagram"
) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(apiCredentials)
    .where(
      and(
        eq(apiCredentials.userId, userId),
        eq(apiCredentials.platform, platform)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertApiCredential(
  userId: number,
  platform: "whatsapp" | "instagram",
  data: {
    token: string;
    secretKey?: string;
    phoneNumberId?: string;
    businessAccountId?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getApiCredential(userId, platform);

  if (existing) {
    await db
      .update(apiCredentials)
      .set({
        token: data.token,
        secretKey: data.secretKey,
        phoneNumberId: data.phoneNumberId,
        businessAccountId: data.businessAccountId,
        updatedAt: new Date(),
      })
      .where(eq(apiCredentials.id, existing.id));
  } else {
    await db.insert(apiCredentials).values({
      userId,
      platform,
      token: data.token,
      secretKey: data.secretKey,
      phoneNumberId: data.phoneNumberId,
      businessAccountId: data.businessAccountId,
    });
  }
}

// Contacts
export async function getOrCreateContact(
  userId: number,
  externalId: string,
  platform: "whatsapp" | "instagram",
  data?: {
    name?: string;
    phoneNumber?: string;
    company?: string;
    cnpj?: string;
    segment?: string;
    city?: string;
    state?: string;
    email?: string;
    leadStatus?: string;
    leadScore?: number;
    source?: string;
    customMessage?: string;
    instagramHandle?: string;
    profilePicture?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(contacts)
    .where(and(
      eq(contacts.userId, userId),
      eq(contacts.platform, platform),
      platform === "whatsapp" && data?.phoneNumber
        ? or(eq(contacts.externalId, externalId), eq(contacts.phoneNumber, data.phoneNumber))
        : eq(contacts.externalId, externalId)
    ))
    .limit(1);

  if (existing.length > 0) {
    if (data) {
      await db
        .update(contacts)
        .set({
          name: data.name || existing[0].name,
          phoneNumber: data.phoneNumber || existing[0].phoneNumber,
          company: data.company || existing[0].company,
          cnpj: data.cnpj || existing[0].cnpj,
          segment: data.segment || existing[0].segment,
          city: data.city || existing[0].city,
          state: data.state || existing[0].state,
          email: data.email || existing[0].email,
          leadStatus: data.leadStatus || existing[0].leadStatus,
          leadScore: data.leadScore ?? existing[0].leadScore,
          source: data.source || existing[0].source,
          customMessage: data.customMessage || existing[0].customMessage,
          instagramHandle: data.instagramHandle || existing[0].instagramHandle,
          profilePicture: data.profilePicture || existing[0].profilePicture,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, existing[0].id));
    }
    return existing[0];
  }

  const result = await db
    .insert(contacts)
    .values({
      userId,
      externalId,
      platform,
      name: data?.name,
      phoneNumber: data?.phoneNumber,
      company: data?.company,
      cnpj: data?.cnpj,
      segment: data?.segment,
      city: data?.city,
      state: data?.state,
      email: data?.email,
      leadStatus: data?.leadStatus,
      leadScore: data?.leadScore,
      source: data?.source,
      customMessage: data?.customMessage,
      instagramHandle: data?.instagramHandle,
      profilePicture: data?.profilePicture,
    })
    .returning({ id: contacts.id });

  return {
    id: result[0].id,
    userId,
    externalId,
    platform,
    name: data?.name,
    phoneNumber: data?.phoneNumber,
    company: data?.company,
    cnpj: data?.cnpj,
    segment: data?.segment,
    city: data?.city,
    state: data?.state,
    email: data?.email,
    leadStatus: data?.leadStatus,
    leadScore: data?.leadScore,
    source: data?.source,
    customMessage: data?.customMessage,
    instagramHandle: data?.instagramHandle,
    profilePicture: data?.profilePicture,
    lastInteractionAt: null,
    status: "active" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function getContactsByUserId(
  userId: number,
  platform?: "whatsapp" | "instagram"
) {
  const db = await getDb();
  if (!db) return [];

  const userObj = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const isAdmin = userObj.length > 0 && userObj[0].role === "admin";

  const conditions = [];
  if (!isAdmin) {
    conditions.push(eq(contacts.userId, userId));
  }
  if (platform) {
    conditions.push(eq(contacts.platform, platform));
  }

  return db
    .select()
    .from(contacts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contacts.createdAt));
}

// Conversations
export async function getOrCreateConversation(
  userId: number,
  contactId: number,
  platform: "whatsapp" | "instagram"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.contactId, contactId),
        eq(conversations.platform, platform)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const result = await db
    .insert(conversations)
    .values({
      userId,
      contactId,
      platform,
      status: "open",
    })
    .returning({ id: conversations.id });

  return {
    id: result[0].id,
    userId,
    contactId,
    platform,
    externalConversationId: null,
    subject: null,
    status: "open" as const,
    unreadCount: 0,
    lastMessageAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function getConversationsByUserId(
  userId: number,
  status?: "open" | "closed" | "pending"
) {
  const db = await getDb();
  if (!db) return [];

  const userObj = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const isAdmin = userObj.length > 0 && userObj[0].role === "admin";

  const conditions = [];
  if (!isAdmin) {
    conditions.push(eq(conversations.userId, userId));
  }
  if (status) {
    conditions.push(eq(conversations.status, status));
  }

  return db
    .select()
    .from(conversations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(conversations.createdAt));
}

export async function updateConversationUnreadCount(
  conversationId: number,
  count: number
) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(conversations)
    .set({ unreadCount: count, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

// Messages
export async function saveMessage(data: {
  conversationId: number;
  contactId: number;
  userId: number;
  externalMessageId?: string;
  platform: "whatsapp" | "instagram";
  direction: "inbound" | "outbound";
  messageType?: "text" | "image" | "video" | "audio" | "document" | "location";
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  status?: "sent" | "delivered" | "read" | "failed";
  senderName?: string;
  senderPhone?: string;
  senderInstagramHandle?: string;
  llmSuggestion?: string;
  automatedResponse?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .insert(messages)
    .values(data)
    .returning({ id: messages.id });

  // Atualiza a data da última mensagem para a conversa aparecer no topo do Dashboard
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(conversations.id, data.conversationId));

  return result[0].id;
}

export async function getMessagesByConversation(
  conversationId: number,
  limit = 50
) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .then((res: any[]) => res.reverse()); // Inverte para manter a ordem cronológica para a IA
}

export async function updateMessageStatus(
  messageId: number,
  status: "sent" | "delivered" | "read" | "failed"
) {
  const db = await getDb();
  if (!db) return;

  await db.update(messages).set({ status }).where(eq(messages.id, messageId));
}

export async function getUnreadMessageCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;

  const userObj = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const isAdmin = userObj.length > 0 && userObj[0].role === "admin";

  const conditions = [eq(messages.direction, "inbound")];

  if (!isAdmin) {
    conditions.push(eq(messages.userId, userId));
  }

  const result = await db
    .select({ count: messages.id })
    .from(messages)
    .where(and(...conditions));

  return result.length;
}

// Chatbot Rules
export async function getChatbotRules(
  userId: number,
  platform?: "whatsapp" | "instagram" | "both"
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(chatbotRules.userId, userId),
    eq(chatbotRules.isActive, true),
  ];

  if (platform) {
    conditions.push(
      platform === "both"
        ? eq(chatbotRules.platform, "both")
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (eq(chatbotRules.platform, platform) as any)
    );
  }

  return db
    .select()
    .from(chatbotRules)
    .where(and(...conditions))
    .orderBy(desc(chatbotRules.priority));
}

export async function saveChatbotRule(data: {
  userId: number;
  name: string;
  triggerKeywords: string;
  responseTemplate: string;
  platform?: "whatsapp" | "instagram" | "both";
  priority?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .insert(chatbotRules)
    .values(data)
    .returning({ id: chatbotRules.id });
  return result[0].id;
}

export async function updateChatbotRule(
  ruleId: number,
  data: Partial<{
    name: string;
    triggerKeywords: string;
    responseTemplate: string;
    platform: "whatsapp" | "instagram" | "both";
    priority: number;
    isActive: boolean;
  }>
) {
  const db = await getDb();
  if (!db) return;

  await db.update(chatbotRules).set(data).where(eq(chatbotRules.id, ruleId));
}

export async function deleteChatbotRule(ruleId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(chatbotRules).where(eq(chatbotRules.id, ruleId));
}

// Notification Settings
export async function getNotificationSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function upsertNotificationSettings(
  userId: number,
  data: Partial<typeof notificationSettings.$inferInsert>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getNotificationSettings(userId);

  if (existing) {
    await db
      .update(notificationSettings)
      .set(data)
      .where(eq(notificationSettings.userId, userId));
  } else {
    await db.insert(notificationSettings).values({
      userId,
      ...data,
    });
  }
}

// Notification Logs
export async function saveNotificationLog(data: {
  userId: number;
  type: "email" | "in_app";
  title: string;
  content: string;
  messageId?: number;
  conversationId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .insert(notificationLogs)
    .values(data)
    .returning({ id: notificationLogs.id });
  return result[0].id;
}

export async function getNotificationLogs(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(notificationLogs)
    .where(eq(notificationLogs.userId, userId))
    .orderBy(desc(notificationLogs.sentAt))
    .limit(limit);
}

// ============================================================================
// CHAMADOS (TICKETS)
// ============================================================================
export async function createSupportTicket(data: {
  userId: number;
  contactId: number;
  subject: string;
  description: string;
}) {
  const db = await getDb();
  if (!db) return;
  const ticketCode = `TKT-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;
  await db.insert(supportTickets).values({
    ...data,
    ticketCode,
    status: "open",
  });
  return ticketCode;
}
