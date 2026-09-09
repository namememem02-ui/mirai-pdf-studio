'use client';

import React, { useEffect, useState } from 'react';
import { sanitizeStem, splitFilename } from '@/lib/download';

interface Props {
  filename: string;
  onCancel: () => void;
  onConfirm: (filename: string) => void;
}

export default function RenameDownloadModal({ filename, onCancel, onConfirm }: Props) {
  const initial = splitFilename(filename);
  const [stem, setStem] = useState(initial.stem);
  const safeStem = sanitizeStem(stem);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const confirm = () => {
    if (safeStem) onConfirm(`${safeStem}${initial.extension}`);
  };

  // รองรับการกดปุ่ม "วาง" ดึงข้อความจากคลิปบอร์ด
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        let clean = text.trim();
        const ext = initial.extension.toLowerCase();
        if (ext && clean.toLowerCase().endsWith(ext)) {
          clean = clean.slice(0, -ext.length);
        }
        setStem(clean);
      }
    } catch {
      // หากเบราว์เซอร์ไม่อนุญาต clipboard API ผู้ใช้ยังสามารถกด Ctrl+V ได้ตามปกติ
    }
  };

  // เมื่อผู้ใช้วางข้อความลงในช่อง input (Ctrl+V หรือคลิกขวา Paste) ให้ตัดนามสกุลซ้ำซ้อนออกให้อัตโนมัติ
  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const ext = initial.extension.toLowerCase();
    if (ext && text.trim().toLowerCase().endsWith(ext)) {
      e.preventDefault();
      const clean = text.trim().slice(0, -ext.length);
      setStem(clean);
    }
  };

  return (
    /* ไม่ใส่ onClick={onCancel} ที่ backdrop เพื่อป้องกันโมดอลปิดเองขณะสลับหน้าต่างไปก๊อปปี้ชื่อไฟล์ */
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4">
      <form
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl relative"
        onSubmit={(event) => {
          event.preventDefault();
          confirm();
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">ตั้งชื่อไฟล์ก่อนดาวน์โหลด</h2>
            <p className="mt-1 text-xs text-gray-500">ตรวจสอบหรือแก้ชื่อไฟล์ แล้วกดดาวน์โหลด</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition text-base leading-none cursor-pointer"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-center overflow-hidden rounded-lg border border-gray-300 focus-within:border-blue-500 bg-white">
            <input
              autoFocus
              value={stem}
              onChange={(event) => setStem(event.target.value)}
              onPaste={handleInputPaste}
              className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none"
              aria-label="ชื่อไฟล์"
              placeholder="ระบุชื่อไฟล์..."
            />
            {typeof navigator !== 'undefined' && 'clipboard' in navigator && (
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-l border-gray-200 transition cursor-pointer shrink-0"
                title="คลิกเพื่อวางชื่อจากคลิปบอร์ด"
              >
                📋 วาง
              </button>
            )}
            <span className="border-l bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-500 shrink-0">
              {initial.extension || 'ไม่มีนามสกุล'}
            </span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={!safeStem}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer shadow-sm"
          >
            ดาวน์โหลด
          </button>
        </div>
      </form>
    </div>
  );
}
