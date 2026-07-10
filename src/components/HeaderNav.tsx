'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useDownloadQueue } from '@/context/DownloadQueueContext';

export default function HeaderNav() {
  const { queue } = useDownloadQueue();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10 shadow-sm text-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 font-extrabold text-lg tracking-tight hover:opacity-95 transition">
            <span className="text-xl">⚙️</span>
            <span>Mirai PDF Studio</span>
          </Link>
          
          {/* Downloads Queue Link with Badge */}
          <Link
            href="/downloads"
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-xs font-bold px-2.5 py-1.5 rounded-lg text-slate-200 border border-slate-700/80 transition"
          >
            📥 คิวไฟล์เอกสาร
            {queue.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                {queue.length}
              </span>
            )}
          </Link>

          {/* Quick PWA Install Button */}
          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1 bg-pink-600 hover:bg-pink-700 text-xs font-bold px-2.5 py-1.5 rounded-lg text-white border border-pink-500 transition shadow-sm animate-pulse cursor-pointer"
            >
              📲 ติดตั้งแอป
            </button>
          )}
        </div>

        <span className="text-xs text-slate-400 hidden sm:flex items-center gap-1.5 font-semibold">
          🔒 Secure Client-Side Engine
        </span>
      </div>
    </header>
  );
}
