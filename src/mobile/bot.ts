import { mobileDb } from './db';
import { BotInfo, BotStatus, Chat, Message } from '../types';

type BroadcastCallback = (channel: string, ...args: any[]) => void;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

class MobileBotManager {
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private error: string | null = null;
  private botInfo: BotInfo | null = null;
  private broadcast: BroadcastCallback | null = null;
  private activeToken: string = '';
  private pollAbortController: AbortController | null = null;
  private lastUpdateId: number = 0;

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
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();
      if (!data.ok) {
        return {
          success: false,
          error: data.description || 'Geçersiz Bot Token veya Telegram API hatası.',
        };
      }

      return {
        success: true,
        botInfo: {
          id: data.result.id,
          username: data.result.username || '',
          firstName: data.result.first_name,
          canJoinGroups: data.result.can_join_groups,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Telegram sunucusuna bağlanılamadı.',
      };
    }
  }

  public async start(tokenToUse?: string): Promise<{ success: boolean; error?: string; botInfo?: BotInfo }> {
    if (this.isConnected) {
      return { success: true, botInfo: this.botInfo || undefined };
    }

    const token = tokenToUse || (await mobileDb.getSetting('botToken'));
    if (!token || !token.trim()) {
      this.error = 'Bot Token bulunamadı. Lütfen Ayarlar bölümünden token giriniz.';
      this.notifyStatus();
      return { success: false, error: this.error };
    }

    this.isConnecting = true;
    this.error = null;
    this.notifyStatus();

    try {
      const verify = await this.verifyToken(token.trim());
      if (!verify.success || !verify.botInfo) {
        this.isConnected = false;
        this.isConnecting = false;
        this.error = verify.error || 'Token doğrulanamadı';
        this.notifyStatus();
        return { success: false, error: this.error };
      }

      this.activeToken = token.trim();
      this.botInfo = verify.botInfo;
      this.isConnected = true;
      this.isConnecting = false;
      this.notifyStatus();

      // Start Polling loop
      this.startPolling();

      return { success: true, botInfo: this.botInfo };
    } catch (err: any) {
      this.isConnected = false;
      this.isConnecting = false;
      this.error = err.message || 'Bot başlatılamadı.';
      this.notifyStatus();
      return { success: false, error: this.error };
    }
  }

  public async stop(): Promise<{ success: boolean }> {
    if (this.pollAbortController) {
      this.pollAbortController.abort();
      this.pollAbortController = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    this.error = null;
    this.notifyStatus();
    return { success: true };
  }

  private async startPolling(): Promise<void> {
    if (this.pollAbortController) {
      this.pollAbortController.abort();
    }
    this.pollAbortController = new AbortController();

    const signal = this.pollAbortController.signal;

    while (this.isConnected && !signal.aborted) {
      try {
        const offsetParam = this.lastUpdateId > 0 ? `&offset=${this.lastUpdateId + 1}` : '';
        const url = `https://api.telegram.org/bot${this.activeToken}/getUpdates?timeout=25${offsetParam}&allowed_updates=["message"]`;

        const res = await fetch(url, { signal });
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }

        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
            if (update.message) {
              await this.handleIncomingMessage(update.message);
            }
          }
        }
      } catch (err: any) {
        if (signal.aborted) break;
        // Wait before reconnecting on network error
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  private async isUserAllowed(userId: number): Promise<boolean> {
    const allowedId = (await mobileDb.getSetting('allowedChatId', '')).trim();
    const whitelistEnabled = (await mobileDb.getSetting('whitelistEnabled', 'false')) === 'true';

    if (!whitelistEnabled || !allowedId) {
      return true;
    }

    const allowedList = allowedId.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    return allowedList.includes(String(userId));
  }

  private async ensureChat(from: { id: number; first_name: string; last_name?: string; username?: string }): Promise<Chat> {
    return await mobileDb.upsertChat({
      telegramUserId: from.id,
      firstName: from.first_name || 'Kullanıcı',
      lastName: from.last_name || null,
      username: from.username || null,
    });
  }

  private async fetchUserAvatar(userId: number, chatId: number): Promise<void> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.activeToken}/getUserProfilePhotos?user_id=${userId}&limit=1`);
      const data = await res.json();
      if (data.ok && data.result?.total_count > 0 && data.result.photos?.[0]?.length > 0) {
        const photo = data.result.photos[0][data.result.photos[0].length - 1];
        const fileRes = await fetch(`https://api.telegram.org/bot${this.activeToken}/getFile?file_id=${photo.file_id}`);
        const fileData = await fileRes.json();
        if (fileData.ok && fileData.result?.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${this.activeToken}/${fileData.result.file_path}`;
          const imgBlob = await (await fetch(downloadUrl)).blob();
          const avatarDataUrl = await blobToDataUrl(imgBlob);

          await mobileDb.upsertChat({
            telegramUserId: userId,
            firstName: '',
            avatarPath: avatarDataUrl,
          });

          const updatedChat = await mobileDb.getChatById(chatId);
          if (updatedChat) {
            this.broadcast?.('chat:updated', updatedChat);
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching user avatar:', err);
    }
  }

  private async handleIncomingMessage(msg: any): Promise<void> {
    try {
      const from = msg.from;
      if (!from) return;

      if (!(await this.isUserAllowed(from.id))) {
        console.log(`[Security] Engellenen kullanıcı ID: ${from.id}`);
        return;
      }

      const chat = await this.ensureChat(from);
      this.fetchUserAvatar(from.id, chat.id).catch(() => {});

      const replyToMsg = msg.reply_to_message;
      let replyToContent: string | null = null;
      if (replyToMsg) {
        replyToContent = replyToMsg.text || replyToMsg.caption || '[Medya]';
      }

      // Check message type
      if (msg.text) {
        const text = msg.text;
        const isStart = text.startsWith('/start');

        const inserted = await mobileDb.insertMessage({
          chatId: chat.id,
          telegramMessageId: msg.message_id,
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
          createdAt: (msg.date || Math.floor(Date.now() / 1000)) * 1000,
        });

        await mobileDb.updateChatLastMessage(chat.id, text, inserted.createdAt, true);
        const updatedChat = (await mobileDb.getChatById(chat.id))!;

        this.broadcast?.('chat:new-message', inserted, updatedChat);
        this.broadcast?.('chat:updated', updatedChat);

        if (isStart) {
          const autoReplyEnabled = (await mobileDb.getSetting('autoReplyEnabled', 'false')) === 'true';
          const autoReplyMessage = await mobileDb.getSetting('autoReplyMessage', '');
          if (autoReplyEnabled && autoReplyMessage.trim()) {
            await this.sendTextMessage(chat.id, autoReplyMessage.trim());
          }
        }
      } else if (msg.photo) {
        const photos = msg.photo;
        const bestPhoto = photos[photos.length - 1];
        let mediaPath: string | null = null;

        try {
          const fileRes = await fetch(`https://api.telegram.org/bot${this.activeToken}/getFile?file_id=${bestPhoto.file_id}`);
          const fileData = await fileRes.json();
          if (fileData.ok && fileData.result?.file_path) {
            const dlRes = await fetch(`https://api.telegram.org/file/bot${this.activeToken}/${fileData.result.file_path}`);
            const blob = await dlRes.blob();
            mediaPath = await blobToDataUrl(blob);
          }
        } catch (e) {
          console.error('Error downloading incoming photo:', e);
        }

        const caption = msg.caption || '';
        const inserted = await mobileDb.insertMessage({
          chatId: chat.id,
          telegramMessageId: msg.message_id,
          senderType: 'user',
          messageType: 'photo',
          content: caption,
          mediaPath,
          mediaName: 'photo.jpg',
          mediaSize: bestPhoto.file_size || null,
          mediaMime: 'image/jpeg',
          replyToMessageId: replyToMsg?.message_id || null,
          replyToContent: null,
          status: 'sent',
          createdAt: msg.date * 1000,
        });

        const previewText = caption ? `📷 ${caption}` : '📷 Fotoğraf';
        await mobileDb.updateChatLastMessage(chat.id, previewText, inserted.createdAt, true);
        const updatedChat = (await mobileDb.getChatById(chat.id))!;

        this.broadcast?.('chat:new-message', inserted, updatedChat);
        this.broadcast?.('chat:updated', updatedChat);
      } else if (msg.document) {
        const doc = msg.document;
        let mediaPath: string | null = null;
        const fileName = doc.file_name || 'document';

        if (doc.file_size && doc.file_size < 15 * 1024 * 1024) {
          try {
            const fileRes = await fetch(`https://api.telegram.org/bot${this.activeToken}/getFile?file_id=${doc.file_id}`);
            const fileData = await fileRes.json();
            if (fileData.ok && fileData.result?.file_path) {
              const dlRes = await fetch(`https://api.telegram.org/file/bot${this.activeToken}/${fileData.result.file_path}`);
              const blob = await dlRes.blob();
              mediaPath = await blobToDataUrl(blob);
            }
          } catch (e) {
            console.error('Error downloading document:', e);
          }
        }

        const caption = msg.caption || '';
        const inserted = await mobileDb.insertMessage({
          chatId: chat.id,
          telegramMessageId: msg.message_id,
          senderType: 'user',
          messageType: 'document',
          content: caption,
          mediaPath,
          mediaName: fileName,
          mediaSize: doc.file_size || null,
          mediaMime: doc.mime_type || 'application/octet-stream',
          replyToMessageId: replyToMsg?.message_id || null,
          replyToContent: null,
          status: 'sent',
          createdAt: msg.date * 1000,
        });

        const previewText = `📎 ${fileName}`;
        await mobileDb.updateChatLastMessage(chat.id, previewText, inserted.createdAt, true);
        const updatedChat = (await mobileDb.getChatById(chat.id))!;

        this.broadcast?.('chat:new-message', inserted, updatedChat);
        this.broadcast?.('chat:updated', updatedChat);
      } else if (msg.voice) {
        const voice = msg.voice;
        const inserted = await mobileDb.insertMessage({
          chatId: chat.id,
          telegramMessageId: msg.message_id,
          senderType: 'user',
          messageType: 'voice',
          content: `Sesli Mesaj (${voice.duration} sn)`,
          mediaPath: null,
          mediaName: 'voice.ogg',
          mediaSize: voice.file_size || null,
          mediaMime: voice.mime_type || 'audio/ogg',
          replyToMessageId: replyToMsg?.message_id || null,
          replyToContent: null,
          status: 'sent',
          createdAt: msg.date * 1000,
        });

        await mobileDb.updateChatLastMessage(chat.id, '🎤 Sesli Mesaj', inserted.createdAt, true);
        const updatedChat = (await mobileDb.getChatById(chat.id))!;

        this.broadcast?.('chat:new-message', inserted, updatedChat);
        this.broadcast?.('chat:updated', updatedChat);
      } else if (msg.sticker) {
        const sticker = msg.sticker;
        const inserted = await mobileDb.insertMessage({
          chatId: chat.id,
          telegramMessageId: msg.message_id,
          senderType: 'user',
          messageType: 'sticker',
          content: sticker.emoji ? `Çıkartma ${sticker.emoji}` : 'Çıkartma',
          mediaPath: null,
          mediaName: null,
          mediaSize: sticker.file_size || null,
          mediaMime: null,
          replyToMessageId: replyToMsg?.message_id || null,
          replyToContent: null,
          status: 'sent',
          createdAt: msg.date * 1000,
        });

        await mobileDb.updateChatLastMessage(chat.id, `🏷️ Çıkartma ${sticker.emoji || ''}`, inserted.createdAt, true);
        const updatedChat = (await mobileDb.getChatById(chat.id))!;

        this.broadcast?.('chat:new-message', inserted, updatedChat);
        this.broadcast?.('chat:updated', updatedChat);
      }
    } catch (err) {
      console.error('Error handling incoming update:', err);
    }
  }

  // --- Outgoing Messages ---

  public async sendTextMessage(chatId: number, text: string, replyToMessageId?: number | null): Promise<Message> {
    const chat = await mobileDb.getChatById(chatId);
    if (!chat) throw new Error('Sohbet bulunamadı.');

    const now = Date.now();
    const inserted = await mobileDb.insertMessage({
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

    await mobileDb.updateChatLastMessage(chatId, text, now, false);
    const updatedChat = (await mobileDb.getChatById(chatId))!;
    this.broadcast?.('chat:updated', updatedChat);

    if (!this.isConnected || !this.activeToken) {
      await mobileDb.updateMessageStatus(inserted.id, 'failed');
      throw new Error('Bot bağlı değil. Lütfen botu başlatın.');
    }

    try {
      const payload: any = {
        chat_id: chat.telegramUserId,
        text,
      };
      if (replyToMessageId) {
        payload.reply_parameters = { message_id: replyToMessageId };
      }

      const res = await fetch(`https://api.telegram.org/bot${this.activeToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.description || 'Mesaj gönderilemedi.');
      }

      await mobileDb.updateMessageStatus(inserted.id, 'sent', data.result.message_id);
      return (await mobileDb.getMessageById(inserted.id))!;
    } catch (err: any) {
      console.error('Failed to send text message:', err);
      await mobileDb.updateMessageStatus(inserted.id, 'failed');
      throw err;
    }
  }

  public async sendMediaMessage(
    chatId: number,
    filePathOrDataUrl: string,
    caption: string = '',
    mediaType: 'photo' | 'document' = 'photo',
    replyToMessageId?: number | null
  ): Promise<Message> {
    const chat = await mobileDb.getChatById(chatId);
    if (!chat) throw new Error('Sohbet bulunamadı.');

    const now = Date.now();
    const isImage = mediaType === 'photo' || filePathOrDataUrl.startsWith('data:image/');
    const effectiveType = isImage ? 'photo' : 'document';
    const fileName = effectiveType === 'photo' ? 'photo.jpg' : 'file';

    const inserted = await mobileDb.insertMessage({
      chatId,
      telegramMessageId: null,
      senderType: 'operator',
      messageType: effectiveType,
      content: caption,
      mediaPath: filePathOrDataUrl,
      mediaName: fileName,
      mediaSize: null,
      mediaMime: isImage ? 'image/jpeg' : 'application/octet-stream',
      replyToMessageId: replyToMessageId || null,
      replyToContent: null,
      status: 'sending',
      createdAt: now,
    });

    const preview = effectiveType === 'photo' ? (caption ? `📷 ${caption}` : '📷 Fotoğraf') : `📎 ${fileName}`;
    await mobileDb.updateChatLastMessage(chatId, preview, now, false);
    const updatedChat = (await mobileDb.getChatById(chatId))!;
    this.broadcast?.('chat:updated', updatedChat);

    if (!this.isConnected || !this.activeToken) {
      await mobileDb.updateMessageStatus(inserted.id, 'failed');
      throw new Error('Bot bağlı değil. Lütfen botu başlatın.');
    }

    try {
      const blob = filePathOrDataUrl.startsWith('data:')
        ? dataUrlToBlob(filePathOrDataUrl)
        : await (await fetch(filePathOrDataUrl)).blob();

      const formData = new FormData();
      formData.append('chat_id', String(chat.telegramUserId));
      if (caption) formData.append('caption', caption);
      if (replyToMessageId) {
        formData.append('reply_parameters', JSON.stringify({ message_id: replyToMessageId }));
      }

      const endpoint = effectiveType === 'photo' ? 'sendPhoto' : 'sendDocument';
      formData.append(effectiveType === 'photo' ? 'photo' : 'document', blob, fileName);

      const res = await fetch(`https://api.telegram.org/bot${this.activeToken}/${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.description || 'Medya gönderilemedi.');
      }

      await mobileDb.updateMessageStatus(inserted.id, 'sent', data.result.message_id);
      return (await mobileDb.getMessageById(inserted.id))!;
    } catch (err: any) {
      console.error('Failed to send media:', err);
      await mobileDb.updateMessageStatus(inserted.id, 'failed');
      throw err;
    }
  }

  public async resendMessage(messageId: number): Promise<Message> {
    const msg = await mobileDb.getMessageById(messageId);
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
    const msg = await mobileDb.getMessageById(messageId);
    if (!msg) return { success: true };

    const chat = await mobileDb.getChatById(msg.chatId);

    if (forEveryone && msg.telegramMessageId && chat && this.isConnected) {
      try {
        await fetch(`https://api.telegram.org/bot${this.activeToken}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat.telegramUserId,
            message_id: msg.telegramMessageId,
          }),
        });
      } catch (err: any) {
        console.error('Failed to delete message on Telegram:', err);
      }
    }

    await mobileDb.deleteMessage(messageId);
    const updatedChat = chat ? await mobileDb.getChatById(chat.id) : null;
    this.broadcast?.('chat:message-deleted', messageId, msg.chatId);
    if (updatedChat) {
      this.broadcast?.('chat:updated', updatedChat);
    }

    return { success: true };
  }

  public async deleteEntireChat(chatId: number, forEveryone: boolean): Promise<{ success: boolean }> {
    const chat = await mobileDb.getChatById(chatId);
    if (!chat) return { success: true };

    if (forEveryone && this.isConnected) {
      const messageIds = await mobileDb.getAllTelegramMessageIdsForChat(chatId);
      for (let i = 0; i < messageIds.length; i += 100) {
        const chunk = messageIds.slice(i, i + 100);
        try {
          if (chunk.length === 1) {
            await fetch(`https://api.telegram.org/bot${this.activeToken}/deleteMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chat.telegramUserId, message_id: chunk[0] }),
            });
          } else if (chunk.length > 1) {
            await fetch(`https://api.telegram.org/bot${this.activeToken}/deleteMessages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: chat.telegramUserId, message_ids: chunk }),
            });
          }
        } catch (e) {
          console.error('Error deleting chunk from Telegram:', e);
        }
      }
    }

    await mobileDb.deleteChat(chatId);
    this.broadcast?.('chat:deleted', chatId);
    return { success: true };
  }
}

export const mobileBot = new MobileBotManager();
