import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useChatStore } from '../../store/useChatStore';
import { useI18n } from '../../locales/i18n';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

interface DeleteChatModalProps {
  chatId: number;
  chatName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteChatModal: React.FC<DeleteChatModalProps> = ({
  chatId,
  chatName,
  isOpen,
  onClose,
}) => {
  const { deleteChat, botStatus } = useChatStore();
  const { t } = useI18n();

  const [deleteForEveryone, setDeleteForEveryone] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteChat(chatId, deleteForEveryone);
      onClose();
    } catch (err: any) {
      alert('Sohbet silinemedi: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in"
      onClick={onClose}
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
            <span>{t('deleteModal.chatTitle') || 'Sohbeti Sil'}</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#888888] hover:text-[#EDEDED] p-1.5 rounded-xl hover:bg-[#1C1C1C] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#888888] leading-relaxed">
          {chatName ? (
            <span>
              <strong className="text-[#EDEDED] font-semibold">{chatName}</strong> ile olan tüm sohbet geçmişini silmek istediğinize emin misiniz?
            </span>
          ) : (
            <span>{t('deleteModal.chatPrompt') || 'Bu sohbet geçmişini silmek istediğinize emin misiniz?'}</span>
          )}
        </p>

        <label className="flex items-center space-x-3 text-xs text-[#EDEDED] cursor-pointer p-3 rounded-2xl bg-[#181818] border border-[#262626] hover:border-[#3B82F6]/50 transition-colors">
          <input
            type="checkbox"
            checked={deleteForEveryone}
            onChange={(e) => setDeleteForEveryone(e.target.checked)}
            className="rounded bg-[#000000] border-[#333333] text-[#3B82F6] focus:ring-0 w-4 h-4 cursor-pointer"
          />
          <span className="font-medium">{t('deleteModal.deleteChatForEveryone') || 'Karşı taraf için de sil (Telegram\'dan kaldır)'}</span>
        </label>

        <div className="flex items-center justify-end space-x-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-[#888888] hover:text-[#EDEDED] hover:bg-[#1A1A1A] rounded-xl transition-colors"
          >
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-500/20 transition-all flex items-center space-x-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                <span>{t('actions.deleting')}</span>
              </>
            ) : (
              <span>{t('actions.delete')}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
