import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useI18n } from '../../locales/i18n';
import {
  Send,
  Image,
  Paperclip,
  Zap,
  X,
  Loader2,
} from 'lucide-react';
import { QuickReply } from '../../../types';

export const MessageInput: React.FC = () => {
  const {
    replyingToMessage,
    setReplyingTo,
    sendTextMessage,
    sendMediaMessage,
    sendClipboardImage,
    quickReplies,
    botStatus,
  } = useChatStore();

  const { t } = useI18n();

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSend = async () => {
    if (!text.trim() || isSending) return;

    const messageText = text;
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      setIsSending(true);
      await sendTextMessage(messageText);
    } catch (err: any) {
      alert(err.message || 'Error sending message');
      setText(messageText);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Clipboard Paste for Images/Screenshots
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          try {
            setIsSending(true);
            const buffer = await file.arrayBuffer();
            await sendClipboardImage(buffer, text);
            setText('');
          } catch (err: any) {
            alert('Error: ' + (err.message || 'Error'));
          } finally {
            setIsSending(false);
          }
          return;
        }
      }
    }
  };

  const handlePickPhoto = async () => {
    const filePath = await window.electronAPI.openFileDialog('images');
    if (!filePath) return;

    try {
      setIsSending(true);
      await sendMediaMessage(filePath, text, 'photo');
      setText('');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handlePickDocument = async () => {
    const filePath = await window.electronAPI.openFileDialog('all');
    if (!filePath) return;

    try {
      setIsSending(true);
      await sendMediaMessage(filePath, text, 'document');
      setText('');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectQuickReply = (reply: QuickReply) => {
    setText(reply.text);
    setShowQuickReplies(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="relative border-t border-[#1A1A1A] bg-[#0A0A0A] p-2.5 select-none">
      {/* Quick Replies Popup */}
      {showQuickReplies && (
        <div className="absolute bottom-full left-4 mb-2 w-80 bg-[#111111] border border-[#262626] rounded-2xl shadow-2xl p-2 z-50 animate-slide-up">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#222222] mb-1">
            <span className="text-xs font-semibold text-[#3B82F6]">{t('settings.quickReplies.title')}</span>
            <button
              onClick={() => setShowQuickReplies(false)}
              className="text-[#888888] hover:text-[#EDEDED] text-xs p-1"
            >
              ✕
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-[#222222]">
            {quickReplies.length === 0 ? (
              <p className="text-xs text-[#888888] p-3 text-center">{t('settings.quickReplies.empty')}</p>
            ) : (
              quickReplies.map((qr) => (
                <button
                  key={qr.id}
                  onClick={() => handleSelectQuickReply(qr)}
                  className="w-full text-left p-2 hover:bg-[#1C1C1C] rounded-xl transition-colors flex flex-col"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-[#EDEDED]">{qr.title}</span>
                    <span className="text-[10px] text-[#3B82F6] font-mono">{qr.shortcut}</span>
                  </div>
                  <span className="text-[11px] text-[#888888] truncate mt-0.5">{qr.text}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Replying Banner */}
      {replyingToMessage && (
        <div className="mb-2 p-2 px-3 bg-[#141414] border border-[#262626] rounded-xl flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2 text-xs truncate">
            <div className="w-1 h-6 bg-[#3B82F6] rounded-full" />
            <div className="truncate">
              <div className="font-semibold text-[#3B82F6] text-[10px]">
                {replyingToMessage.senderType === 'user' ? t('app.replyingToUser') : t('app.replyingToOperator')}
              </div>
              <div className="text-[#EDEDED] text-xs truncate max-w-lg">
                {replyingToMessage.content || `[${t('app.photo')}]`}
              </div>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded text-[#888888] hover:text-[#EDEDED]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end space-x-1.5">
        <div className="flex items-center space-x-0.5 pb-0.5 text-[#888888]">
          <button
            type="button"
            onClick={handlePickPhoto}
            disabled={!botStatus.isConnected}
            title={t('app.photo')}
            className="p-2 rounded-xl hover:text-[#3B82F6] hover:bg-[#1A1A1A] transition-colors disabled:opacity-30"
          >
            <Image className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handlePickDocument}
            disabled={!botStatus.isConnected}
            title={t('app.document')}
            className="p-2 rounded-xl hover:text-[#3B82F6] hover:bg-[#1A1A1A] transition-colors disabled:opacity-30"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            title={t('settings.quickReplies.title')}
            className={`p-2 rounded-xl transition-colors ${
              showQuickReplies ? 'text-amber-400 bg-amber-400/10' : 'hover:text-amber-400 hover:bg-[#1A1A1A]'
            }`}
          >
            <Zap className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 bg-[#121212] border border-[#222222] rounded-2xl focus-within:border-[#3B82F6] transition-all flex items-end">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={botStatus.isConnected ? t('app.typeMessage') : t('app.botNotConnected')}
            disabled={!botStatus.isConnected}
            className="w-full bg-transparent text-xs sm:text-sm text-[#EDEDED] placeholder-[#888888] p-2.5 max-h-32 resize-none focus:outline-none disabled:cursor-not-allowed select-text leading-relaxed"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || isSending || !botStatus.isConnected}
          className="p-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#1A1A1A] text-white disabled:text-[#555555] rounded-2xl shadow-lg shadow-blue-500/20 disabled:shadow-none transition-all flex-shrink-0 flex items-center justify-center"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};
