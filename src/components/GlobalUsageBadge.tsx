'use client';

import React, { useEffect, useState } from 'react';
import {
  getCachedUsage,
  fetchGlobalUsage,
  formatUsageCount,
  USAGE_UPDATED_EVENT,
} from '@/lib/usage';

export default function GlobalUsageBadge() {
  const [total, setTotal] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 1. อ่านแคชในเครื่องทันที (Zero loading flash)
    const cached = getCachedUsage();
    if (cached) {
      setTotal(cached.total);
    }

    // 2. ดึงค่ายอดรวมล่าสุดจากเซิร์ฟเวอร์
    fetchGlobalUsage().then((fresh) => {
      setTotal(fresh.total);
    });

    // 3. รับ Event เมื่อมีเครื่องมือประมวลผลสำเร็จ
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ data?: { total?: number } }>;
      if (typeof customEvent.detail?.data?.total === 'number') {
        setTotal(customEvent.detail.data.total);
      }
    };

    window.addEventListener(USAGE_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(USAGE_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      title={`ยอดการประมวลผลเอกสารสะสมทั้งหมดของทุกคน: ${total.toLocaleString('th-TH')} ครั้ง`}
      className="fixed bottom-4 right-4 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md hover:shadow-lg transition-all rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs text-slate-700 select-none pointer-events-auto"
    >
      <span className="flex h-2 w-2 relative" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="font-medium text-slate-500 text-[11px]">ประมวลผลสะสม:</span>
      <span className="font-black text-slate-900 tabular-nums">
        {formatUsageCount(total)} ครั้ง
      </span>
    </div>
  );
}
