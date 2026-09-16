import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { useI18n } from '../../locales/i18n';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { useVirtualizer } from '@tanstack/react-virtual';
import logoImg from '../../assets/logo.png';
import { ArrowDown, Loader2, UploadCloud } from 'lucide-react';

export const ChatWindow: React.FC = () => {
  const {
    chats,
    activeChatId,
    messages,
    isLoadingMessages,
    isUploadingMedia,
    uploadingStatusText,
    sendMediaMessage,
    sendClipboardImage,
  } = useChatStore();

  const { t } = useI18n();

  const chat = chats.find((c) => c.id === activeChatId);
  const activeMessages = (activeChatId ? messages[activeChatId] : []) || [];

  const parentRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: activeMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (parentRef.current) {
      parentRef.current.scrollTo({
        top: parentRef.current.scrollHeight,
        behavior,
      });
    }
  };

  useEffect(() => {
    if (activeMessages.length > 0) {
      const el = parentRef.current;
      if (!el) return;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 250;
      if (isNearBottom || activeMessages.length <= 15) {
        setTimeout(() => scrollToBottom('auto'), 50);
      }
    }
  }, [activeMessages.length, activeChatId]);

  const handleScroll = () => {
    if (parentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
      const isUp = scrollHeight - scrollTop - clientHeight > 300;
      setShowScrollBottom(isUp);
    }
  };

  const getMessageDateString = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString([], { day: 'numeric', month: 'long' });
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!activeChatId) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = (file as any).path;

      if (filePath) {
        const isImage = /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(filePath);
        try {
          await sendMediaMessage(filePath, '', isImage ? 'photo' : 'document');
        } catch (err: any) {
          alert('Error: ' + err.message);
        }
      } else {
        const buffer = await file.arrayBuffer();
        try {
          await sendClipboardImage(buffer, '');
        } catch (err: any) {
          alert('Error: ' + err.message);
        }
      }
    }
  };

  if (!chat) {
    return (
      <main className="hidden md:flex flex-1 h-full bg-[#000000] pure-black-chat flex-col items-center justify-center text-center p-8 select-none overflow-hidden animate-fade-in">
        <img
          src={logoImg}
          alt="Falcon Desk"
          className="falcon-logo w-36 h-36 md:w-44 md:h-44 object-contain mb-4 select-none pointer-events-none"
        />
        <h2 className="text-base sm:text-lg font-bold text-[#EDEDED] mb-1 tracking-tight">
          {t('app.welcomeTitle')}
        </h2>
        <p className="text-xs sm:text-sm text-[#888888]">
          {t('app.welcomeSubtitle')}
        </p>
      </main>
    );
  }

  return (
    <main
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 h-full flex flex-col bg-[#000000] pure-black-chat relative overflow-hidden overflow-x-hidden max-w-full"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm border-2 border-dashed border-[#3B82F6] flex flex-col items-center justify-center text-[#EDEDED] pointer-events-none animate-fade-in">
          <div className="p-4 rounded-full bg-[#3B82F6]/20 text-[#3B82F6] mb-3 animate-bounce">
            <UploadCloud className="w-10 h-10" />
          </div>
          <p className="text-sm font-semibold">{t('app.dragDrop')}</p>
        </div>
      )}

      {/* Top Header */}
      <ChatHeader chat={chat} />

      {/* Messages List Area */}
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-12 py-3 relative max-w-full"
      >
        {isLoadingMessages && activeMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#888888]">
            <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6] mr-2" />
            <span className="text-xs">{t('app.loading')}</span>
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#888888] text-center">
            <p className="text-xs">{t('app.noMessages')}</p>
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const msg = activeMessages[virtualRow.index];
              const prevMsg = virtualRow.index > 0 ? activeMessages[virtualRow.index - 1] : null;
              const isNewDay = !prevMsg || getMessageDateString(prevMsg.createdAt) !== getMessageDateString(msg.createdAt);

              return (
                <div
                  key={msg.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {/* Date Pill */}
                  {isNewDay && (
                    <div className="flex justify-center my-3 select-none">
                      <span className="bg-[#181818] text-[#888888] text-[11px] font-medium px-3 py-0.5 rounded-full border border-[#262626] shadow-sm">
                        {getMessageDateString(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  <MessageBubble message={msg} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Animated Uploading Progress Indicator */}
      {isUploadingMedia && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#141414]/95 border border-[#3B82F6] backdrop-blur-md text-[#EDEDED] px-4 py-2 rounded-2xl shadow-2xl flex items-center space-x-3 z-30 animate-scale-in">
          <Loader2 className="w-4 h-4 animate-spin text-[#3B82F6]" />
          <span className="text-xs font-semibold tracking-wide">{uploadingStatusText || 'Dosya gönderiliyor...'}</span>
        </div>
      )}

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-16 right-6 p-2 rounded-full bg-[#141414] text-[#3B82F6] hover:text-white hover:bg-[#3B82F6] border border-[#262626] shadow-lg transition-all animate-fade-in z-20"
          title="Down"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Bottom Message Input */}
      <MessageInput />
    </main>
  );
};
