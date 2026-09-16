import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import { dbManager } from '../db/database';
import { mediaManager } from '../media/mediaManager';
import { botManager } from '../telegram/botManager';
import { AppSettings, QuickReply, SendMediaPayload, SendMessagePayload } from '../../types';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Setup broadcast callback
  botManager.setBroadcast((channel, ...args) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args);
    }
  });

  // --- Bot Management ---
  ipcMain.handle('bot:start', async () => {
    return await botManager.start();
  });

  ipcMain.handle('bot:stop', async () => {
    return await botManager.stop();
  });

  ipcMain.handle('bot:get-status', async () => {
    return botManager.getStatus();
  });

  ipcMain.handle('bot:verify-token', async (_event, token: string) => {
    return await botManager.verifyToken(token);
  });

  // --- Chats ---
  ipcMain.handle('chats:get-all', async (_event, search?: string) => {
    return dbManager.getChats(search);
  });

  ipcMain.handle('chats:get-one', async (_event, chatId: number) => {
    return dbManager.getChatById(chatId);
  });

  ipcMain.handle('chats:mark-read', async (_event, chatId: number) => {
    dbManager.markChatRead(chatId);
  });

  ipcMain.handle('chats:delete', async (_event, chatId: number, forEveryone: boolean = false) => {
    return await botManager.deleteEntireChat(chatId, Boolean(forEveryone));
  });

  ipcMain.handle('chats:toggle-pin', async (_event, chatId: number) => {
    return dbManager.togglePinChat(chatId);
  });

  // --- Messages ---
  ipcMain.handle('messages:get-by-chat', async (_event, chatId: number, limit = 100, offset = 0) => {
    return dbManager.getMessagesByChatId(chatId, limit, offset);
  });

  ipcMain.handle('messages:send-text', async (_event, payload: SendMessagePayload) => {
    return await botManager.sendTextMessage(payload.chatId, payload.text, payload.replyToMessageId);
  });

  ipcMain.handle('messages:send-media', async (_event, payload: SendMediaPayload) => {
    return await botManager.sendMediaMessage(
      payload.chatId,
      payload.filePath,
      payload.caption || '',
      payload.mediaType,
      payload.replyToMessageId
    );
  });

  ipcMain.handle(
    'messages:send-clipboard-image',
    async (_event, payload: { chatId: number; buffer: ArrayBuffer; caption?: string }) => {
      const saved = await mediaManager.saveBuffer(Buffer.from(payload.buffer), 'clipboard_photo.png');
      return await botManager.sendMediaMessage(payload.chatId, saved.filePath, payload.caption || '', 'photo');
    }
  );

  ipcMain.handle('messages:resend', async (_event, messageId: number) => {
    return await botManager.resendMessage(messageId);
  });

  ipcMain.handle('messages:delete', async (_event, messageId: number, forEveryone: boolean) => {
    return await botManager.deleteMessage(messageId, forEveryone);
  });

  // --- Settings ---
  ipcMain.handle('settings:get-all', async () => {
    return dbManager.getAllSettings();
  });

  ipcMain.handle('settings:save', async (_event, settings: Partial<AppSettings>) => {
    const saved = dbManager.saveAllSettings(settings);
    // If bot token changed or bot was not running, we could optionally restart
    return saved;
  });

  ipcMain.handle('settings:get-stats', async () => {
    return dbManager.getStats();
  });

  ipcMain.handle('settings:clear-db', async () => {
    dbManager.clearDatabase();
  });

  // --- Quick Replies ---
  ipcMain.handle('quick-replies:get-all', async () => {
    return dbManager.getQuickReplies();
  });

  ipcMain.handle('quick-replies:save', async (_event, reply: Omit<QuickReply, 'id'> & { id?: number }) => {
    return dbManager.saveQuickReply(reply);
  });

  ipcMain.handle('quick-replies:delete', async (_event, id: number) => {
    dbManager.deleteQuickReply(id);
  });

  // --- Dialogs & Utilities ---
  ipcMain.handle('dialog:open-file', async (_event, filterType?: 'images' | 'all') => {
    const filters = [
      { name: 'Tüm Dosyalar (*.*)', extensions: ['*'] },
      { name: 'Görseller (Images)', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'ico'] },
      { name: 'Belgeler & Arşivler', extensions: ['pdf', 'docx', 'xlsx', 'txt', 'zip', 'rar', '7z', 'apk', 'exe'] },
      { name: 'Videolar & Sesler', extensions: ['mp4', 'mkv', 'avi', 'mp3', 'ogg', 'wav'] },
    ];

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters,
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('util:open-external', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('util:reveal-file', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });
}
