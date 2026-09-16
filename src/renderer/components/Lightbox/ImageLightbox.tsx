import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { X, ZoomIn, ZoomOut, RotateCcw, FolderOpen } from 'lucide-react';

export const ImageLightbox: React.FC = () => {
  const { lightboxMedia, setLightboxMedia } = useChatStore();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxMedia(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setLightboxMedia]);

  useEffect(() => {
    setScale(1);
  }, [lightboxMedia]);

  if (!lightboxMedia) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 select-none animate-fade-in"
      onClick={() => setLightboxMedia(null)}
    >
      {/* Top Toolbar */}
      <div
        className="w-full flex items-center justify-between px-4 py-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-slate-200 truncate max-w-md">
          {lightboxMedia.title}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setScale((s) => Math.min(s + 0.25, 3))}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Yakınlaştır"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Uzaklaştır"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScale(1)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Sıfırla"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {lightboxMedia.originalPath && (
            <button
              onClick={() => window.electronAPI.revealInFolder(lightboxMedia.originalPath!)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Klasörde Göster"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setLightboxMedia(null)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Kapat (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Centered Image */}
      <div
        className="flex-1 flex items-center justify-center w-full overflow-hidden p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={lightboxMedia.url}
          alt={lightboxMedia.title}
          style={{ transform: `scale(${scale})` }}
          className="max-h-[80vh] max-w-[90vw] object-contain rounded-xl shadow-2xl transition-transform duration-150 select-none cursor-grab active:cursor-grabbing"
        />
      </div>

      {/* Footer Info */}
      <div className="text-xs text-slate-400 pb-2">
        Yakınlaştırma: {Math.round(scale * 100)}% • Kapatmak için Esc tuşuna basabilir veya dışarı tıklayabilirsiniz.
      </div>
    </div>
  );
};
