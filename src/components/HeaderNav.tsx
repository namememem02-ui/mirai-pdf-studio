'use client';

import Link from 'next/link';
import { useDownloadQueue } from '@/context/DownloadQueueContext';

export default function HeaderNav() {
  const { queue } = useDownloadQueue();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-800">
            <span className="text-2xl">📄</span> PDF Support
          </Link>
          
          {/* Downloads Queue Link with Badge */}
          <Link
            href="/downloads"
            className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-xs font-bold px-2.5 py-1.5 rounded-lg text-gray-700 border border-gray-200/80 transition"
          >
            📥 คิวไฟล์
            {queue.length > 0 && (
              <span className="w-4.5 h-4.5 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                {queue.length}
              </span>
            )}
          </Link>
        </div>

        <span className="text-xs text-gray-400 hidden sm:block">
          🔒 ประมวลผลในเครื่องคุณ 100% — ไฟล์ไม่ถูกอัปโหลด
        </span>
      </div>
    </header>
  );
}
