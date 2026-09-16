import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { AppSettings, Chat, Message, QuickReply, DatabaseStats } from '../../types';

class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string = '';
  private saveTimeout: NodeJS.Timeout | null = null;

  public async init(customPath?: string): Promise<void> {
    if (this.db) return;

    const SQL = await initSqlJs();

    if (customPath) {
      this.dbPath = customPath;
    } else {
      const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.data');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      this.dbPath = path.join(userDataPath, 'telegram_desk.db');
    }

    if (fs.existsSync(this.dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(fileBuffer);
      } catch (err) {
        console.error('Failed to load existing database file, creating fresh one:', err);
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    this.migrate();
    this.saveToDiskSync();
  }

  private getDb(): Database {
    if (!this.db) {
      throw new Error('Database not initialized. Please call await dbManager.init() first.');
    }
    return this.db;
  }

  public saveToDiskSync(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err) {
      console.error('Error writing database to disk:', err);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveToDiskSync();
      this.saveTimeout = null;
    }, 150);
  }

  private migrate(): void {
    const db = this.getDb();

    // Table: chats
    db.run(`
      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_user_id INTEGER UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT,
        username TEXT,
        avatar_path TEXT,
        last_message_text TEXT,
        last_message_time INTEGER,
        unread_count INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_chats_telegram_user_id ON chats(telegram_user_id);`);

    // Table: messages
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        telegram_message_id INTEGER,
        sender_type TEXT NOT NULL,
        message_type TEXT NOT NULL,
        content TEXT NOT NULL,
        media_path TEXT,
        media_name TEXT,
        media_size INTEGER,
        media_mime TEXT,
        reply_to_message_id INTEGER,
        reply_to_content TEXT,
        status TEXT DEFAULT 'sent',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at ON messages(chat_id, created_at ASC);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_telegram_msg_id ON messages(telegram_message_id);`);

    // Table: settings
    db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Table: quick_replies
    db.run(`
      CREATE TABLE IF NOT EXISTS quick_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shortcut TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        text TEXT NOT NULL
      );
    `);

    // Seed default quick replies if table is empty
    const countRes = db.exec('SELECT COUNT(*) as count FROM quick_replies');
    const count = countRes.length > 0 && countRes[0].values.length > 0 ? (countRes[0].values[0][0] as number) : 0;
    
    if (count === 0) {
      db.run('INSERT INTO quick_replies (shortcut, title, text) VALUES (?, ?, ?)', ['/merhaba', 'Karşılama', 'Merhaba! Size nasıl yardımcı olabilirim?']);
      db.run('INSERT INTO quick_replies (shortcut, title, text) VALUES (?, ?, ?)', ['/fiyat', 'Fiyat Bilgisi', 'Fiyat listemiz ve detaylı teklifimiz için web sitemizi ziyaret edebilir veya talebinizi iletebilirsiniz.']);
      db.run('INSERT INTO quick_replies (shortcut, title, text) VALUES (?, ?, ?)', ['/bekleyin', 'İnceleniyor', 'Mesajınızı aldık, uzman ekibimiz konuyu inceliyor. En kısa sürede dönüş yapacağız.']);
      db.run('INSERT INTO quick_replies (shortcut, title, text) VALUES (?, ?, ?)', ['/tesekkur', 'Teşekkür', 'Bizi tercih ettiğiniz için teşekkür eder, iyi günler dileriz!']);
    }
  }

  // --- Helper to convert sql.js exec result to objects ---
  private execToObjects<T = any>(query: string, params: any[] = []): T[] {
    const db = this.getDb();
    const stmt = db.prepare(query);
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  // --- Chat Operations ---

  public upsertChat(data: {
    telegramUserId: number;
    firstName: string;
    lastName?: string | null;
    username?: string | null;
    avatarPath?: string | null;
  }): Chat {
    const db = this.getDb();
    const now = Date.now();

    const existingRows = this.execToObjects('SELECT * FROM chats WHERE telegram_user_id = ?', [data.telegramUserId]);
    const existing = existingRows.length > 0 ? existingRows[0] : null;

    if (existing) {
      db.run(
        `UPDATE chats 
         SET first_name = ?, last_name = ?, username = ?, avatar_path = COALESCE(?, avatar_path), updated_at = ?
         WHERE id = ?`,
        [
          data.firstName || existing.first_name,
          data.lastName !== undefined ? data.lastName : existing.last_name,
          data.username !== undefined ? data.username : existing.username,
          data.avatarPath || null,
          now,
          existing.id,
        ]
      );
      this.scheduleSave();
      return this.getChatById(existing.id)!;
    } else {
      db.run(
        `INSERT INTO chats (telegram_user_id, first_name, last_name, username, avatar_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.telegramUserId,
          data.firstName,
          data.lastName || null,
          data.username || null,
          data.avatarPath || null,
          now,
          now,
        ]
      );
      this.scheduleSave();
      const lastIdRes = db.exec('SELECT last_insert_rowid() as id');
      const insertedId = lastIdRes[0].values[0][0] as number;
      return this.getChatById(insertedId)!;
    }
  }

  public getChats(search?: string): Chat[] {
    let query = 'SELECT * FROM chats';
    const params: any[] = [];

    if (search && search.trim()) {
      query += ' WHERE first_name LIKE ? OR last_name LIKE ? OR username LIKE ?';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY is_pinned DESC, updated_at DESC';
    const rows = this.execToObjects(query, params);
    return rows.map((r) => this.mapChat(r));
  }

  public getChatById(id: number): Chat | null {
    const rows = this.execToObjects('SELECT * FROM chats WHERE id = ?', [id]);
    return rows.length > 0 ? this.mapChat(rows[0]) : null;
  }

  public getChatByTelegramUserId(telegramUserId: number): Chat | null {
    const rows = this.execToObjects('SELECT * FROM chats WHERE telegram_user_id = ?', [telegramUserId]);
    return rows.length > 0 ? this.mapChat(rows[0]) : null;
  }

  public updateChatLastMessage(chatId: number, lastMessageText: string, time: number, incrementUnread: boolean): void {
    const db = this.getDb();
    if (incrementUnread) {
      db.run(
        `UPDATE chats 
         SET last_message_text = ?, last_message_time = ?, unread_count = unread_count + 1, updated_at = ?
         WHERE id = ?`,
        [lastMessageText, time, time, chatId]
      );
    } else {
      db.run(
        `UPDATE chats 
         SET last_message_text = ?, last_message_time = ?, updated_at = ?
         WHERE id = ?`,
        [lastMessageText, time, time, chatId]
      );
    }
    this.scheduleSave();
  }

  public markChatRead(chatId: number): void {
    const db = this.getDb();
    db.run('UPDATE chats SET unread_count = 0 WHERE id = ?', [chatId]);
    this.scheduleSave();
  }

  public togglePinChat(chatId: number): boolean {
    const db = this.getDb();
    const chat = this.getChatById(chatId);
    if (!chat) return false;
    const newPinned = chat.isPinned ? 0 : 1;
    db.run('UPDATE chats SET is_pinned = ? WHERE id = ?', [newPinned, chatId]);
    this.scheduleSave();
    return newPinned === 1;
  }

  public deleteChat(chatId: number): void {
    const db = this.getDb();
    db.run('DELETE FROM messages WHERE chat_id = ?', [chatId]);
    db.run('DELETE FROM chats WHERE id = ?', [chatId]);
    this.scheduleSave();
  }

  public getAllTelegramMessageIdsForChat(chatId: number): number[] {
    const rows = this.execToObjects(
      'SELECT telegram_message_id FROM messages WHERE chat_id = ? AND telegram_message_id IS NOT NULL',
      [chatId]
    );
    return rows.map((r) => Number(r.telegram_message_id)).filter((id) => Boolean(id) && id > 0);
  }

  // --- Message Operations ---

  public insertMessage(msg: Omit<Message, 'id'>): Message {
    const db = this.getDb();
    db.run(
      `INSERT INTO messages (
        chat_id, telegram_message_id, sender_type, message_type,
        content, media_path, media_name, media_size, media_mime,
        reply_to_message_id, reply_to_content, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msg.chatId,
        msg.telegramMessageId || null,
        msg.senderType,
        msg.messageType,
        msg.content,
        msg.mediaPath || null,
        msg.mediaName || null,
        msg.mediaSize || null,
        msg.mediaMime || null,
        msg.replyToMessageId || null,
        msg.replyToContent || null,
        msg.status,
        msg.createdAt,
      ]
    );

    this.scheduleSave();
    const lastIdRes = db.exec('SELECT last_insert_rowid() as id');
    const insertedId = lastIdRes[0].values[0][0] as number;
    return this.getMessageById(insertedId)!;
  }

  public getMessageById(id: number): Message | null {
    const rows = this.execToObjects('SELECT * FROM messages WHERE id = ?', [id]);
    return rows.length > 0 ? this.mapMessage(rows[0]) : null;
  }

  public getMessagesByChatId(chatId: number, limit = 200, offset = 0): Message[] {
    const rows = this.execToObjects(
      `SELECT * FROM messages 
       WHERE chat_id = ? 
       ORDER BY created_at ASC
       LIMIT ? OFFSET ?`,
      [chatId, limit, offset]
    );
    return rows.map((r) => this.mapMessage(r));
  }

  public updateMessageStatus(id: number, status: 'sending' | 'sent' | 'failed', telegramMessageId?: number): void {
    const db = this.getDb();
    if (telegramMessageId) {
      db.run('UPDATE messages SET status = ?, telegram_message_id = ? WHERE id = ?', [status, telegramMessageId, id]);
    } else {
      db.run('UPDATE messages SET status = ? WHERE id = ?', [status, id]);
    }
    this.scheduleSave();
  }

  public deleteMessage(id: number): { chatId: number } | null {
    const db = this.getDb();
    const msg = this.getMessageById(id);
    if (!msg) return null;

    const chatId = msg.chatId;
    db.run('DELETE FROM messages WHERE id = ?', [id]);

    // Recalculate last message for chat
    const latestRows = this.execToObjects(
      'SELECT content, message_type, media_name, created_at FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1',
      [chatId]
    );

    if (latestRows.length > 0) {
      const latest = latestRows[0];
      let preview = latest.content || '';
      if (latest.message_type === 'photo') preview = preview ? `📷 ${preview}` : '📷 Fotoğraf';
      else if (latest.message_type === 'document') preview = `📎 ${latest.media_name || 'Dosya'}`;
      else if (latest.message_type === 'voice') preview = '🎤 Sesli Mesaj';
      else if (latest.message_type === 'sticker') preview = '🏷️ Çıkartma';

      this.updateChatLastMessage(chatId, preview, latest.created_at, false);
    } else {
      this.updateChatLastMessage(chatId, '', Date.now(), false);
    }

    this.scheduleSave();
    return { chatId };
  }

  // --- Settings Operations ---

  public getSetting(key: string, defaultValue: string = ''): string {
    const rows = this.execToObjects('SELECT value FROM settings WHERE key = ?', [key]);
    return rows.length > 0 ? String(rows[0].value) : defaultValue;
  }

  public setSetting(key: string, value: string): void {
    const db = this.getDb();
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    this.scheduleSave();
  }

  public getAllSettings(): AppSettings {
    return {
      botToken: this.getSetting('botToken', ''),
      allowedChatId: this.getSetting('allowedChatId', ''),
      whitelistEnabled: this.getSetting('whitelistEnabled', 'false') === 'true',
      autoReplyEnabled: this.getSetting('autoReplyEnabled', 'false') === 'true',
      autoReplyMessage: this.getSetting('autoReplyMessage', 'Merhaba! Mesajınız alındı, size en kısa sürede dönüş yapacağız.'),
      playSound: this.getSetting('playSound', 'true') === 'true',
      desktopNotifications: this.getSetting('desktopNotifications', 'true') === 'true',
      operatorName: this.getSetting('operatorName', 'Destek Temsilcisi'),
      theme: (this.getSetting('theme', 'dark') as 'dark' | 'light'),
      language: (this.getSetting('language', 'tr') as 'tr' | 'en' | 'ar' | 'es'),
    };
  }

  public saveAllSettings(settings: Partial<AppSettings>): AppSettings {
    if (settings.botToken !== undefined) this.setSetting('botToken', settings.botToken);
    if (settings.allowedChatId !== undefined) this.setSetting('allowedChatId', settings.allowedChatId);
    if (settings.whitelistEnabled !== undefined) this.setSetting('whitelistEnabled', String(settings.whitelistEnabled));
    if (settings.autoReplyEnabled !== undefined) this.setSetting('autoReplyEnabled', String(settings.autoReplyEnabled));
    if (settings.autoReplyMessage !== undefined) this.setSetting('autoReplyMessage', settings.autoReplyMessage);
    if (settings.playSound !== undefined) this.setSetting('playSound', String(settings.playSound));
    if (settings.desktopNotifications !== undefined) this.setSetting('desktopNotifications', String(settings.desktopNotifications));
    if (settings.operatorName !== undefined) this.setSetting('operatorName', settings.operatorName);
    if (settings.theme !== undefined) this.setSetting('theme', settings.theme);
    if (settings.language !== undefined) this.setSetting('language', settings.language);

    return this.getAllSettings();
  }

  // --- Quick Replies Operations ---

  public getQuickReplies(): QuickReply[] {
    const rows = this.execToObjects('SELECT * FROM quick_replies ORDER BY shortcut ASC');
    return rows.map((r) => ({
      id: r.id,
      shortcut: r.shortcut,
      title: r.title,
      text: r.text,
    }));
  }

  public saveQuickReply(reply: Omit<QuickReply, 'id'> & { id?: number }): QuickReply {
    const db = this.getDb();
    if (reply.id) {
      db.run('UPDATE quick_replies SET shortcut = ?, title = ?, text = ? WHERE id = ?', [
        reply.shortcut,
        reply.title,
        reply.text,
        reply.id,
      ]);
      this.scheduleSave();
      return { id: reply.id, shortcut: reply.shortcut, title: reply.title, text: reply.text };
    } else {
      db.run('INSERT INTO quick_replies (shortcut, title, text) VALUES (?, ?, ?)', [
        reply.shortcut,
        reply.title,
        reply.text,
      ]);
      this.scheduleSave();
      const lastIdRes = db.exec('SELECT last_insert_rowid() as id');
      const insertedId = lastIdRes[0].values[0][0] as number;
      return {
        id: insertedId,
        shortcut: reply.shortcut,
        title: reply.title,
        text: reply.text,
      };
    }
  }

  public deleteQuickReply(id: number): void {
    const db = this.getDb();
    db.run('DELETE FROM quick_replies WHERE id = ?', [id]);
    this.scheduleSave();
  }

  // --- Stats and DB Maintenance ---

  public getStats(): DatabaseStats {
    const db = this.getDb();
    const chatsCountRes = db.exec('SELECT COUNT(*) as count FROM chats');
    const chatsCount = chatsCountRes.length > 0 && chatsCountRes[0].values.length > 0 ? (chatsCountRes[0].values[0][0] as number) : 0;

    const messagesCountRes = db.exec('SELECT COUNT(*) as count FROM messages');
    const messagesCount = messagesCountRes.length > 0 && messagesCountRes[0].values.length > 0 ? (messagesCountRes[0].values[0][0] as number) : 0;

    const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.data');
    const mediaDir = path.join(userDataPath, 'media');
    let totalMediaBytes = 0;

    if (fs.existsSync(mediaDir)) {
      const files = fs.readdirSync(mediaDir);
      for (const file of files) {
        try {
          const stat = fs.statSync(path.join(mediaDir, file));
          totalMediaBytes += stat.size;
        } catch {}
      }
    }

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return {
      chatsCount,
      messagesCount,
      mediaSizeFormatted: formatBytes(totalMediaBytes),
      dbPath: this.dbPath,
    };
  }

  public clearDatabase(): void {
    const db = this.getDb();
    db.run('DELETE FROM messages;');
    db.run('DELETE FROM chats;');
    this.scheduleSave();
  }

  // --- Internal mappers ---

  private mapChat(r: any): Chat {
    return {
      id: Number(r.id),
      telegramUserId: Number(r.telegram_user_id),
      firstName: String(r.first_name || ''),
      lastName: r.last_name ? String(r.last_name) : null,
      username: r.username ? String(r.username) : null,
      avatarPath: r.avatar_path ? String(r.avatar_path) : null,
      lastMessageText: r.last_message_text ? String(r.last_message_text) : null,
      lastMessageTime: r.last_message_time ? Number(r.last_message_time) : null,
      unreadCount: Number(r.unread_count || 0),
      isArchived: Boolean(r.is_archived),
      isPinned: Boolean(r.is_pinned),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    };
  }

  private mapMessage(r: any): Message {
    return {
      id: Number(r.id),
      chatId: Number(r.chat_id),
      telegramMessageId: r.telegram_message_id ? Number(r.telegram_message_id) : null,
      senderType: r.sender_type,
      messageType: r.message_type,
      content: String(r.content || ''),
      mediaPath: r.media_path ? String(r.media_path) : null,
      mediaName: r.media_name ? String(r.media_name) : null,
      mediaSize: r.media_size ? Number(r.media_size) : null,
      mediaMime: r.media_mime ? String(r.media_mime) : null,
      replyToMessageId: r.reply_to_message_id ? Number(r.reply_to_message_id) : null,
      replyToContent: r.reply_to_content ? String(r.reply_to_content) : null,
      status: r.status,
      createdAt: Number(r.created_at),
    };
  }
}

export const dbManager = new DatabaseManager();
