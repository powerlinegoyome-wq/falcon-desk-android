import { Bot, InputFile } from 'grammy';
import { dbManager } from '../db/database';
import { mediaManager } from '../media/mediaManager';
import { BotInfo, BotStatus, Chat, Message, SenderType } from '../../types';
import fs from 'fs';
import path from 'path';

type BroadcastCallback = (channel: string, ...args: any[]) => void;

class BotManager {
  private bot: Bot | null = null;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private error: string | null = null;
  private botInfo: BotInfo | null = null;
  private broadcast: BroadcastCallback | null = null;

  public setBroadcast(callback: BroadcastCallback): void {
    this.broadcast = callback;
  }

  public getStatus(): BotStatus {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      error: this.error,
      botInfo: this.botInfo,
    };
  }

  private notifyStatus(): void {
    if (this.broadcast) {
      this.broadcast('bot:status-changed', this.getStatus());
    }
  }

  public async verifyToken(token: string): Promise<{ success: boolean; botInfo?: BotInfo; error?: string }> {
    try {
      const tempBot = new Bot(token);
      const me = await tempBot.api.getMe();
      return {
        success: true,
        botInfo: {
          id: me.id,
          username: me.username || '',
          firstName: me.first_name,
          canJoinGroups: me.can_join_groups,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Geçersiz Bot Token veya Telegram API hatası.',
      };
    }
  }

  public async start(tokenToUse?: string): Promise<{ success: boolean; error?: string; botInfo?: BotInfo }> {
    if (this.isConnected) {
      return { success: true, botInfo: this.botInfo || undefined };
    }

    const token = tokenToUse || dbManager.getSetting('botToken');
    if (!token || !token.trim()) {
      this.error = 'Bot Token bulunamadı. Lütfen Ayarlar bölümünden token giriniz.';
      this.notifyStatus();
      return { success: false, error: this.error };
    }

    this.isConnecting = true;
    this.error = null;
    this.notifyStatus();

    try {
      this.bot = new Bot(token);
      const me = await this.bot.api.getMe();
      this.botInfo = {
        id: me.id,
        username: me.username || '',
        firstName: me.first_name,
        canJoinGroups: me.can_join_groups,
      };

      this.setupHandlers();

      // Start long polling runner
      this.bot.start({
        onStart: () => {
          this.isConnected = true;
          this.isConnecting = false;
          this.error = null;
          this.notifyStatus();
          console.log(`Telegram Bot @${me.username} başlatıldı.`);
        },
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Bot polling error:', err);
          this.isConnected = false;
          this.isConnecting = false;
          this.error = err.message || 'Telegram bağlantısı kesildi.';
          this.notifyStatus();
        }
      });

      this.isConnected = true;
      this.isConnecting = false;
      this.notifyStatus();

      return { success: true, botInfo: this.botInfo };
    } catch (err: any) {
      this.isConnected = false;
      this.isConnecting = false;
      this.error = err.message || 'Bot başlatılamadı.';
      this.notifyStatus();
      return { success: false, error: this.error || 'Bilinmeyen hata' };
    }
  }

  public async stop(): Promise<{ success: boolean }> {
    if (this.bot) {
      try {
        await this.bot.stop();
      } catch {}
      this.bot = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.error = null;
    this.notifyStatus();
    return { success: true };
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    // Error handling
    this.bot.catch((err) => {
      console.error('grammY bot error occurred:', err);
    });

    // Check whitelist authorization
    this.bot.use(async (ctx, next) => {
      const from = ctx.from;
      if (from && !this.isUserAllowed(from.id)) {
        console.log(`[Security] Engellenen kullanıcı ID: ${from.id} (@${from.username || 'isimsiz'})`);
        return; // Ignore unauthorized users
      }
      await next();
    });

    // /start command handler
    this.bot.command('start', async (ctx) => {
      try {
        const from = ctx.from;
        if (!from) return;

        // Upsert user chat
        const chat = await this.ensureChat(from);

        // Fetch user avatar in background
        this.fetchUserAvatar(from.id, chat.id).catch(() => {});

        // Save incoming /start message
        const msg = dbManager.insertMessage({
          chatId: chat.id,
          telegramMessageId: ctx.message?.message_id || null,
          senderType: 'user',
          messageType: 'text',
          content: '/start',
          mediaPath: null,
          mediaName: null,
          mediaSize: null,
          mediaMime: null,
          replyToMessageId: null,
          replyToContent: null,
          status: 'sent',
          createdAt: (ctx.message?.date || Math.floor(Date.now() / 1000)) * 1000,
        });

        dbManager.updateChatLastMessage(chat.id, '/start', msg.createdAt, true);
        const updatedChat = dbManager.getChatById(chat.id)!;

        this.broadcast?.('chat:new-message', msg, updatedChat);
        this.broadcast?.('chat:updated', updatedChat);

        // Check if Auto-Reply is enabled
        const autoReplyEnabled = dbManager.getSetting('autoReplyEnabled', 'false') === 'true';
        const autoReplyMessage = dbManager.getSetting('autoReplyMessage', '');

        if (autoReplyEnabled && autoReplyMessage.trim()) {
          // Send automatic greeting
          await this.sendTextMessage(chat.id, autoReplyMessage.trim());
        }
      } catch (err) {
        console.error('Error in /start handler:', err);
      }
    });

    // Text messages
    this.bot.on('message:text', async (ctx) => {
      try {
        if (ctx.message.text.startsWith('/start')) return; // handled above

        const from = ctx.from;
        if (!from) return;

        const chat = await this.ensureChat(from);
        this.fetchUserAvatar(from.id, chat.id).catch(() => {});
        const text = ctx.message.text;

        const replyToMsg = ctx.message.reply_to_message;
        let replyToContent: string | null = null;
        if (replyToMsg) {
          replyToContent = (replyToMsg as any).text || (replyToMsg as any).caption || '[Medya]';
        }

        const msg = dbManager.insertMessage({
          chatId: chat.id,
          telegramMessageId: ctx.message.message_id,
          senderType: 'user',
          messageType: 'text',
          content: text,
          mediaPath: null,
          mediaName: null,
          mediaSize: null,
          mediaMime: null,
          replyToMessageId: replyToMsg?.message_id || null,
          replyToContent,
          status: 'sent',
          createdAt: ctx.message.date * 1000,
        });

        dbManager.updateChatLastMessage(chat.id, text, msg.createdAt, true);
        const updatedChat = dbManager.getChatById(chat.id)!;

        this.broadcast?.('chat:new-message', msg, updatedChat);
        this.broadcast?.('chat:updated', updatedChat);
      } catch (err) {
        console.error('Error in message:text handler:', err);
      }
    });

    // Photo messages
    this.bot.on('message:photo', async (ctx) => {
      try {
        const from = ctx.from;
        if (!from) return;

        const chat = await this.ensureChat(from);
        const photos = ctx.message.photo;
        const bestPhoto = photos[photos.length - 1]; // Highest resolution

        let mediaPath: string | null = null;
        let mediaSize = bestPhoto.file_size || 0;

        try {
          const file = await ctx.getFile();
          if (file.file_path && this.bot) {
            const token = dbManager.getSetting('botToken');
            const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
            const res = await fetch(fileUrl);
            const arrayBuffer = await res.arrayBuffer();
            const saved = await mediaManager.saveBuffer(Buffer.from(arrayBuffer), 'photo.jpg');
            mediaPath = saved.filePath;
            mediaSize = saved.fileSize;
          }
        } catch (downloadErr) {
          console.error('Error downloading photo:', downloadErr);
        }

        const caption = ctx.message.caption || '';
        const msg = dbManager.insertMessage({
          chatId: chat.id,
          telegramMessageId: ctx.message.message_id,
          senderType: 'user',
          messageType: 'photo',
          content: caption,
          mediaPath,
          mediaName: 'photo.jpg',
          mediaSize,
          mediaMime: 'image/jpeg',
          replyToMessageId: ctx.message.reply_to_message?.message_id || null,
          replyToContent: null,
          status: 'sent',
          createdAt: ctx.message.date * 1000,
        });

        const previewText = caption ? `📷 ${caption}` : '📷 Fotoğraf';
        dbManager.updateChatLastMessage(chat.id, previewText, msg.createdAt, true);
        const updatedChat = dbManager.getChatById(chat.id)!;

        this.broadcast?.('chat:new-message', msg, updatedChat);
        this.broadcast?.('chat:updated', updatedChat);
      } catch (err) {
        console.error('Error in message:photo handler:', err);
      }
    });

    // Document messages
    this.bot.on('message:document', async (ctx) => {
      try {
        const from = ctx.from;
        if (!from) return;

        const chat = await this.ensureChat(from);
        const doc = ctx.message.document;

        let mediaPath: string | null = null;
        let mediaSize = doc.file_size || 0;
        const fileName = doc.file_name || 'document';
        const mimeType = doc.mime_type || 'application/octet-stream';

        // Direct download for documents under 20MB
        if (mediaSize < 20 * 1024 * 1024) {
          try {
            const file = await ctx.getFile();
            if (file.file_path && this.bot) {
              const token = dbManager.getSetting('botToken');
              const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
              const res = await fetch(fileUrl);
              const arrayBuffer = await res.arrayBuffer();
              const saved = await mediaManager.saveBuffer(Buffer.from(arrayBuffer), fileName);
              mediaPath = saved.filePath;
              mediaSize = saved.fileSize;
            }
          } catch (downloadErr) {
            console.error('Error downloading document:', downloadErr);
          }
        }

        const caption = ctx.message.caption || '';
        const msg = dbManager.insertMessage({
          chatId: chat.id,
          telegramMessageId: ctx.message.message_id,
          senderType: 'user',
          messageType: 'document',
          content: caption,
          mediaPath,
          mediaName: fileName,
          mediaSize,
          mediaMime: mimeType,
          replyToMessageId: ctx.message.reply_to_message?.message_id || null,
          replyToContent: null,
          status: 'sent',
          createdAt: ctx.message.date * 1000,
        });

        const previewText = `📎 ${fileName}`;
        dbManager.updateChatLastMessage(chat.id, previewText, msg.createdAt, true);
        const updatedChat = dbManager.getChatById(chat.id)!;

        this.broadcast?.('chat:new-message', msg, updatedChat);
        this.broadcast?.('chat:updated', updatedChat);
      } catch (err) {
        console.error('Error in message:document handler:', err);
      }
    });

    // Voice messages
    this.bot.on('message:voice', async (ctx) => {
      try {
        const from = ctx.from;
        if (!from) return;

        const chat = await this.ensureChat(from);
        const voice = ctx.message.voice;
        let mediaPath: string | null = null;
        let mediaSize = voice.file_size || 0;

        try {
          const file = await ctx.getFile();
          if (file.file_path && this.bot) {
            const token = dbManager.getSetting('botToken');
            const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
            const res = await fetch(fileUrl);
            const arrayBuffer = await res.arrayBuffer();
            const saved = await mediaManager.saveBuffer(Buffer.from(arrayBuffer), 'voice.ogg');
            mediaPath = saved.filePath;
            mediaSize = saved.fileSize;
          }
        } catch (downloadErr) {
          console.error('Error downloading voice note:', downloadErr);
        }

        const msg = dbManager.insertMessage({
          chatId: chat.id,
          telegramMessageId: ctx.message.message_id,
          senderType: 'user',
          messageType: 'voice',
          content: `Sesli Mesaj (${voice.duration} sn)`,
          mediaPath,
          mediaName: 'voice.ogg',
          mediaSize,
          mediaMime: voice.mime_type || 'audio/ogg',
          replyToMessageId: ctx.message.reply_to_message?.message_id || null,
          replyToContent: null,
          status: 'sent',
          createdAt: ctx.message.date * 1000,
        });

        dbManager.updateChatLastMessage(chat.id, '🎤 Sesli Mesaj', msg.createdAt, true);
        const updatedChat = dbManager.getChatById(chat.id)!;

        this.broadcast?.('chat:new-message', msg, updatedChat);
        this.broadcast?.('chat:updated', updatedChat);
      } catch (err) {
        console.error('Error in message:voice handler:', err);
      }
    });

    // Stickers
    this.bot.on('message:sticker', async (ctx) => {
      try {
        const from = ctx.from;
        if (!from) return;

        const chat = await this.ensureChat(from);
        const sticker = ctx.message.sticker;

        const msg = dbManager.insertMessage({
          chatId: chat.id,
          telegramMessageId: ctx.message.message_id,
          senderType: 'user',
          messageType: 'sticker',
          content: sticker.emoji ? `Çıkartma ${sticker.emoji}` : 'Çıkartma',
          mediaPath: null,
          mediaName: null,
          mediaSize: sticker.file_size || null,
          mediaMime: null,
          replyToMessageId: ctx.message.reply_to_message?.message_id || null,
          replyToContent: null,
          status: 'sent',
          createdAt: ctx.message.date * 1000,
        });

        dbManager.updateChatLastMessage(chat.id, `🏷️ Çıkartma ${sticker.emoji || ''}`, msg.createdAt, true);
        const updatedChat = dbManager.getChatById(chat.id)!;

        this.broadcast?.('chat:new-message', msg, updatedChat);
        this.broadcast?.('chat:updated', updatedChat);
      } catch (err) {
        console.error('Error in message:sticker handler:', err);
      }
    });
  }

  private isUserAllowed(userId: number): boolean {
    const allowedId = dbManager.getSetting('allowedChatId', '').trim();
    const whitelistEnabled = dbManager.getSetting('whitelistEnabled', 'false') === 'true';

    if (!whitelistEnabled || !allowedId) {
      return true; // No filter configured, allow all
    }

    const allowedList = allowedId.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    return allowedList.includes(String(userId));
  }

  private async ensureChat(from: { id: number; first_name: string; last_name?: string; username?: string }): Promise<Chat> {
    return dbManager.upsertChat({
      telegramUserId: from.id,
      firstName: from.first_name || 'Kullanıcı',
      lastName: from.last_name || null,
      username: from.username || null,
    });
  }

  private async fetchUserAvatar(userId: number, chatId: number): Promise<void> {
    if (!this.bot) return;
    try {
      const photos = await this.bot.api.getUserProfilePhotos(userId, { limit: 1 });
      if (photos.total_count > 0 && photos.photos.length > 0) {
        const photoArray = photos.photos[0];
        const photoFile = photoArray[photoArray.length - 1];
        const file = await this.bot.api.getFile(photoFile.file_id);
        if (file.file_path) {
          const token = dbManager.getSetting('botToken');
          const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
          const res = await fetch(fileUrl);
          const arrayBuffer = await res.arrayBuffer();
          const saved = await mediaManager.saveBuffer(Buffer.from(arrayBuffer), `avatar_${userId}.jpg`);

          dbManager.upsertChat({
            telegramUserId: userId,
            firstName: '', // upsertChat will preserve existing first_name
            avatarPath: saved.filePath,
          });

          const updatedChat = dbManager.getChatById(chatId);
          if (updatedChat) {
            this.broadcast?.('chat:updated', updatedChat);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching user avatar:', err);
    }
  }

  // --- Outgoing Messages ---

  public async sendTextMessage(chatId: number, text: string, replyToMessageId?: number | null): Promise<Message> {
    const chat = dbManager.getChatById(chatId);
    if (!chat) throw new Error('Sohbet bulunamadı.');

    const now = Date.now();

    // Insert optimistic message
    const msg = dbManager.insertMessage({
      chatId,
      telegramMessageId: null,
      senderType: 'operator',
      messageType: 'text',
      content: text,
      mediaPath: null,
      mediaName: null,
      mediaSize: null,
      mediaMime: null,
      replyToMessageId: replyToMessageId || null,
      replyToContent: null,
      status: 'sending',
      createdAt: now,
    });

    dbManager.updateChatLastMessage(chatId, text, now, false);
    const updatedChat = dbManager.getChatById(chatId)!;
    this.broadcast?.('chat:updated', updatedChat);

    if (!this.bot || !this.isConnected) {
      dbManager.updateMessageStatus(msg.id, 'failed');
      const failedMsg = dbManager.getMessageById(msg.id)!;
      throw new Error('Bot bağlı değil. Lütfen botu başlatın.');
    }

    try {
      const extra: any = {};
      if (replyToMessageId) {
        extra.reply_parameters = { message_id: replyToMessageId };
      }

      const tgMsg = await this.bot.api.sendMessage(chat.telegramUserId, text, extra);
      dbManager.updateMessageStatus(msg.id, 'sent', tgMsg.message_id);
      return dbManager.getMessageById(msg.id)!;
    } catch (err: any) {
      console.error('Failed to send text message via Telegram:', err);
      dbManager.updateMessageStatus(msg.id, 'failed');
      throw new Error(err.message || 'Mesaj iletilemedi.');
    }
  }

  public async sendMediaMessage(
    chatId: number,
    sourceFilePath: string,
    caption: string = '',
    mediaType: 'photo' | 'document' = 'photo',
    replyToMessageId?: number | null
  ): Promise<Message> {
    const chat = dbManager.getChatById(chatId);
    if (!chat) throw new Error('Sohbet bulunamadı.');

    const now = Date.now();

    // Copy to internal media storage
    const saved = await mediaManager.copyLocalFile(sourceFilePath);

    // Auto detect image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];
    const ext = path.extname(saved.fileName).toLowerCase();
    const isImage = mediaType === 'photo' || imageExtensions.includes(ext);
    const effectiveType: 'photo' | 'document' = isImage ? 'photo' : 'document';

    const msg = dbManager.insertMessage({
      chatId,
      telegramMessageId: null,
      senderType: 'operator',
      messageType: effectiveType,
      content: caption,
      mediaPath: saved.filePath,
      mediaName: saved.fileName,
      mediaSize: saved.fileSize,
      mediaMime: isImage ? 'image/jpeg' : 'application/octet-stream',
      replyToMessageId: replyToMessageId || null,
      replyToContent: null,
      status: 'sending',
      createdAt: now,
    });

    const preview = effectiveType === 'photo' ? (caption ? `📷 ${caption}` : '📷 Fotoğraf') : `📎 ${saved.fileName}`;
    dbManager.updateChatLastMessage(chatId, preview, now, false);
    const updatedChat = dbManager.getChatById(chatId)!;
    this.broadcast?.('chat:updated', updatedChat);

    if (!this.bot || !this.isConnected) {
      dbManager.updateMessageStatus(msg.id, 'failed');
      throw new Error('Bot bağlı değil. Lütfen botu başlatın.');
    }

    try {
      const extra: any = {};
      if (replyToMessageId) {
        extra.reply_parameters = { message_id: replyToMessageId };
      }
      if (caption) {
        extra.caption = caption;
      }

      let tgMsg: any;
      const inputFile = new InputFile(saved.filePath, saved.fileName);

      if (effectiveType === 'photo') {
        tgMsg = await this.bot.api.sendPhoto(chat.telegramUserId, inputFile, extra);
      } else {
        tgMsg = await this.bot.api.sendDocument(chat.telegramUserId, inputFile, extra);
      }

      dbManager.updateMessageStatus(msg.id, 'sent', tgMsg.message_id);
      return dbManager.getMessageById(msg.id)!;
    } catch (err: any) {
      console.error('Failed to send media via Telegram:', err);
      dbManager.updateMessageStatus(msg.id, 'failed');
      throw new Error(err.message || 'Medya gönderilemedi.');
    }
  }

  public async resendMessage(messageId: number): Promise<Message> {
    const msg = dbManager.getMessageById(messageId);
    if (!msg) throw new Error('Mesaj bulunamadı.');

    if (msg.messageType === 'text') {
      return this.sendTextMessage(msg.chatId, msg.content, msg.replyToMessageId);
    } else if (msg.mediaPath) {
      return this.sendMediaMessage(
        msg.chatId,
        msg.mediaPath,
        msg.content,
        msg.messageType as 'photo' | 'document',
        msg.replyToMessageId
      );
    }
    return msg;
  }

  public async deleteMessage(messageId: number, forEveryone: boolean): Promise<{ success: boolean; error?: string }> {
    const msg = dbManager.getMessageById(messageId);
    if (!msg) return { success: true };

    const chat = dbManager.getChatById(msg.chatId);

    // If deleting for everyone and message has Telegram ID
    if (forEveryone && msg.telegramMessageId && chat && this.bot && this.isConnected) {
      try {
        await this.bot.api.deleteMessage(chat.telegramUserId, msg.telegramMessageId);
      } catch (err: any) {
        console.error('Failed to delete message on Telegram:', err.message);
      }
    }

    // Delete locally from database
    dbManager.deleteMessage(messageId);

    const updatedChat = chat ? dbManager.getChatById(chat.id) : null;
    this.broadcast?.('chat:message-deleted', messageId, msg.chatId);
    if (updatedChat) {
      this.broadcast?.('chat:updated', updatedChat);
    }

    return { success: true };
  }

  public async deleteEntireChat(chatId: number, forEveryone: boolean): Promise<{ success: boolean }> {
    const chat = dbManager.getChatById(chatId);
    if (!chat) return { success: true };

    // If deleting for everyone, revoke all messages from Telegram
    if (forEveryone) {
      const token = dbManager.getSetting('botToken');
      const apiBot = this.bot || (token ? new Bot(token) : null);

      if (apiBot) {
        const messageIds = dbManager.getAllTelegramMessageIdsForChat(chatId);
        console.log(`[Falcon Desk] Revoking ${messageIds.length} messages from Telegram for user ${chat.telegramUserId}...`);

        for (let i = 0; i < messageIds.length; i += 100) {
          const chunk = messageIds.slice(i, i + 100);
          try {
            if (chunk.length === 1) {
              await apiBot.api.deleteMessage(chat.telegramUserId, chunk[0]).catch(() => {});
            } else if (chunk.length > 1) {
              try {
                await apiBot.api.deleteMessages(chat.telegramUserId, chunk);
              } catch {
                // Fallback to individual message deletions
                await Promise.allSettled(
                  chunk.map((msgId) => apiBot.api.deleteMessage(chat.telegramUserId, msgId).catch(() => {}))
                );
              }
            }
          } catch (chunkErr: any) {
            console.error('[Falcon Desk] Error deleting chunk from Telegram:', chunkErr.message);
          }
        }
      }
    }

    // Delete locally from database
    dbManager.deleteChat(chatId);
    this.broadcast?.('chat:deleted', chatId);

    return { success: true };
  }
}

export const botManager = new BotManager();
