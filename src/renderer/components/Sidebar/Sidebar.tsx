import React, { useState } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useI18n } from '../../locales/i18n';
import { DeleteChatModal } from '../Common/DeleteChatModal';
import {
  Search,
  Settings,
  Pin,
  Trash2,
  MessageSquareOff,
} from 'lucide-react';
import { Chat } from '../../../types';
import { resolveMediaUrl } from '../../utils/media';

export const Sidebar: React.FC = () => {
  const {
    chats,
    activeChatId,
    selectChat,
    searchQuery,
    setSearchQuery,
    setIsSettingsOpen,
    togglePinChat,
  } = useChatStore();

  const { t } = useI18n();
  const [hoveredChatId, setHoveredChatId] = useState<number | null>(null);
  const [deletingChat, setDeletingChat] = useState<{ id: number; name: string } | null>(null);

  const formatTimestamp = (timestamp?: number | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const getInitials = (firstName: string, lastName?: string | null) => {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '?';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return `${first}${last}`;
  };

  const getAvatarGradient = (id: number) => {
    const gradients = [
      'from-blue-600 to-indigo-700',
      'from-emerald-600 to-teal-700',
      'from-purple-600 to-violet-700',
      'from-amber-600 to-orange-700',
      'from-rose-600 to-pink-700',
      'from-cyan-600 to-blue-700',
    ];
    return gradients[Math.abs(id) % gradients.length];
  };

  return (
    <>
      <aside className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-88 h-full bg-[#0A0A0A] border-r border-[#1A1A1A] flex-col flex-shrink-0 select-none`}>
        {/* Top Clean Search Bar with Settings Button on the Right */}
        <div className="p-3 border-b border-[#1A1A1A] flex items-center space-x-2 bg-[#0A0A0A]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('app.search')}
              className="w-full bg-[#121212] border border-[#222222] rounded-xl pl-8 pr-7 py-2 text-xs text-[#EDEDED] placeholder-[#888888] focus:outline-none focus:border-[#3B82F6] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#888888] hover:text-[#EDEDED]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Settings button on the right */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl text-[#888888] hover:text-[#EDEDED] hover:bg-[#1A1A1A] border border-[#222222] bg-[#121212] transition-colors flex-shrink-0"
            title={t('settings.title')}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#1A1A1A]/40">
          {chats.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#888888]">
              <MessageSquareOff className="w-9 h-9 stroke-[1.5] mb-2 text-[#888888]/40" />
              <p className="text-xs font-medium text-[#888888]">{t('app.noChats')}</p>
            </div>
          ) : (
            chats.map((chat: Chat) => {
              const isActive = activeChatId === chat.id;
              const isHovered = hoveredChatId === chat.id;

              return (
                <div
                  key={chat.id}
                  onClick={() => selectChat(chat.id)}
                  onMouseEnter={() => setHoveredChatId(chat.id)}
                  onMouseLeave={() => setHoveredChatId(null)}
                  className={`group relative p-3 px-3.5 flex items-center space-x-3 cursor-pointer transition-colors border-l-2 ${
                    isActive
                      ? 'bg-[#1F1F1F] border-[#3B82F6] text-white'
                      : 'border-transparent hover:bg-[#141414] text-[#EDEDED]'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {chat.avatarPath ? (
                      <img
                        src={resolveMediaUrl(chat.avatarPath)}
                        alt={chat.firstName}
                        className="w-11 h-11 rounded-full object-cover bg-[#121212] border border-white/10 shadow-sm"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div
                        className={`w-11 h-11 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                          chat.telegramUserId
                        )} flex items-center justify-center text-white font-semibold text-xs shadow`}
                      >
                        {getInitials(chat.firstName, chat.lastName)}
                      </div>
                    )}

                    {chat.isPinned && (
                      <span className="absolute -top-0.5 -right-0.5 bg-[#0A0A0A] text-[#3B82F6] p-0.5 rounded-full border border-[#222222]">
                        <Pin className="w-2.5 h-2.5 fill-[#3B82F6]" />
                      </span>
                    )}
                  </div>

                  {/* Chat Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold truncate text-[#EDEDED]">
                        {chat.firstName} {chat.lastName || ''}
                      </h3>
                      <span className="text-[10px] text-[#888888] flex-shrink-0 ml-1.5">
                        {formatTimestamp(chat.lastMessageTime || chat.updatedAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-0.5">
                      <div className="flex items-center space-x-1 truncate pr-1">
                        {chat.username && (
                          <span className="text-[11px] text-[#3B82F6] truncate">
                            @{chat.username}
                          </span>
                        )}
                        {chat.username && chat.lastMessageText && (
                          <span className="text-[#888888]">:</span>
                        )}
                        <span className="text-xs text-[#888888] truncate">
                          {chat.lastMessageText || t('app.startedChat')}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {chat.unreadCount > 0 && (
                          <span className="bg-[#2563EB] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-sm">
                            {chat.unreadCount}
                          </span>
                        )}

                        {isHovered && (
                          <div
                            className="flex items-center space-x-1 bg-[#121212] rounded p-0.5 shadow border border-[#222222]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => togglePinChat(chat.id)}
                              title={chat.isPinned ? t('actions.unpin') : t('actions.pin')}
                              className="p-1 text-[#888888] hover:text-[#3B82F6]"
                            >
                              <Pin className={`w-3 h-3 ${chat.isPinned ? 'fill-[#3B82F6] text-[#3B82F6]' : ''}`} />
                            </button>
                            <button
                              onClick={() =>
                                setDeletingChat({
                                  id: chat.id,
                                  name: `${chat.firstName} ${chat.lastName || ''}`.trim(),
                                })
                              }
                              title={t('actions.delete')}
                              className="p-1 text-[#888888] hover:text-rose-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Delete Chat Modal from Sidebar */}
      {deletingChat && (
        <DeleteChatModal
          chatId={deletingChat.id}
          chatName={deletingChat.name}
          isOpen={true}
          onClose={() => setDeletingChat(null)}
        />
      )}
    </>
  );
};
