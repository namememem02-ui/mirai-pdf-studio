'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDownloadQueue } from '@/context/DownloadQueueContext';
import MeeARaiBrand from './MeeARaiBrand';

export default function HeaderNav() {
  const { queue } = useDownloadQueue();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: any) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstallable(false);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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
    <header className="mee-pdf-header sticky top-0 z-10">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <MeeARaiBrand appName="PDF Studio" accentColor="#22d3ee" />
          <Link href="/" className="mee-pdf-home-link" aria-label="Home">Home</Link>
          <Link href="/downloads" className="mee-pdf-header-control flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition">
            <span className="mee-pdf-queue-icon" aria-hidden="true">📥</span><span className="mee-pdf-queue-label hidden sm:inline">คิวไฟล์เอกสาร</span><span className="mee-pdf-queue-label sm:hidden">คิว</span>
            {queue.length > 0 && (
              <span className="mee-pdf-queue-badge flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-white animate-pulse">
                {queue.length}
              </span>
            )}
          </Link>
          {isInstallable && (
            <button onClick={handleInstallClick} className="mee-pdf-install-control flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-sm transition animate-pulse cursor-pointer">
              📲 <span className="mee-pdf-install-label hidden sm:inline">ติดตั้งแอป</span><span className="mee-pdf-install-label sm:hidden">ติดตั้ง</span>
            </button>
          )}
        </div>
        <span className="hidden shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-500 md:flex">🔒 Client-side PDF tools</span>
      </div>
    </header>
  );
}
