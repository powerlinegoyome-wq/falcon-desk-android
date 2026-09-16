import { create } from 'zustand';
import { AppSettings, BotStatus, Chat, Message, QuickReply, SupportedLanguage } from '../../types';
import { initNotifications, showIncomingMessageNotification } from '../utils/notification';

interface ChatStore {
  // State
  chats: Chat[];
  activeChatId: number | null;
  messages: Record<number, Message[]>;
  botStatus: BotStatus;
  settings: AppSettings;
  quickReplies: QuickReply[];
  searchQuery: string;
  replyingToMessage: Message | null;
  lightboxMedia: { url: string; title: string; originalPath?: string } | null;
  isSettingsOpen: boolean;
  isLoadingMessages: boolean;

  // Actions
  init: () => Promise<void>;
  fetchChats: (search?: string) => Promise<void>;
  selectChat: (chatId: number) => Promise<void>;
  loadMessages: (chatId: number) => Promise<void>;
  sendTextMessage: (text: string) => Promise<void>;
  sendMediaMessage: (filePath: string, caption?: string, mediaType?: 'photo' | 'document') => Promise<void>;
  sendClipboardImage: (buffer: ArrayBuffer, caption?: string) => Promise<void>;
  resendMessage: (messageId: number) => Promise<void>;
  deleteMessage: (messageId: number, forEveryone: boolean) => Promise<void>;
  deleteChat: (chatId: number, forEveryone?: boolean) => Promise<void>;
  togglePinChat: (chatId: number) => Promise<void>;
  startBot: () => Promise<{ success: boolean; error?: string }>;
  stopBot: () => Promise<void>;
  setTheme: (theme: 'dark' | 'light') => Promise<void>;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<void>;
  saveQuickReply: (reply: Omit<QuickReply, 'id'> & { id?: number }) => Promise<void>;
  deleteQuickReply: (id: number) => Promise<void>;
  setReplyingTo: (message: Message | null) => void;
  setLightboxMedia: (media: { url: string; title: string; originalPath?: string } | null) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
  isUploadingMedia: boolean;
  uploadingStatusText: string;
  setIsUploadingMedia: (isUploading: boolean, text?: string) => void;
  
  // Real-time Event Handlers
  handleIncomingMessage: (message: Message, chat: Chat) => void;
  handleChatUpdated: (chat: Chat) => void;
  handleChatDeleted: (chatId: number) => void;
  handleMessageDeleted: (messageId: number, chatId: number) => void;
  handleBotStatusChanged: (status: BotStatus) => void;
}

// Realistic Falcon Cry / Screech Sound Synthesizer via Web Audio API
export const playFalconCry = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const t = audioCtx.currentTime;

    // 1. Primary Falcon Screech Carrier Oscillator (Sawtooth harmonic body)
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';

    // Falcon frequency arc: sharp upward swoop to piercing high then downward tail
    osc.frequency.setValueAtTime(2100, t);
    osc.frequency.exponentialRampToValueAtTime(3900, t + 0.09);
    osc.frequency.linearRampToValueAtTime(3100, t + 0.24);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.46);

    // 2. Screech Vibrato / Avian Flutter FM Modulator
    const mod = audioCtx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(60, t);
    mod.frequency.linearRampToValueAtTime(25, t + 0.46);

    const modGain = audioCtx.createGain();
    modGain.gain.setValueAtTime(500, t);
    modGain.gain.exponentialRampToValueAtTime(40, t + 0.46);
    mod.connect(osc.frequency);

    // 3. Dual Formant Bandpass Filters for organic avian acoustic chamber
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3300, t);
    filter.frequency.exponentialRampToValueAtTime(2300, t + 0.46);
    filter.Q.setValueAtTime(3.2, t);

    // 4. White noise wind/air hiss layer for falcon breath realism
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.46);
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(3500, t);
    noiseFilter.Q.setValueAtTime(3.8, t);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.09, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.44);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);

    // 5. Master Gain Envelope
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.01, t);
    masterGain.gain.linearRampToValueAtTime(0.3, t + 0.07);
    masterGain.gain.linearRampToValueAtTime(0.24, t + 0.22);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.49);

    osc.connect(filter);
    filter.connect(masterGain);
    noiseGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    mod.start(t);
    osc.start(t);
    whiteNoise.start(t);

    mod.stop(t + 0.5);
    osc.stop(t + 0.5);
    whiteNoise.stop(t + 0.5);
  } catch (err) {
    console.error('Falcon audio error:', err);
  }
};

const playNotificationSound = playFalconCry;

let isStoreInitialized = false;

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  botStatus: {
    isConnected: false,
    isConnecting: false,
    error: null,
    botInfo: null,
  },
  settings: {
    botToken: '',
    allowedChatId: '',
    whitelistEnabled: false,
    autoReplyEnabled: false,
    autoReplyMessage: 'Merhaba! Mesajınız alındı, size en kısa sürede dönüş yapacağız.',
    playSound: true,
    desktopNotifications: true,
    operatorName: 'Destek Temsilcisi',
    theme: 'dark',
    language: 'tr',
  },
  quickReplies: [],
  searchQuery: '',
  replyingToMessage: null,
  lightboxMedia: null,
  isSettingsOpen: false,
  isLoadingMessages: false,
  isUploadingMedia: false,
  uploadingStatusText: '',

  setIsUploadingMedia: (isUploading: boolean, text: string = '') => {
    set({ isUploadingMedia: isUploading, uploadingStatusText: text });
  },

  init: async () => {
    try {
      if (!window.electronAPI) return;

      const [dbSettings, status, quickReplies, chats] = await Promise.all([
        window.electronAPI.getSettings(),
        window.electronAPI.botGetStatus(),
        window.electronAPI.getQuickReplies(),
        window.electronAPI.getChats(),
      ]);

      let initialLang: SupportedLanguage = 'tr';
      try {
        const stored = localStorage.getItem('falcon_lang');
        if (stored === 'tr' || stored === 'en' || stored === 'ar' || stored === 'es') {
          initialLang = stored;
        } else if (dbSettings.language) {
          initialLang = dbSettings.language;
        }
      } catch {}

      const settings: AppSettings = {
        ...dbSettings,
        language: initialLang,
      };

      set({
        settings,
        botStatus: status,
        quickReplies,
        chats,
      });

      if (settings.theme === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }

      if (!isStoreInitialized) {
        isStoreInitialized = true;

        // Register real-time event listeners once
        window.electronAPI.onNewMessage((message, chat) => {
          get().handleIncomingMessage(message, chat);
        });

        window.electronAPI.onChatUpdated((chat) => {
          get().handleChatUpdated(chat);
        });

        window.electronAPI.onChatDeleted((chatId) => {
          get().handleChatDeleted(chatId);
        });

        window.electronAPI.onMessageDeleted((messageId, chatId) => {
          get().handleMessageDeleted(messageId, chatId);
        });

        window.electronAPI.onBotStatusChanged((status) => {
          get().handleBotStatusChanged(status);
        });

        // Initialize Android notifications
        initNotifications((chatId) => {
          get().selectChat(chatId);
        });
      }

      // Auto-open settings if token is missing
      if (!settings.botToken) {
        set({ isSettingsOpen: true });
      }
    } catch (err) {
      console.error('Failed to initialize app state:', err);
    }
  },

  fetchChats: async (search?: string) => {
    try {
      const chats = await window.electronAPI.getChats(search);
      set({ chats });
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    }
  },

  selectChat: async (chatId: number) => {
    set({ activeChatId: chatId, replyingToMessage: null });
    await get().loadMessages(chatId);
    await window.electronAPI.markChatRead(chatId);

    // Update unread count in store immediately
    set((state) => ({
      chats: state.chats.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)),
    }));
  },

  loadMessages: async (chatId: number) => {
    set({ isLoadingMessages: true });
    try {
      const msgs = await window.electronAPI.getMessages(chatId, 200, 0);
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: msgs,
        },
        isLoadingMessages: false,
      }));
    } catch (err) {
      console.error('Failed to load messages:', err);
      set({ isLoadingMessages: false });
    }
  },

  sendTextMessage: async (text: string) => {
    const { activeChatId, replyingToMessage } = get();
    if (!activeChatId || !text.trim()) return;

    try {
      const message = await window.electronAPI.sendText({
        chatId: activeChatId,
        text: text.trim(),
        replyToMessageId: replyingToMessage ? replyingToMessage.telegramMessageId : null,
      });

      // Add to messages list
      set((state) => {
        const chatMsgs = state.messages[activeChatId] || [];
        return {
          messages: {
            ...state.messages,
            [activeChatId]: [...chatMsgs, message],
          },
          replyingToMessage: null,
        };
      });

      await get().fetchChats(get().searchQuery);
    } catch (err: any) {
      console.error('Send text message error:', err);
      // Reload messages to update failed status
      if (activeChatId) {
        await get().loadMessages(activeChatId);
      }
      throw err;
    }
  },

  sendMediaMessage: async (filePath: string, caption?: string, mediaType: 'photo' | 'document' = 'photo') => {
    const { activeChatId, replyingToMessage, setIsUploadingMedia } = get();
    if (!activeChatId || !filePath) return;

    try {
      setIsUploadingMedia(true, mediaType === 'photo' ? 'Fotoğraf gönderiliyor...' : 'Dosya gönderiliyor...');
      const message = await window.electronAPI.sendMedia({
        chatId: activeChatId,
        filePath,
        caption: caption?.trim() || '',
        mediaType,
        replyToMessageId: replyingToMessage ? replyingToMessage.telegramMessageId : null,
      });

      set((state) => {
        const chatMsgs = state.messages[activeChatId] || [];
        return {
          messages: {
            ...state.messages,
            [activeChatId]: [...chatMsgs, message],
          },
          replyingToMessage: null,
        };
      });

      await get().fetchChats(get().searchQuery);
    } catch (err: any) {
      console.error('Send media message error:', err);
      if (activeChatId) {
        await get().loadMessages(activeChatId);
      }
      throw err;
    } finally {
      setIsUploadingMedia(false);
    }
  },

  sendClipboardImage: async (buffer: ArrayBuffer, caption?: string) => {
    const { activeChatId, replyingToMessage, setIsUploadingMedia } = get();
    if (!activeChatId) return;

    try {
      setIsUploadingMedia(true, 'Görsel yükleniyor...');
      const message = await window.electronAPI.sendClipboardImage({
        chatId: activeChatId,
        buffer,
        caption: caption?.trim() || '',
      });

      set((state) => {
        const chatMsgs = state.messages[activeChatId] || [];
        if (chatMsgs.some((m) => m.id === message.id)) return state;
        return {
          messages: {
            ...state.messages,
            [activeChatId]: [...chatMsgs, message],
          },
          replyingToMessage: null,
        };
      });

      await get().fetchChats(get().searchQuery);
    } catch (err: any) {
      console.error('Send clipboard image error:', err);
      if (activeChatId) {
        await get().loadMessages(activeChatId);
      }
      throw err;
    } finally {
      setIsUploadingMedia(false);
    }
  },

  resendMessage: async (messageId: number) => {
    const { activeChatId } = get();
    try {
      await window.electronAPI.resendMessage(messageId);
      if (activeChatId) {
        await get().loadMessages(activeChatId);
      }
    } catch (err) {
      console.error('Resend message error:', err);
      if (activeChatId) {
        await get().loadMessages(activeChatId);
      }
    }
  },

  deleteMessage: async (messageId: number, forEveryone: boolean) => {
    const { activeChatId } = get();
    try {
      await window.electronAPI.deleteMessage(messageId, forEveryone);
      if (activeChatId) {
        set((state) => ({
          messages: {
            ...state.messages,
            [activeChatId]: (state.messages[activeChatId] || []).filter((m) => m.id !== messageId),
          },
        }));
      }
      await get().fetchChats(get().searchQuery);
    } catch (err) {
      console.error('Delete message error:', err);
    }
  },

  deleteChat: async (chatId: number, forEveryone: boolean = false) => {
    try {
      await window.electronAPI.deleteChat(chatId, forEveryone);
      get().handleChatDeleted(chatId);
    } catch (err) {
      console.error('Delete chat error:', err);
    }
  },

  togglePinChat: async (chatId: number) => {
    try {
      await window.electronAPI.togglePinChat(chatId);
      await get().fetchChats(get().searchQuery);
    } catch (err) {
      console.error('Toggle pin chat error:', err);
    }
  },

  startBot: async () => {
    try {
      const res = await window.electronAPI.botStart();
      const status = await window.electronAPI.botGetStatus();
      set({ botStatus: status });
      return res;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  stopBot: async () => {
    try {
      await window.electronAPI.botStop();
      const status = await window.electronAPI.botGetStatus();
      set({ botStatus: status });
    } catch (err) {
      console.error('Stop bot error:', err);
    }
  },

  setTheme: async (theme: 'dark' | 'light') => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    await get().saveSettings({ theme });
  },

  setLanguage: async (language: SupportedLanguage) => {
    try {
      localStorage.setItem('falcon_lang', language);
    } catch {}

    set((state) => ({
      settings: {
        ...state.settings,
        language,
      },
    }));

    try {
      await window.electronAPI.saveSettings({ language });
    } catch (err) {
      console.error('Failed to save language setting:', err);
    }
  },

  saveSettings: async (newSettings: Partial<AppSettings>) => {
    try {
      const updated = await window.electronAPI.saveSettings(newSettings);
      set((state) => ({
        settings: {
          ...state.settings,
          ...updated,
          language: state.settings.language || updated.language || 'tr',
        },
      }));
    } catch (err) {
      console.error('Save settings error:', err);
    }
  },

  saveQuickReply: async (reply: Omit<QuickReply, 'id'> & { id?: number }) => {
    try {
      await window.electronAPI.saveQuickReply(reply);
      const list = await window.electronAPI.getQuickReplies();
      set({ quickReplies: list });
    } catch (err) {
      console.error('Save quick reply error:', err);
    }
  },

  deleteQuickReply: async (id: number) => {
    try {
      await window.electronAPI.deleteQuickReply(id);
      const list = await window.electronAPI.getQuickReplies();
      set({ quickReplies: list });
    } catch (err) {
      console.error('Delete quick reply error:', err);
    }
  },

  setReplyingTo: (message: Message | null) => set({ replyingToMessage: message }),
  setLightboxMedia: (media) => set({ lightboxMedia: media }),
  setIsSettingsOpen: (isOpen: boolean) => set({ isSettingsOpen: isOpen }),
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    get().fetchChats(query);
  },

  handleIncomingMessage: (message: Message, chat: Chat) => {
    const { activeChatId, settings } = get();

    // Play chime sound if enabled and sender is user
    if (settings.playSound && message.senderType === 'user') {
      playNotificationSound();
    }

    // Trigger Android notification if enabled and sender is user
    if (settings.desktopNotifications && message.senderType === 'user') {
      showIncomingMessageNotification(chat, message);
    }

    // If chat is currently active, mark it read and append message
    if (activeChatId === message.chatId) {
      window.electronAPI.markChatRead(message.chatId);
      set((state) => {
        const currentMsgs = state.messages[message.chatId] || [];
        if (currentMsgs.some((m) => m.id === message.id)) {
          return state;
        }
        return {
          messages: {
            ...state.messages,
            [message.chatId]: [...currentMsgs, message],
          },
        };
      });
    }

    // Refresh chat list to update last message preview and badge
    get().fetchChats(get().searchQuery);
  },

  handleChatUpdated: (chat: Chat) => {
    set((state) => {
      const index = state.chats.findIndex((c) => c.id === chat.id);
      if (index >= 0) {
        const updated = [...state.chats];
        updated[index] = chat;
        // Re-sort: pinned first, then updated_at desc
        updated.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
        });
        return { chats: updated };
      } else {
        return { chats: [chat, ...state.chats] };
      }
    });
  },

  handleChatDeleted: (chatId: number) => {
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== chatId),
      activeChatId: state.activeChatId === chatId ? null : state.activeChatId,
      messages: {
        ...state.messages,
        [chatId]: [],
      },
    }));
    get().fetchChats(get().searchQuery);
  },

  handleMessageDeleted: (messageId: number, chatId: number) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).filter((m) => m.id !== messageId),
      },
    }));
    get().fetchChats(get().searchQuery);
  },

  handleBotStatusChanged: (status: BotStatus) => {
    set({ botStatus: status });
  },
}));
