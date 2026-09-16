import React, { useState } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useI18n } from '../../locales/i18n';
import { DeleteChatModal } from '../Common/DeleteChatModal';
import { ExternalLink, Trash2, Pin, ChevronLeft } from 'lucide-react';
import { Chat } from '../../../types';
import { resolveMediaUrl } from '../../utils/media';

interface ChatHeaderProps {
  chat: Chat;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ chat }) => {
  const { togglePinChat } = useChatStore();
  const { t } = useI18n();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleOpenTelegram = () => {
    if (chat.username) {
      window.electronAPI.openExternal(`https://t.me/${chat.username}`);
    } else {
      window.electronAPI.openExternal(`tg://user?id=${chat.telegramUserId}`);
    }
  };

  const getInitials = (firstName: string, lastName?: string | null) => {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '?';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return `${first}${last}`;
  };

  return (
    <>
      <header className="h-14 px-3 sm:px-4 bg-[#0A0A0A] border-b border-[#1A1A1A] flex items-center justify-between flex-shrink-0 select-none z-10">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          {/* Mobile Back Button */}
          <button
            onClick={() => useChatStore.setState({ activeChatId: null })}
            className="md:hidden p-1.5 -ml-1 text-[#888888] hover:text-[#EDEDED] active:bg-[#1A1A1A] rounded-lg transition-colors"
            title="Geri"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {chat.avatarPath ? (
            <img
              src={resolveMediaUrl(chat.avatarPath)}
              alt={chat.firstName}
              className="w-10 h-10 rounded-full object-cover bg-[#121212] border border-white/10 shadow-sm"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-semibold text-xs shadow">
              {getInitials(chat.firstName, chat.lastName)}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="font-semibold text-[#EDEDED] text-xs sm:text-sm truncate">
                {chat.firstName} {chat.lastName || ''}
              </h2>
              {chat.username && (
                <button
                  onClick={handleOpenTelegram}
                  className="text-xs text-[#3B82F6] hover:underline flex items-center space-x-0.5 truncate"
                  title={t('actions.openTelegram')}
                >
                  <span>@{chat.username}</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 inline" />
                </button>
              )}
            </div>

            <div className="text-[11px] text-[#888888] mt-0.2 flex items-center space-x-2">
              <span>ID: {chat.telegramUserId}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => togglePinChat(chat.id)}
            className={`p-2 rounded-lg transition-colors ${
              chat.isPinned
                ? 'text-[#3B82F6] bg-[#3B82F6]/10'
                : 'text-[#888888] hover:text-[#EDEDED] hover:bg-[#1A1A1A]'
            }`}
            title={chat.isPinned ? t('actions.unpin') : t('actions.pin')}
          >
            <Pin className={`w-4 h-4 ${chat.isPinned ? 'fill-[#3B82F6]' : ''}`} />
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded-lg text-[#888888] hover:text-rose-400 hover:bg-[#1A1A1A] transition-colors"
            title={t('actions.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Delete Chat Confirmation Modal */}
      <DeleteChatModal
        chatId={chat.id}
        chatName={`${chat.firstName} ${chat.lastName || ''}`.trim()}
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
      />
    </>
  );
};
