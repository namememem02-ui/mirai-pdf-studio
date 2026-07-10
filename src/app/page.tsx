'use client';

import React, { useState } from 'react';
import { TOOLS } from '@/lib/tools';
import ToolCard from '@/components/ToolCard';

interface ToolCategory {
  title: string;
  icon: string;
  description: string;
  ids: string[];
}

const CATEGORIES: ToolCategory[] = [
  {
    title: 'แก้ไขและเซ็นชื่อ (Edit & Sign)',
    icon: '✍️',
    description: 'เขียนข้อความ ยางลบลบคำเดิม เซ็นลายมือ หรือประทับตราลายน้ำ',
    ids: ['add-text', 'signature', 'watermark'],
  },
  {
    title: 'จัดการหน้ากระดาษ (Page Management)',
    icon: '📄',
    description: 'รวมไฟล์ แยกหน้าเอกสาร สลับลำดับหน้า หมุนกระดาษ หรือใส่เลขหน้า',
    ids: ['merge', 'split', 'organize', 'rotate', 'page-number'],
  },
  {
    title: 'แปลงไฟล์และถอดข้อมูล (Conversion & OCR)',
    icon: '🔄',
    description: 'แปลงรูปภาพเป็น PDF, แปลงหน้า PDF เป็นไฟล์รูปภาพ, ดึงข้อความ OCR หรือบีบอัดขนาดไฟล์',
    ids: ['image-to-pdf', 'pdf-to-image', 'extract-text', 'compress'],
  },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');

  const query = searchQuery.trim().toLowerCase();

  // Match keyword filters
  const filteredTools = TOOLS.filter((tool) => {
    if (!query) return true;
    return (
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query)
    );
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="text-center mb-10 space-y-3">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 tracking-tight">
          🛠️ เครื่องมือจัดการ PDF ครบวงจร
        </h1>
        <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
          รันตรงในเครื่องคุณ 100% ไฟล์ปลอดภัย ไม่ต้องอัปโหลดขึ้นเซิร์ฟเวอร์ สะดวก รวดเร็ว และเป็นส่วนตัว
        </p>

        {/* Real-time Search input */}
        <div className="max-w-md mx-auto pt-4 relative">
          <input
            type="text"
            placeholder="🔍 ค้นหาเครื่องมือ เช่น รวมไฟล์, ลบข้อความ, เซ็นชื่อ, OCR..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-300 rounded-full px-5 py-2.5 text-xs focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 shadow-sm transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕ ล้าง
            </button>
          )}
        </div>
      </div>

      <div className="space-y-10">
        {CATEGORIES.map((cat) => {
          const catTools = filteredTools.filter((t) => cat.ids.includes(t.id));
          if (catTools.length === 0) return null;

          return (
            <div key={cat.title} className="space-y-4">
              <div className="border-b border-gray-200 pb-2 flex items-baseline gap-2">
                <span className="text-base">{cat.icon}</span>
                <h2 className="text-sm font-bold text-gray-800">{cat.title}</h2>
                <span className="text-[10px] text-gray-400">({cat.description})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {catTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </div>
          );
        })}

        {filteredTools.length === 0 && (
          <div className="text-center py-10 text-xs text-gray-400 font-medium">
            🔍 ไม่พบเครื่องมือที่ตรงกับคำค้นหาของคุณ
          </div>
        )}
      </div>
    </main>
  );
}
