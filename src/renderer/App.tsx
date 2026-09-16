import React, { useEffect, useState } from 'react';
import { useChatStore } from './store/useChatStore';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatWindow } from './components/Chat/ChatWindow';
import { SettingsModal } from './components/Settings/SettingsModal';
import { ImageLightbox } from './components/Lightbox/ImageLightbox';
import { SplashScreen } from './components/Common/SplashScreen';

export const App: React.FC = () => {
  const { init } = useChatStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <div className="flex h-screen w-screen bg-black text-[#EDEDED] overflow-hidden font-sans select-none">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Main Chat Area */}
        <ChatWindow />

        {/* Settings Modal */}
        <SettingsModal />

        {/* Media Lightbox */}
        <ImageLightbox />
      </div>
    </>
  );
};
