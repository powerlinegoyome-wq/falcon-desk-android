export type SenderType = 'user' | 'operator' | 'system';
export type MessageType = 'text' | 'photo' | 'document' | 'voice' | 'sticker' | 'video' | 'audio';
export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Chat {
  id: number;
  telegramUserId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  avatarPath: string | null;
  lastMessageText: string | null;
  lastMessageTime: number | null;
  unreadCount: number;
  isArchived: boolean;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: number;
  chatId: number;
  telegramMessageId: number | null;
  senderType: SenderType;
  messageType: MessageType;
  content: string;
  mediaPath: string | null;
  mediaName: string | null;
  mediaSize: number | null;
  mediaMime: string | null;
  replyToMessageId: number | null;
  replyToContent: string | null;
  status: MessageStatus;
  createdAt: number;
}

export interface BotInfo {
  id: number;
  username: string;
  firstName: string;
  canJoinGroups?: boolean;
}

export interface BotStatus {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  botInfo: BotInfo | null;
}

export type SupportedLanguage = 'tr' | 'en' | 'ar' | 'es';

export interface AppSettings {
  botToken: string;
  allowedChatId: string; // Whitelist Telegram User/Chat ID
  whitelistEnabled: boolean;
  autoReplyEnabled: boolean;
  autoReplyMessage: string;
  playSound: boolean;
  desktopNotifications: boolean;
  operatorName: string;
  theme: 'dark' | 'light';
  language: SupportedLanguage;
}

export interface QuickReply {
  id: number;
  shortcut: string;
  title: string;
  text: string;
}

export interface DatabaseStats {
  chatsCount: number;
  messagesCount: number;
  mediaSizeFormatted: string;
  dbPath: string;
}

export interface SendMessagePayload {
  chatId: number;
  text: string;
  replyToMessageId?: number | null;
}

export interface SendMediaPayload {
  chatId: number;
  filePath: string;
  caption?: string;
  mediaType: 'photo' | 'document';
  replyToMessageId?: number | null;
}

export interface ElectronAPI {
  // Bot Management
  botStart: () => Promise<{ success: boolean; error?: string; botInfo?: BotInfo }>;
  botStop: () => Promise<{ success: boolean }>;
  botGetStatus: () => Promise<BotStatus>;
  botVerifyToken: (token: string) => Promise<{ success: boolean; botInfo?: BotInfo; error?: string }>;

  // Chats
  getChats: (search?: string) => Promise<Chat[]>;
  getChat: (chatId: number) => Promise<Chat | null>;
  markChatRead: (chatId: number) => Promise<void>;
  deleteChat: (chatId: number, forEveryone?: boolean) => Promise<{ success: boolean }>;
  togglePinChat: (chatId: number) => Promise<boolean>;

  // Messages
  getMessages: (chatId: number, limit?: number, offset?: number) => Promise<Message[]>;
  sendText: (payload: SendMessagePayload) => Promise<Message>;
  sendMedia: (payload: SendMediaPayload) => Promise<Message>;
  sendClipboardImage: (payload: { chatId: number; buffer: ArrayBuffer; caption?: string }) => Promise<Message>;
  resendMessage: (messageId: number) => Promise<Message>;
  deleteMessage: (messageId: number, forEveryone: boolean) => Promise<{ success: boolean; error?: string }>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  getDatabaseStats: () => Promise<DatabaseStats>;
  clearDatabase: () => Promise<void>;

  // Quick Replies
  getQuickReplies: () => Promise<QuickReply[]>;
  saveQuickReply: (reply: Omit<QuickReply, 'id'> & { id?: number }) => Promise<QuickReply>;
  deleteQuickReply: (id: number) => Promise<void>;

  // Dialogs & Utility
  openFileDialog: (filterType?: 'images' | 'all') => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
  revealInFolder: (path: string) => Promise<void>;

  // Events (Listeners)
  onNewMessage: (callback: (message: Message, chat: Chat) => void) => () => void;
  onChatUpdated: (callback: (chat: Chat) => void) => () => void;
  onChatDeleted: (callback: (chatId: number) => void) => () => void;
  onMessageDeleted: (callback: (messageId: number, chatId: number) => void) => () => void;
  onBotStatusChanged: (callback: (status: BotStatus) => void) => () => void;
}
