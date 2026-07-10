'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EraseTextRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/add-text');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-xs text-gray-500 font-semibold">
      <div className="flex items-center gap-2">
        <span className="animate-spin text-lg">⏳</span>
        <span>กำลังย้ายการทำงานไปยังห้องเครื่องมือแก้ไขเขียนและลบข้อความ PDF...</span>
      </div>
    </div>
  );
}
