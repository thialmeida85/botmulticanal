import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  index,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const platformEnum = pgEnum("platform", [
  "whatsapp",
  "instagram",
  "both",
]);
export const contactStatusEnum = pgEnum("contact_status", [
  "active",
  "inactive",
  "blocked",
]);
export const conversationStatusEnum = pgEnum("conversation_status", [
  "open",
  "closed",
  "pending",
]);
export const directionEnum = pgEnum("direction", ["inbound", "outbound"]);
export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "image",
  "video",
  "audio",
  "document",
  "location",
]);
export const messageStatusEnum = pgEnum("message_status", [
  "sent",
  "delivered",
  "read",
  "failed",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "email",
  "in_app",
]);
export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
  "failed",
]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);
export const dealStatusEnum = pgEnum("deal_status", ["open", "won", "lost"]);
export const tenantStatusEnum = pgEnum("tenant_status", [
  "trial",
  "active",
  "suspended",
  "cancelled",
]);
export const tenantRoleEnum = pgEnum("tenant_role", [
  "owner",
  "admin",
  "agent",
  "viewer",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "cancelled",
]);
export const installationStatusEnum = pgEnum("installation_status", [
  "draft",
  "provisioning",
  "active",
  "failed",
  "suspended",
]);
export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Control plane: clientes, acessos, planos e instalações isoladas.
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  legalName: varchar("legalName", { length: 255 }),
  document: varchar("document", { length: 32 }),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  status: tenantStatusEnum("status").default("trial").notNull(),
  trialEndsAt: timestamp("trialEndsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull(),
    userId: integer("userId").notNull(),
    role: tenantRoleEnum("role").default("agent").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    tenantIdx: index("idx_tenant_members_tenant").on(table.tenantId),
    userIdx: index("idx_tenant_members_user").on(table.userId),
  })
);
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  code: varchar("code", { length: 80 }).notNull().unique(),
  priceCents: integer("priceCents").default(0).notNull(),
  billingInterval: varchar("billingInterval", { length: 20 })
    .default("month")
    .notNull(),
  limitsJson: text("limitsJson").default("{}").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull(),
    planId: integer("planId").notNull(),
    status: subscriptionStatusEnum("status").default("trialing").notNull(),
    provider: varchar("provider", { length: 40 }),
    externalCustomerId: varchar("externalCustomerId", { length: 255 }),
    externalSubscriptionId: varchar("externalSubscriptionId", { length: 255 }),
    currentPeriodEndsAt: timestamp("currentPeriodEndsAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({ tenantIdx: index("idx_subscriptions_tenant").on(table.tenantId) })
);
export const customerInstallations = pgTable(
  "customer_installations",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull(),
    status: installationStatusEnum("status").default("draft").notNull(),
    renderServiceId: varchar("renderServiceId", { length: 255 }),
    renderOwnerId: varchar("renderOwnerId", { length: 255 }),
    publicUrl: text("publicUrl"),
    repositoryUrl: text("repositoryUrl"),
    branch: varchar("branch", { length: 120 }).default("main").notNull(),
    neonProjectId: varchar("neonProjectId", { length: 255 }),
    neonBranchId: varchar("neonBranchId", { length: 255 }),
    installedVersion: varchar("installedVersion", { length: 80 }),
    lastHealthStatus: varchar("lastHealthStatus", { length: 40 }),
    lastHealthCheckedAt: timestamp("lastHealthCheckedAt"),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({ tenantIdx: index("idx_installations_tenant").on(table.tenantId) })
);
export const installationSecrets = pgTable(
  "installation_secrets",
  {
    id: serial("id").primaryKey(),
    installationId: integer("installationId").notNull(),
    key: varchar("key", { length: 120 }).notNull(),
    encryptedValue: text("encryptedValue").notNull(),
    valueHint: varchar("valueHint", { length: 32 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    installationIdx: index("idx_installation_secrets_installation").on(
      table.installationId
    ),
  })
);
export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId").notNull(),
    installationId: integer("installationId"),
    provider: varchar("provider", { length: 60 }).notNull(),
    displayName: varchar("displayName", { length: 120 }),
    configJson: text("configJson").default("{}").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    lastTestStatus: varchar("lastTestStatus", { length: 40 }),
    lastTestedAt: timestamp("lastTestedAt"),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({ tenantIdx: index("idx_integrations_tenant").on(table.tenantId) })
);
export const deploymentJobs = pgTable(
  "deployment_jobs",
  {
    id: serial("id").primaryKey(),
    installationId: integer("installationId").notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    status: jobStatusEnum("status").default("pending").notNull(),
    externalId: varchar("externalId", { length: 255 }),
    detailsJson: text("detailsJson").default("{}").notNull(),
    error: text("error"),
    startedAt: timestamp("startedAt"),
    finishedAt: timestamp("finishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    installationIdx: index("idx_deployment_jobs_installation").on(
      table.installationId
    ),
  })
);
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenantId"),
    actorUserId: integer("actorUserId"),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    entityId: varchar("entityId", { length: 80 }),
    metadataJson: text("metadataJson").default("{}").notNull(),
    ipAddress: varchar("ipAddress", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    tenantIdx: index("idx_audit_logs_tenant").on(table.tenantId),
    actorIdx: index("idx_audit_logs_actor").on(table.actorUserId),
  })
);

// API Credentials - Armazena tokens e credenciais de APIs externas
export const apiCredentials = pgTable(
  "api_credentials",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    platform: platformEnum("platform").notNull(),
    token: varchar("token", { length: 1024 }).notNull(),
    secretKey: varchar("secretKey", { length: 1024 }),
    phoneNumberId: varchar("phoneNumberId", { length: 255 }),
    businessAccountId: varchar("businessAccountId", { length: 255 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    userIdIdx: index("idx_user_id").on(table.userId),
  })
);

export type ApiCredential = typeof apiCredentials.$inferSelect;
export type InsertApiCredential = typeof apiCredentials.$inferInsert;

// Contacts - Gerencia contatos de diferentes plataformas
export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    externalId: varchar("externalId", { length: 255 }).notNull(),
    platform: platformEnum("platform").notNull(),
    name: varchar("name", { length: 255 }),
    phoneNumber: varchar("phoneNumber", { length: 20 }),
    company: varchar("company", { length: 255 }),
    cnpj: varchar("cnpj", { length: 14 }),
    segment: varchar("segment", { length: 255 }),
    city: varchar("city", { length: 255 }),
    state: varchar("state", { length: 2 }),
    email: varchar("email", { length: 320 }),
    leadStatus: varchar("leadStatus", { length: 50 }),
    leadScore: integer("leadScore"),
    source: varchar("source", { length: 255 }),
    customMessage: text("customMessage"),
    instagramHandle: varchar("instagramHandle", { length: 255 }),
    profilePicture: varchar("profilePicture", { length: 512 }),
    lastInteractionAt: timestamp("lastInteractionAt"),
    status: contactStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    userIdIdx: index("idx_contacts_user_id").on(table.userId),
    userPlatformIdx: index("idx_contacts_user_platform").on(
      table.userId,
      table.platform
    ),
  })
);

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

// Conversations - Agrupa mensagens de um contato
export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    contactId: integer("contactId").notNull(),
    platform: platformEnum("platform").notNull(),
    externalConversationId: varchar("externalConversationId", { length: 255 }),
    subject: varchar("subject", { length: 255 }),
    status: conversationStatusEnum("status").default("open").notNull(),
    unreadCount: integer("unreadCount").default(0).notNull(),
    lastMessageAt: timestamp("lastMessageAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    userIdIdx: index("idx_conversations_user_id").on(table.userId),
    userStatusIdx: index("idx_conversations_user_status").on(
      table.userId,
      table.status
    ),
    userPlatformIdx: index("idx_conversations_user_platform").on(
      table.userId,
      table.platform
    ),
  })
);

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

// Messages - Armazena todas as mensagens
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversationId").notNull(),
    contactId: integer("contactId").notNull(),
    userId: integer("userId").notNull(),
    externalMessageId: varchar("externalMessageId", { length: 255 }),
    platform: platformEnum("platform").notNull(),
    direction: directionEnum("direction").notNull(),
    messageType: messageTypeEnum("messageType").default("text").notNull(),
    content: text("content"),
    mediaUrl: varchar("mediaUrl", { length: 512 }),
    mediaType: varchar("mediaType", { length: 50 }),
    status: messageStatusEnum("status").default("sent").notNull(),
    senderName: varchar("senderName", { length: 255 }),
    senderPhone: varchar("senderPhone", { length: 20 }),
    senderInstagramHandle: varchar("senderInstagramHandle", { length: 255 }),
    llmSuggestion: text("llmSuggestion"),
    automatedResponse: boolean("automatedResponse").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    conversationIdIdx: index("idx_messages_conversation_id").on(
      table.conversationId
    ),
    userCreatedIdx: index("idx_messages_user_created").on(
      table.userId,
      table.createdAt
    ),
  })
);

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// Chatbot Rules - Define regras de automação
export const chatbotRules = pgTable(
  "chatbot_rules",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    triggerKeywords: text("triggerKeywords").notNull(),
    responseTemplate: text("responseTemplate").notNull(),
    platform: platformEnum("platform").default("both").notNull(),
    priority: integer("priority").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    userActiveIdx: index("idx_chatbot_rules_user_active").on(
      table.userId,
      table.isActive
    ),
  })
);

export type ChatbotRule = typeof chatbotRules.$inferSelect;
export type InsertChatbotRule = typeof chatbotRules.$inferInsert;

export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  behaviorGeneral: text("behaviorGeneral"),
  knowledgeGeneral: text("knowledgeGeneral"),
  knowledgeSpecific: text("knowledgeSpecific"),
  pricingKnowledge: text("pricingKnowledge"),
  fallbackMessage: text("fallbackMessage"),
  humanHandoffRules: text("humanHandoffRules"),
  prohibitedTopics: text("prohibitedTopics"),
  businessHours: text("businessHours"),
  audioUnderstandingEnabled: boolean("audioUnderstandingEnabled")
    .default(false)
    .notNull(),
  imageUnderstandingEnabled: boolean("imageUnderstandingEnabled")
    .default(false)
    .notNull(),
  mediaStorageEnabled: boolean("mediaStorageEnabled").default(false).notNull(),
  responseDelayMs: integer("responseDelayMs").default(1500).notNull(),
  maxResponseLength: integer("maxResponseLength").default(600).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const botResources = pgTable(
  "bot_resources",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    resourceType: varchar("resourceType", { length: 40 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }),
    storageKey: varchar("storageKey", { length: 512 }),
    url: varchar("url", { length: 1024 }).notNull(),
    description: text("description"),
    triggerKeywords: text("triggerKeywords"),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ userIdIdx: index("idx_bot_resources_user").on(table.userId) })
);

export type BotSetting = typeof botSettings.$inferSelect;
export type BotResource = typeof botResources.$inferSelect;

// Notification Settings - Configurações de notificação
export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  emailNotificationsEnabled: boolean("emailNotificationsEnabled")
    .default(true)
    .notNull(),
  unreadMessageThreshold: integer("unreadMessageThreshold")
    .default(10)
    .notNull(),
  notifyOnEveryMessage: boolean("notifyOnEveryMessage")
    .default(false)
    .notNull(),
  notifyOnImportantKeywords: text("notifyOnImportantKeywords"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type NotificationSetting = typeof notificationSettings.$inferSelect;
export type InsertNotificationSetting =
  typeof notificationSettings.$inferInsert;

// Notification Logs - Registra notificações enviadas
export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    messageId: integer("messageId"),
    conversationId: integer("conversationId"),
    sentAt: timestamp("sentAt").defaultNow().notNull(),
  },
  table => ({
    userTypeIdx: index("idx_notification_logs_user_type").on(
      table.userId,
      table.type
    ),
  })
);

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = typeof notificationLogs.$inferInsert;

// Campaigns - Gerencia os disparos em massa
export const campaigns = pgTable(
  "campaigns",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    messageTemplate: text("messageTemplate").notNull(),
    platform: platformEnum("platform").default("whatsapp").notNull(),
    status: campaignStatusEnum("status").default("draft").notNull(),
    targetAudience: text("targetAudience"), // JSON list of rules or contact IDs
    totalRecipients: integer("totalRecipients").default(0).notNull(),
    successfulSends: integer("successfulSends").default(0).notNull(),
    failedSends: integer("failedSends").default(0).notNull(),
    scheduledAt: timestamp("scheduledAt"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    userIdIdx: index("idx_campaigns_user_id").on(table.userId),
    statusIdx: index("idx_campaigns_status").on(table.status),
  })
);

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// Support Tickets - Chamados de Suporte
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketCode: varchar("ticketCode", { length: 50 }).notNull().unique(),
  contactId: integer("contactId").notNull(),
  userId: integer("userId").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;

// Tags compartilhadas entre Atendimento, CRM e Funil
export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    color: varchar("color", { length: 20 }).default("#2563eb").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ userIdIdx: index("idx_tags_user_id").on(table.userId) })
);

export const contactTags = pgTable(
  "contact_tags",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    contactId: integer("contactId").notNull(),
    tagId: integer("tagId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    contactIdx: index("idx_contact_tags_contact").on(table.contactId),
    tagIdx: index("idx_contact_tags_tag").on(table.tagId),
  })
);

export const salesPipelines = pgTable(
  "sales_pipelines",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({ userIdIdx: index("idx_sales_pipelines_user").on(table.userId) })
);

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    pipelineId: integer("pipelineId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    color: varchar("color", { length: 20 }).default("#64748b").notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    pipelineIdx: index("idx_pipeline_stages_pipeline").on(table.pipelineId),
  })
);

export const deals = pgTable(
  "deals",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    pipelineId: integer("pipelineId").notNull(),
    stageId: integer("stageId").notNull(),
    contactId: integer("contactId").notNull(),
    conversationId: integer("conversationId"),
    title: varchar("title", { length: 255 }).notNull(),
    value: integer("value").default(0).notNull(),
    position: integer("position").default(0).notNull(),
    status: dealStatusEnum("status").default("open").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    pipelineIdx: index("idx_deals_pipeline").on(table.pipelineId),
    stageIdx: index("idx_deals_stage").on(table.stageId),
    contactIdx: index("idx_deals_contact").on(table.contactId),
  })
);

export type Tag = typeof tags.$inferSelect;
export type SalesPipeline = typeof salesPipelines.$inferSelect;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type Deal = typeof deals.$inferSelect;

// ============================================================================
// RELACIONAMENTOS (Obrigatório para o Dashboard conseguir cruzar dados e exibir)
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  contacts: many(contacts),
  conversations: many(conversations),
  messages: many(messages),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  user: one(users, { fields: [contacts.userId], references: [users.id] }),
  conversations: many(conversations),
  messages: many(messages),
  tickets: many(supportTickets),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    contact: one(contacts, {
      fields: [conversations.contactId],
      references: [contacts.id],
    }),
    messages: many(messages),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  contact: one(contacts, {
    fields: [messages.contactId],
    references: [contacts.id],
  }),
  user: one(users, { fields: [messages.userId], references: [users.id] }),
}));

export const chatbotRulesRelations = relations(chatbotRules, ({ one }) => ({
  user: one(users, { fields: [chatbotRules.userId], references: [users.id] }),
}));

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  user: one(users, { fields: [campaigns.userId], references: [users.id] }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  contact: one(contacts, {
    fields: [supportTickets.contactId],
    references: [contacts.id],
  }),
  user: one(users, { fields: [supportTickets.userId], references: [users.id] }),
}));
