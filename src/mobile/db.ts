import { AppSettings, Chat, Message, QuickReply, DatabaseStats } from '../types';

const DB_NAME = 'FalconDeskDB';
const DB_VERSION = 1;

class MobileDatabaseManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Chats store
        if (!db.objectStoreNames.contains('chats')) {
          const chatStore = db.createObjectStore('chats', { keyPath: 'id', autoIncrement: true });
          chatStore.createIndex('telegramUserId', 'telegramUserId', { unique: true });
          chatStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          chatStore.createIndex('isPinned', 'isPinned', { unique: false });
        }

        // Messages store
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
          msgStore.createIndex('chatId', 'chatId', { unique: false });
          msgStore.createIndex('createdAt', 'createdAt', { unique: false });
          msgStore.createIndex('telegramMessageId', 'telegramMessageId', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Quick replies store
        if (!db.objectStoreNames.contains('quickReplies')) {
          const qrStore = db.createObjectStore('quickReplies', { keyPath: 'id', autoIncrement: true });
          qrStore.createIndex('shortcut', 'shortcut', { unique: true });
        }
      };

      request.onsuccess = async () => {
        this.db = request.result;
        await this.seedDefaultQuickReplies();
        resolve();
      };

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };
    });

    return this.initPromise;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  private async seedDefaultQuickReplies(): Promise<void> {
    const list = await this.getQuickReplies();
    if (list.length === 0) {
      await this.saveQuickReply({
        shortcut: '/merhaba',
        title: 'Karşılama',
        text: 'Merhaba! Size nasıl yardımcı olabilirim?',
      });
      await this.saveQuickReply({
        shortcut: '/fiyat',
        title: 'Fiyat Bilgisi',
        text: 'Fiyat listemiz ve detaylı teklifimiz için web sitemizi ziyaret edebilir veya talebinizi iletebilirsiniz.',
      });
      await this.saveQuickReply({
        shortcut: '/bekleyin',
        title: 'İnceleniyor',
        text: 'Mesajınızı aldık, uzman ekibimiz konuyu inceliyor. En kısa sürede dönüş yapacağız.',
      });
      await this.saveQuickReply({
        shortcut: '/tesekkur',
        title: 'Teşekkür',
        text: 'Bizi tercih ettiğiniz için teşekkür eder, iyi günler dileriz!',
      });
    }
  }

  // --- Chat Operations ---

  public async upsertChat(data: {
    telegramUserId: number;
    firstName: string;
    lastName?: string | null;
    username?: string | null;
    avatarPath?: string | null;
  }): Promise<Chat> {
    const db = await this.getDB();
    const existing = await this.getChatByTelegramUserId(data.telegramUserId);
    const now = Date.now();

    return new Promise<Chat>((resolve, reject) => {
      const tx = db.transaction('chats', 'readwrite');
      const store = tx.objectStore('chats');

      if (existing) {
        const updated: Chat = {
          ...existing,
          firstName: data.firstName || existing.firstName,
          lastName: data.lastName !== undefined ? data.lastName : existing.lastName,
          username: data.username !== undefined ? data.username : existing.username,
          avatarPath: data.avatarPath || existing.avatarPath,
          updatedAt: now,
        };
        const req = store.put(updated);
        req.onsuccess = () => resolve(updated);
        req.onerror = () => reject(req.error);
      } else {
        const newChat: Omit<Chat, 'id'> = {
          telegramUserId: data.telegramUserId,
          firstName: data.firstName || 'Kullanıcı',
          lastName: data.lastName || null,
          username: data.username || null,
          avatarPath: data.avatarPath || null,
          lastMessageText: null,
          lastMessageTime: null,
          unreadCount: 0,
          isArchived: false,
          isPinned: false,
          createdAt: now,
          updatedAt: now,
        };
        const req = store.add(newChat);
        req.onsuccess = () => {
          resolve({ ...(newChat as any), id: req.result as number });
        };
        req.onerror = () => reject(req.error);
      }
    });
  }

  public async getChats(search?: string): Promise<Chat[]> {
    const db = await this.getDB();
    return new Promise<Chat[]>((resolve, reject) => {
      const tx = db.transaction('chats', 'readonly');
      const store = tx.objectStore('chats');
      const req = store.getAll();

      req.onsuccess = () => {
        let list: Chat[] = req.result || [];
        if (search && search.trim()) {
          const s = search.trim().toLowerCase();
          list = list.filter((c) =>
            (c.firstName && c.firstName.toLowerCase().includes(s)) ||
            (c.lastName && c.lastName.toLowerCase().includes(s)) ||
            (c.username && c.username.toLowerCase().includes(s))
          );
        }
        // Sort: pinned first, then updatedAt descending
        list.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async getChatById(id: number): Promise<Chat | null> {
    const db = await this.getDB();
    return new Promise<Chat | null>((resolve, reject) => {
      const tx = db.transaction('chats', 'readonly');
      const store = tx.objectStore('chats');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async getChatByTelegramUserId(telegramUserId: number): Promise<Chat | null> {
    const db = await this.getDB();
    return new Promise<Chat | null>((resolve, reject) => {
      const tx = db.transaction('chats', 'readonly');
      const store = tx.objectStore('chats');
      const index = store.index('telegramUserId');
      const req = index.get(telegramUserId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async updateChatLastMessage(
    chatId: number,
    lastMessageText: string,
    time: number,
    incrementUnread: boolean
  ): Promise<void> {
    const chat = await this.getChatById(chatId);
    if (!chat) return;

    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('chats', 'readwrite');
      const store = tx.objectStore('chats');
      const updated: Chat = {
        ...chat,
        lastMessageText,
        lastMessageTime: time,
        unreadCount: incrementUnread ? chat.unreadCount + 1 : chat.unreadCount,
        updatedAt: time,
      };
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async markChatRead(chatId: number): Promise<void> {
    const chat = await this.getChatById(chatId);
    if (!chat) return;

    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('chats', 'readwrite');
      const store = tx.objectStore('chats');
      const updated: Chat = {
        ...chat,
        unreadCount: 0,
      };
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async togglePinChat(chatId: number): Promise<boolean> {
    const chat = await this.getChatById(chatId);
    if (!chat) return false;

    const db = await this.getDB();
    const newPinned = !chat.isPinned;
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction('chats', 'readwrite');
      const store = tx.objectStore('chats');
      const updated: Chat = {
        ...chat,
        isPinned: newPinned,
      };
      const req = store.put(updated);
      req.onsuccess = () => resolve(newPinned);
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteChat(chatId: number): Promise<void> {
    const db = await this.getDB();
    // Delete messages
    const msgs = await this.getMessagesByChatId(chatId, 10000, 0);
    const tx = db.transaction(['chats', 'messages'], 'readwrite');
    const msgStore = tx.objectStore('messages');
    for (const m of msgs) {
      msgStore.delete(m.id);
    }
    const chatStore = tx.objectStore('chats');
    chatStore.delete(chatId);

    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getAllTelegramMessageIdsForChat(chatId: number): Promise<number[]> {
    const msgs = await this.getMessagesByChatId(chatId, 10000, 0);
    return msgs
      .map((m) => m.telegramMessageId)
      .filter((id): id is number => Boolean(id) && id > 0);
  }

  // --- Message Operations ---

  public async insertMessage(msg: Omit<Message, 'id'>): Promise<Message> {
    const db = await this.getDB();
    return new Promise<Message>((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const req = store.add(msg);
      req.onsuccess = () => {
        resolve({
          ...msg,
          id: req.result as number,
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async getMessageById(id: number): Promise<Message | null> {
    const db = await this.getDB();
    return new Promise<Message | null>((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async getMessagesByChatId(chatId: number, limit = 200, offset = 0): Promise<Message[]> {
    const db = await this.getDB();
    return new Promise<Message[]>((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const index = store.index('chatId');
      const req = index.getAll(chatId);

      req.onsuccess = () => {
        let list: Message[] = req.result || [];
        list.sort((a, b) => a.createdAt - b.createdAt);
        if (offset > 0) {
          list = list.slice(offset);
        }
        if (limit > 0) {
          list = list.slice(0, limit);
        }
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async updateMessageStatus(
    id: number,
    status: 'sending' | 'sent' | 'failed',
    telegramMessageId?: number
  ): Promise<void> {
    const msg = await this.getMessageById(id);
    if (!msg) return;

    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const updated: Message = {
        ...msg,
        status,
        telegramMessageId: telegramMessageId !== undefined ? telegramMessageId : msg.telegramMessageId,
      };
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteMessage(id: number): Promise<{ chatId: number } | null> {
    const msg = await this.getMessageById(id);
    if (!msg) return null;

    const chatId = msg.chatId;
    const db = await this.getDB();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Recalculate chat last message
    const remaining = await this.getMessagesByChatId(chatId, 1, 0);
    if (remaining.length > 0) {
      const latest = remaining[remaining.length - 1];
      let preview = latest.content || '';
      if (latest.messageType === 'photo') preview = preview ? `📷 ${preview}` : '📷 Fotoğraf';
      else if (latest.messageType === 'document') preview = `📎 ${latest.mediaName || 'Dosya'}`;
      else if (latest.messageType === 'voice') preview = '🎤 Sesli Mesaj';
      else if (latest.messageType === 'sticker') preview = '🏷️ Çıkartma';

      await this.updateChatLastMessage(chatId, preview, latest.createdAt, false);
    } else {
      await this.updateChatLastMessage(chatId, '', Date.now(), false);
    }

    return { chatId };
  }

  // --- Settings Operations ---

  public async getSetting(key: string, defaultValue = ''): Promise<string> {
    const db = await this.getDB();
    return new Promise<string>((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(req.result ? String(req.result.value) : defaultValue);
      };
      req.onerror = () => resolve(defaultValue);
    });
  }

  public async setSetting(key: string, value: string): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getAllSettings(): Promise<AppSettings> {
    const [
      botToken,
      allowedChatId,
      whitelistEnabled,
      autoReplyEnabled,
      autoReplyMessage,
      playSound,
      desktopNotifications,
      operatorName,
      theme,
      language,
    ] = await Promise.all([
      this.getSetting('botToken', ''),
      this.getSetting('allowedChatId', ''),
      this.getSetting('whitelistEnabled', 'false'),
      this.getSetting('autoReplyEnabled', 'false'),
      this.getSetting('autoReplyMessage', 'Merhaba! Mesajınız alındı, size en kısa sürede dönüş yapacağız.'),
      this.getSetting('playSound', 'true'),
      this.getSetting('desktopNotifications', 'true'),
      this.getSetting('operatorName', 'Destek Temsilcisi'),
      this.getSetting('theme', 'dark'),
      this.getSetting('language', 'tr'),
    ]);

    return {
      botToken,
      allowedChatId,
      whitelistEnabled: whitelistEnabled === 'true',
      autoReplyEnabled: autoReplyEnabled === 'true',
      autoReplyMessage,
      playSound: playSound === 'true',
      desktopNotifications: desktopNotifications === 'true',
      operatorName,
      theme: theme as 'dark' | 'light',
      language: language as 'tr' | 'en' | 'ar' | 'es',
    };
  }

  public async saveAllSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const entries = Object.entries(settings);
    for (const [k, v] of entries) {
      if (v !== undefined) {
        await this.setSetting(k, String(v));
      }
    }
    return this.getAllSettings();
  }

  // --- Quick Replies Operations ---

  public async getQuickReplies(): Promise<QuickReply[]> {
    const db = await this.getDB();
    return new Promise<QuickReply[]>((resolve, reject) => {
      const tx = db.transaction('quickReplies', 'readonly');
      const store = tx.objectStore('quickReplies');
      const req = store.getAll();
      req.onsuccess = () => {
        const list: QuickReply[] = req.result || [];
        list.sort((a, b) => a.shortcut.localeCompare(b.shortcut));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async saveQuickReply(reply: Omit<QuickReply, 'id'> & { id?: number }): Promise<QuickReply> {
    const db = await this.getDB();
    return new Promise<QuickReply>((resolve, reject) => {
      const tx = db.transaction('quickReplies', 'readwrite');
      const store = tx.objectStore('quickReplies');
      if (reply.id) {
        const req = store.put(reply);
        req.onsuccess = () => resolve(reply as QuickReply);
        req.onerror = () => reject(req.error);
      } else {
        const req = store.add(reply);
        req.onsuccess = () => {
          resolve({ ...(reply as any), id: req.result as number });
        };
        req.onerror = () => reject(req.error);
      }
    });
  }

  public async deleteQuickReply(id: number): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('quickReplies', 'readwrite');
      const store = tx.objectStore('quickReplies');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Stats and DB Maintenance ---

  public async getStats(): Promise<DatabaseStats> {
    const db = await this.getDB();
    const chats = await this.getChats();

    const countMessages = await new Promise<number>((resolve) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });

    return {
      chatsCount: chats.length,
      messagesCount: countMessages,
      mediaSizeFormatted: 'IndexedDB (Dinamik)',
      dbPath: 'IndexedDB://FalconDeskDB',
    };
  }

  public async clearDatabase(): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['chats', 'messages'], 'readwrite');
      tx.objectStore('chats').clear();
      tx.objectStore('messages').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const mobileDb = new MobileDatabaseManager();
