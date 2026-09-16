import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useChatStore } from '../../store/useChatStore';
import { useI18n } from '../../locales/i18n';
import {
  CheckCheck,
  Clock,
  FileText,
  FolderOpen,
  Reply,
  Play,
  RotateCw,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Message } from '../../../types';
import { resolveMediaUrl } from '../../utils/media';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { setReplyingTo, setLightboxMedia, resendMessage, deleteMessage } = useChatStore();
  const { t } = useI18n();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteForEveryone, setDeleteForEveryone] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOperator = message.senderType === 'operator';
  const isSystem = message.senderType === 'system';

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-2 select-none">
        <span className="bg-[#181818] text-[#888888] text-[11px] px-3 py-0.5 rounded-full border border-[#262626]">
          {message.content}
        </span>
      </div>
    );
  }

  const renderStatus = () => {
    if (!isOperator) return null;

    if (message.status === 'sending') {
      return <Clock className="w-3 h-3 text-blue-200 inline ml-1 animate-pulse" />;
    }
    if (message.status === 'failed') {
      return (
        <button
          onClick={() => resendMessage(message.id)}
          title={t('actions.resend')}
          className="text-rose-400 hover:text-rose-200 inline ml-1"
        >
          <RotateCw className="w-3 h-3" />
        </button>
      );
    }
    return <CheckCheck className="w-3.5 h-3.5 text-blue-200 inline ml-1" />;
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteMessage(message.id, deleteForEveryone && Boolean(message.telegramMessageId));
      setShowDeleteModal(false);
    } catch (err) {
      alert('Error deleting message');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div
        className={`group relative flex flex-col mb-2.5 max-w-full ${
          isOperator ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`relative max-w-[85%] sm:max-w-[75%] md:max-w-[65%] rounded-2xl px-3.5 py-2 shadow-sm transition-all ${
            isOperator
              ? 'bg-[#2563EB] text-white rounded-br-sm shadow-blue-500/10'
              : 'bg-[#181818] text-[#EDEDED] rounded-bl-sm border border-[#262626]'
          }`}
        >
          {/* Reply Quote Header */}
          {message.replyToContent && (
            <div
              className={`text-xs mb-1.5 p-1.5 px-2 rounded border-l-2 select-none ${
                isOperator
                  ? 'bg-blue-700/60 border-white text-blue-100'
                  : 'bg-[#0F0F0F] border-[#3B82F6] text-slate-300'
              }`}
            >
              <div className="font-semibold text-[10px] uppercase opacity-75">{t('app.repliedMessage')}</div>
              <div className="truncate text-xs">{message.replyToContent}</div>
            </div>
          )}

          {/* Media: Photo */}
          {message.messageType === 'photo' && message.mediaPath && (
            <div className="mb-1.5 overflow-hidden rounded-xl bg-black/40">
              <div
                className="relative cursor-pointer group/img"
                onClick={() =>
                  setLightboxMedia({
                    url: resolveMediaUrl(message.mediaPath!),
                    title: message.content || t('app.photo'),
                    originalPath: message.mediaPath!,
                  })
                }
              >
                <img
                  src={resolveMediaUrl(message.mediaPath)}
                  alt="Fotoğraf"
                  className="w-full max-h-80 object-cover rounded-xl transition-transform duration-150 group-hover/img:scale-[1.01]"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Media: Document */}
          {message.messageType === 'document' && (
            <div
              className={`flex items-center space-x-2.5 p-2 mb-1.5 rounded-xl border ${
                isOperator
                  ? 'bg-blue-700/50 border-blue-400/30 text-white'
                  : 'bg-[#0F0F0F] border-[#262626] text-slate-200'
              }`}
            >
              <div className="p-2 rounded-lg bg-[#3B82F6]/20 text-[#3B82F6] flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{message.mediaName || t('app.document')}</p>
                <p className="text-[10px] text-[#888888]">{formatBytes(message.mediaSize)}</p>
              </div>
              {message.mediaPath && (
                <button
                  onClick={() => window.electronAPI.revealInFolder(message.mediaPath!)}
                  title={t('app.showInFolder')}
                  className="p-1 text-[#888888] hover:text-white"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Media: Voice */}
          {message.messageType === 'voice' && (
            <div className="flex items-center space-x-2.5 p-2 mb-1.5 rounded-xl bg-black/30">
              <div className="p-1.5 rounded-full bg-[#3B82F6] text-white flex-shrink-0">
                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium">{message.content || t('app.voiceMessage')}</p>
              </div>
            </div>
          )}

          {/* Text Content */}
          {message.content && (
            <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed select-text font-normal">
              {message.content}
            </p>
          )}

          {/* Bottom Metadata: Time & Status */}
          <div
            className={`flex items-center justify-end space-x-1 mt-0.5 text-[10px] select-none ${
              isOperator ? 'text-blue-100' : 'text-[#888888]'
            }`}
          >
            <span>{formatTime(message.createdAt)}</span>
            {renderStatus()}
          </div>
        </div>

        {/* Sleek Floating Mini-Toolbar on Hover (Never clipped) */}
        <div
          className={`absolute -top-3 ${
            isOperator ? 'right-3' : 'left-3'
          } opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center space-x-0.5 bg-[#141414]/95 backdrop-blur-md border border-[#2E2E2E] rounded-xl p-1 shadow-xl z-20`}
        >
          <button
            type="button"
            onClick={() => setReplyingTo(message)}
            title={t('actions.reply')}
            className="p-1 rounded-lg text-[#888888] hover:text-[#3B82F6] hover:bg-[#222222] transition-colors"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-3 bg-[#2A2A2A]" />
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            title={t('actions.delete')}
            className="p-1 rounded-lg text-[#888888] hover:text-rose-400 hover:bg-[#222222] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Perfectly Centered Delete Confirmation Modal rendered directly into document.body */}
      {showDeleteModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in"
            onClick={() => setShowDeleteModal(false)}
          >
            <div
              className="bg-[#111111] border border-[#262626] rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-scale-in text-[#EDEDED]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5 text-rose-400 font-semibold text-sm">
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <span>{t('deleteModal.title')}</span>
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-[#888888] hover:text-[#EDEDED] p-1.5 rounded-xl hover:bg-[#1C1C1C] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#888888] leading-relaxed">
                {t('deleteModal.prompt')}
              </p>

              {message.telegramMessageId && (
                <label className="flex items-center space-x-3 text-xs text-[#EDEDED] cursor-pointer p-3 rounded-2xl bg-[#181818] border border-[#262626] hover:border-[#3B82F6]/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={deleteForEveryone}
                    onChange={(e) => setDeleteForEveryone(e.target.checked)}
                    className="rounded bg-[#000000] border-[#333333] text-[#3B82F6] focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium">{t('deleteModal.deleteForEveryone')}</span>
                </label>
              )}

              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#888888] hover:text-[#EDEDED] hover:bg-[#1A1A1A] rounded-xl transition-colors"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-500/20 transition-all"
                >
                  {isDeleting ? t('actions.deleting') : t('actions.delete')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
