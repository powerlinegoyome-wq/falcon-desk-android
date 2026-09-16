import React, { useEffect, useState } from 'react';
import logoImg from '../../assets/logo.png';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(20);
  const [statusText, setStatusText] = useState('Başlatılıyor...');
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Phase 1
    const t1 = setTimeout(() => {
      setProgress(55);
      setStatusText('Hazırlanıyor...');
    }, 250);

    // Phase 2
    const t2 = setTimeout(() => {
      setProgress(85);
      setStatusText('Bağlantı kuruluyor...');
    }, 550);

    // Phase 3: Ready
    const t3 = setTimeout(() => {
      setProgress(100);
      setStatusText('Hazır');
    }, 900);

    // Phase 4: Fade Out
    const t4 = setTimeout(() => {
      setIsFadingOut(true);
    }, 1150);

    // Phase 5: Complete
    const t5 = setTimeout(() => {
      onFinish();
    }, 1450);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[99999] bg-[#000000] flex flex-col items-center justify-center select-none overflow-hidden transition-all duration-300 ${
        isFadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >

      {/* Center Logo with Breathing Pulse */}
      <div className="relative flex flex-col items-center z-10 space-y-6">
        <div className="relative">
          <img
            src={logoImg}
            alt="Falcon Desk"
            className="w-28 h-28 sm:w-36 sm:h-36 object-contain splash-logo"
          />
        </div>

        {/* Brand Name */}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[0.25em] text-white flex items-center justify-center space-x-2">
          <span>FALCON</span>
          <span className="text-[#3B82F6]">DESK</span>
        </h1>

        {/* Smooth Glowing Progress Bar */}
        <div className="w-56 sm:w-64 space-y-2 pt-2">
          <div className="w-full h-1 bg-[#1A1A1A] rounded-full overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-[#2563EB] via-[#3B82F6] to-[#60A5FA] rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(59,130,246,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#666666] font-medium px-0.5">
            <span className="truncate">{statusText}</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
