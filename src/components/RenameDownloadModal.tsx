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

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <form
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => { event.preventDefault(); confirm(); }}
      >
        <h2 className="text-lg font-bold text-gray-800">ตั้งชื่อไฟล์ก่อนดาวน์โหลด</h2>
        <p className="mt-1 text-xs text-gray-500">ตรวจสอบหรือแก้ชื่อไฟล์ แล้วกดดาวน์โหลด</p>
        <div className="mt-5 flex items-center overflow-hidden rounded-lg border border-gray-300 focus-within:border-blue-500">
          <input autoFocus value={stem} onChange={(event) => setStem(event.target.value)} className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none" aria-label="ชื่อไฟล์" />
          <span className="border-l bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-500">{initial.extension || 'ไม่มีนามสกุล'}</span>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm font-bold text-gray-600">ยกเลิก</button>
          <button type="submit" disabled={!safeStem} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">ดาวน์โหลด</button>
        </div>
      </form>
    </div>
  );
}
