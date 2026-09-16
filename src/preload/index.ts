import { contextBridge, ipcRenderer } from 'electron';
import {
  AppSettings,
  BotInfo,
  BotStatus,
  Chat,
  Message,
  QuickReply,
  SendMediaPayload,
  SendMessagePayload,
  DatabaseStats,
} from '../types';

const electronAPI = {
  // Bot Management
  botStart: (): Promise<{ success: boolean; error?: string; botInfo?: BotInfo }> =>
    ipcRenderer.invoke('bot:start'),
  botStop: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('bot:stop'),
  botGetStatus: (): Promise<BotStatus> =>
    ipcRenderer.invoke('bot:get-status'),
  botVerifyToken: (token: string): Promise<{ success: boolean; botInfo?: BotInfo; error?: string }> =>
    ipcRenderer.invoke('bot:verify-token', token),

  // Chats
  getChats: (search?: string): Promise<Chat[]> =>
    ipcRenderer.invoke('chats:get-all', search),
  getChat: (chatId: number): Promise<Chat | null> =>
    ipcRenderer.invoke('chats:get-one', chatId),
  markChatRead: (chatId: number): Promise<void> =>
    ipcRenderer.invoke('chats:mark-read', chatId),
  deleteChat: (chatId: number, forEveryone?: boolean): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('chats:delete', chatId, Boolean(forEveryone)),
  togglePinChat: (chatId: number): Promise<boolean> =>
    ipcRenderer.invoke('chats:toggle-pin', chatId),

  // Messages
  getMessages: (chatId: number, limit?: number, offset?: number): Promise<Message[]> =>
    ipcRenderer.invoke('messages:get-by-chat', chatId, limit, offset),
  sendText: (payload: SendMessagePayload): Promise<Message> =>
    ipcRenderer.invoke('messages:send-text', payload),
  sendMedia: (payload: SendMediaPayload): Promise<Message> =>
    ipcRenderer.invoke('messages:send-media', payload),
  sendClipboardImage: (payload: { chatId: number; buffer: ArrayBuffer; caption?: string }): Promise<Message> =>
    ipcRenderer.invoke('messages:send-clipboard-image', payload),
  resendMessage: (messageId: number): Promise<Message> =>
    ipcRenderer.invoke('messages:resend', messageId),
  deleteMessage: (messageId: number, forEveryone: boolean): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('messages:delete', messageId, forEveryone),

  // Settings
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:get-all'),
  saveSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:save', settings),
  getDatabaseStats: (): Promise<DatabaseStats> =>
    ipcRenderer.invoke('settings:get-stats'),
  clearDatabase: (): Promise<void> =>
    ipcRenderer.invoke('settings:clear-db'),

  // Quick Replies
  getQuickReplies: (): Promise<QuickReply[]> =>
    ipcRenderer.invoke('quick-replies:get-all'),
  saveQuickReply: (reply: Omit<QuickReply, 'id'> & { id?: number }): Promise<QuickReply> =>
    ipcRenderer.invoke('quick-replies:save', reply),
  deleteQuickReply: (id: number): Promise<void> =>
    ipcRenderer.invoke('quick-replies:delete', id),

  // Dialogs & Utilities
  openFileDialog: (filterType?: 'images' | 'all'): Promise<string | null> =>
    ipcRenderer.invoke('dialog:open-file', filterType),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('util:open-external', url),
  revealInFolder: (path: string): Promise<void> =>
    ipcRenderer.invoke('util:reveal-file', path),

  // Event Subscriptions
  onNewMessage: (callback: (message: Message, chat: Chat) => void): (() => void) => {
    const handler = (_event: any, message: Message, chat: Chat) => callback(message, chat);
    ipcRenderer.on('chat:new-message', handler);
    return () => {
      ipcRenderer.removeListener('chat:new-message', handler);
    };
  },

  onChatUpdated: (callback: (chat: Chat) => void): (() => void) => {
    const handler = (_event: any, chat: Chat) => callback(chat);
    ipcRenderer.on('chat:updated', handler);
    return () => {
      ipcRenderer.removeListener('chat:updated', handler);
    };
  },

  onMessageDeleted: (callback: (messageId: number, chatId: number) => void): (() => void) => {
    const handler = (_event: any, messageId: number, chatId: number) => callback(messageId, chatId);
    ipcRenderer.on('chat:message-deleted', handler);
    return () => {
      ipcRenderer.removeListener('chat:message-deleted', handler);
    };
  },

  onChatDeleted: (callback: (chatId: number) => void): (() => void) => {
    const handler = (_event: any, chatId: number) => callback(chatId);
    ipcRenderer.on('chat:deleted', handler);
    return () => {
      ipcRenderer.removeListener('chat:deleted', handler);
    };
  },

  onBotStatusChanged: (callback: (status: BotStatus) => void): (() => void) => {
    const handler = (_event: any, status: BotStatus) => callback(status);
    ipcRenderer.on('bot:status-changed', handler);
    return () => {
      ipcRenderer.removeListener('bot:status-changed', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
