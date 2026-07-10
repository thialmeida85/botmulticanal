export interface Contact {
  id: number;
  userId: number;
  externalId: string;
  platform: "whatsapp" | "instagram";
  name: string | null;
  phoneNumber: string | null;
  company?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  leadScore?: number | null;
  instagramHandle: string | null;
  profilePicture: string | null;
  lastInteractionAt: Date | null;
  status: "active" | "inactive" | "blocked";
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id: number;
  userId: number;
  contactId: number;
  platform: "whatsapp" | "instagram";
  externalConversationId: string | null;
  subject: string | null;
  status: "open" | "closed" | "pending";
  unreadCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationWithContact = Conversation & { contact?: Contact };

export interface Message {
  id: number;
  conversationId: number;
  contactId: number;
  userId: number;
  externalMessageId: string | null;
  platform: "whatsapp" | "instagram";
  direction: "inbound" | "outbound";
  messageType: "text" | "image" | "video" | "audio" | "document" | "location";
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  status: "sent" | "delivered" | "read" | "failed";
  senderName: string | null;
  senderPhone: string | null;
  senderInstagramHandle: string | null;
  llmSuggestion: string | null;
  automatedResponse: boolean;
  createdAt: Date;
}

export interface ChatbotRule {
  id: number;
  userId: number;
  name: string;
  triggerKeywords: string;
  responseTemplate: string;
  platform: "whatsapp" | "instagram" | "both";
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationSetting {
  id: number;
  userId: number;
  emailNotificationsEnabled: boolean;
  unreadMessageThreshold: number;
  notifyOnEveryMessage: boolean;
  notifyOnImportantKeywords: string | null;
  createdAt: Date;
  updatedAt: Date;
}
