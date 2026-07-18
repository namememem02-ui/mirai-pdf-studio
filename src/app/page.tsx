'use client';

import React, { useState, useEffect } from 'react';
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
    title: 'แก้ไขเนื้อหาและสิทธิ์ความปลอดภัย (Edit & Secure)',
    icon: '✍️',
    description: 'เขียนและลบข้อความเดิม ปั๊มลายเซ็น ปั๊มลายน้ำ หรือล็อกรหัสผ่านเอกสารป้องกันสิทธิ์',
    ids: ['add-text', 'signature', 'watermark', 'protect'],
  },
  {
    title: 'จัดเรียงลำดับและหน้าเอกสาร (Page Layout & Margins)',
    icon: '📄',
    description: 'รวมไฟล์ แยกทุกหน้า ตัดหน้าที่ไม่ต้องการ ลบ/แทรกจัดลำดับหน้า หมุนกระดาษ หรือแสตมป์เลขหน้า',
    ids: ['merge', 'split-pages', 'split', 'organize', 'rotate', 'page-number'],
  },
  {
    title: 'แปลงไฟล์และถอดอักษรภาษาไทย (Convert & OCR)',
    icon: '🔄',
    description: 'แปลงรูปภาพเป็น PDF, แปลงหน้า PDF เป็นไฟล์รูปภาพ, บีบอัดขนาดไฟล์, แปลง Excel เป็น PDF, แปลง PDF เป็น Excel หรือถอดตัวอักษรภาพสแกน OCR',
    ids: ['image-to-pdf', 'pdf-to-image', 'extract-text', 'compress', 'excel-to-pdf', 'pdf-to-excel'],
  },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');

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
    <main className="max-w-5xl mx-auto px-4 py-12 space-y-12">
      
      {/* Official Hero Section */}
      <div className="text-center space-y-6">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold tracking-wider uppercase shadow-sm">
            ✨ Professional Web Application
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Mee-a-rai PDF Studio
          </h1>
          <p className="text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
            สตูดิโอจัดการเอกสาร PDF ความปลอดภัยสูง ประมวลผลและเข้ารหัสเสร็จสรรพในเครื่องคอมพิวเตอร์ของคุณ 100% โดยไม่ต้องอัปโหลดขึ้นเซิร์ฟเวอร์
          </p>
        </div>

        {/* Unique Selling Points (USP) Banner - Formal & Sleek */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto pt-4 text-left">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 shadow-sm hover:shadow transition">
            <span className="text-2xl text-slate-700 select-none">🔒</span>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-800">ข้อมูลปลอดภัย 100% (Client-Side)</h3>
              <p className="text-[10px] text-slate-500 leading-normal">
                เอกสารถูกประมวลผลบนเครื่องของคุณเท่านั้น ไฟล์ไม่ผ่านอินเทอร์เน็ตหรือคลาวด์ ป้องกันการรั่วไหลเด็ดขาด
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 shadow-sm hover:shadow transition">
            <span className="text-2xl text-slate-700 select-none">🔌</span>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-800">รองรับระบบออฟไลน์ (PWA Ready)</h3>
              <p className="text-[10px] text-slate-500 leading-normal">
                ติดตั้งเป็นโปรแกรมลงบนเครื่องคอมพิวเตอร์หรือโทรศัพท์มือถือ เพื่อเรียกใช้งานได้ทันทีแม้ไม่มีเน็ต
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3 shadow-sm hover:shadow transition">
            <span className="text-2xl text-slate-700 select-none">⚡</span>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-800">ประมวลผลทันที ไร้ค่าเซิร์ฟเวอร์</h3>
              <p className="text-[10px] text-slate-500 leading-normal">
                ไม่ต้องรอต่อคิวส่งขึ้นคลาวด์ ประมวลผลเร็วกว่าด้วยกำลังประมวลผลในเครื่อง และใช้งานได้ฟรีโดยไม่มีข้อจำกัด
              </p>
            </div>
          </div>
        </div>

        {/* PWA Install Banner */}
        {isInstallable && (
          <div className="max-w-xl mx-auto bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn text-left">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-pink-400 uppercase tracking-widest block">⭐ แนะนำการติดตั้ง</span>
              <h3 className="text-sm font-bold">ติดตั้งโปรแกรม Mee-a-rai PDF Studio ลงเครื่อง</h3>
              <p className="text-[10px] text-slate-400 leading-normal">
                เพื่อเรียกใช้งานด่วนผ่านไอคอนหน้าจอเดสก์ท็อป/โทรศัพท์มือถือ และรันเอกสารแบบออฟไลน์ไร้เน็ตได้สมบูรณ์แบบ
              </p>
            </div>
            <button
              onClick={handleInstallClick}
              className="px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-xs font-extrabold text-white rounded-xl shadow transition cursor-pointer select-none whitespace-nowrap active:scale-95"
            >
              📲 กดติดตั้งแอปด่วน
            </button>
          </div>
        )}

        {/* Real-time Search input */}
        <div className="max-w-md mx-auto pt-4 relative">
          <input
            type="text"
            placeholder="🔍 พิมพ์คำค้นหาเครื่องมือ เช่น รวมไฟล์, ลบข้อความ, เซ็นชื่อ, บีบอัด, ล็อกรหัสผ่าน..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-slate-300 rounded-full px-5 py-2.5 text-xs focus:outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-900/10 shadow-sm bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕ ล้าง
            </button>
          )}
        </div>
      </div>

      {/* Grid Categories */}
      <div className="space-y-12">
        {CATEGORIES.map((cat) => {
          const catTools = filteredTools.filter((t) => cat.ids.includes(t.id));
          if (catTools.length === 0) return null;

          return (
            <div key={cat.title} className="space-y-4 animate-fadeIn">
              <div className="border-l-4 border-slate-800 pl-3 pb-0.5 flex items-baseline gap-2">
                <span className="text-sm">{cat.icon}</span>
                <h2 className="text-xs font-extrabold text-slate-950 tracking-tight">{cat.title}</h2>
                <span className="text-[10px] text-slate-400 font-medium">({cat.description})</span>
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
          <div className="text-center py-12 text-xs text-slate-400 font-medium">
            🔍 ไม่พบชุดเครื่องมือที่เกี่ยวข้องกับคำค้นหาของคุณ
          </div>
        )}
      </div>
    </main>
  );
}
