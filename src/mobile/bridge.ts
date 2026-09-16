import { mobileDb } from './db';
import { mobileBot } from './bot';
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
  ElectronAPI,
} from '../types';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function setupMobileBridge(): void {
  // Setup event listeners bus
  const eventListeners = new Map<string, Set<Function>>();

  const addListener = (channel: string, callback: Function) => {
    if (!eventListeners.has(channel)) {
      eventListeners.set(channel, new Set());
    }
    eventListeners.get(channel)!.add(callback);
    return () => {
      eventListeners.get(channel)?.delete(callback);
    };
  };

  const emit = (channel: string, ...args: any[]) => {
    const listeners = eventListeners.get(channel);
    if (listeners) {
      listeners.forEach((fn) => {
        try {
          fn(...args);
        } catch (e) {
          console.error(`Error in listener for ${channel}:`, e);
        }
      });
    }
  };

  mobileBot.setBroadcast((channel, ...args) => {
    emit(channel, ...args);
  });

  const api: ElectronAPI = {
    // Bot Management
    botStart: async (): Promise<{ success: boolean; error?: string; botInfo?: BotInfo }> => {
      return await mobileBot.start();
    },
    botStop: async (): Promise<{ success: boolean }> => {
      return await mobileBot.stop();
    },
    botGetStatus: async (): Promise<BotStatus> => {
      return mobileBot.getStatus();
    },
    botVerifyToken: async (token: string): Promise<{ success: boolean; botInfo?: BotInfo; error?: string }> => {
      return await mobileBot.verifyToken(token);
    },

    // Chats
    getChats: async (search?: string): Promise<Chat[]> => {
      return await mobileDb.getChats(search);
    },
    getChat: async (chatId: number): Promise<Chat | null> => {
      return await mobileDb.getChatById(chatId);
    },
    markChatRead: async (chatId: number): Promise<void> => {
      await mobileDb.markChatRead(chatId);
    },
    deleteChat: async (chatId: number, forEveryone: boolean = false): Promise<{ success: boolean }> => {
      return await mobileBot.deleteEntireChat(chatId, forEveryone);
    },
    togglePinChat: async (chatId: number): Promise<boolean> => {
      return await mobileDb.togglePinChat(chatId);
    },

    // Messages
    getMessages: async (chatId: number, limit = 100, offset = 0): Promise<Message[]> => {
      return await mobileDb.getMessagesByChatId(chatId, limit, offset);
    },
    sendText: async (payload: SendMessagePayload): Promise<Message> => {
      return await mobileBot.sendTextMessage(payload.chatId, payload.text, payload.replyToMessageId);
    },
    sendMedia: async (payload: SendMediaPayload): Promise<Message> => {
      return await mobileBot.sendMediaMessage(
        payload.chatId,
        payload.filePath,
        payload.caption || '',
        payload.mediaType,
        payload.replyToMessageId
      );
    },
    sendClipboardImage: async (payload: { chatId: number; buffer: ArrayBuffer; caption?: string }): Promise<Message> => {
      const blob = new Blob([payload.buffer], { type: 'image/png' });
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      return await mobileBot.sendMediaMessage(payload.chatId, dataUrl, payload.caption || '', 'photo');
    },
    resendMessage: async (messageId: number): Promise<Message> => {
      return await mobileBot.resendMessage(messageId);
    },
    deleteMessage: async (messageId: number, forEveryone: boolean): Promise<{ success: boolean; error?: string }> => {
      return await mobileBot.deleteMessage(messageId, forEveryone);
    },

    // Settings
    getSettings: async (): Promise<AppSettings> => {
      return await mobileDb.getAllSettings();
    },
    saveSettings: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
      const saved = await mobileDb.saveAllSettings(settings);
      return saved;
    },
    getDatabaseStats: async (): Promise<DatabaseStats> => {
      return await mobileDb.getStats();
    },
    clearDatabase: async (): Promise<void> => {
      await mobileDb.clearDatabase();
    },

    // Quick Replies
    getQuickReplies: async (): Promise<QuickReply[]> => {
      return await mobileDb.getQuickReplies();
    },
    saveQuickReply: async (reply: Omit<QuickReply, 'id'> & { id?: number }): Promise<QuickReply> => {
      return await mobileDb.saveQuickReply(reply);
    },
    deleteQuickReply: async (id: number): Promise<void> => {
      await mobileDb.deleteQuickReply(id);
    },

    // Dialogs & Utility
    openFileDialog: async (filterType?: 'images' | 'all'): Promise<string | null> => {
      return new Promise<string | null>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = filterType === 'images' ? 'image/*' : '*/*';

        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }
          try {
            const dataUrl = await fileToDataUrl(file);
            resolve(dataUrl);
          } catch {
            resolve(null);
          }
        };

        // Handle user cancelling file picker
        window.addEventListener(
          'focus',
          () => {
            setTimeout(() => {
              if (!input.files || input.files.length === 0) {
                resolve(null);
              }
            }, 1000);
          },
          { once: true }
        );

        input.click();
      });
    },
    openExternal: async (url: string): Promise<void> => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    revealInFolder: async (path: string): Promise<void> => {
      if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) {
        window.open(path, '_blank');
      }
    },

    // Event Subscriptions
    onNewMessage: (callback: (message: Message, chat: Chat) => void): (() => void) => {
      return addListener('chat:new-message', callback);
    },
    onChatUpdated: (callback: (chat: Chat) => void): (() => void) => {
      return addListener('chat:updated', callback);
    },
    onChatDeleted: (callback: (chatId: number) => void): (() => void) => {
      return addListener('chat:deleted', callback);
    },
    onMessageDeleted: (callback: (messageId: number, chatId: number) => void): (() => void) => {
      return addListener('chat:message-deleted', callback);
    },
    onBotStatusChanged: (callback: (status: BotStatus) => void): (() => void) => {
      return addListener('bot:status-changed', callback);
    },
  };

  (window as any).electronAPI = api;
}
