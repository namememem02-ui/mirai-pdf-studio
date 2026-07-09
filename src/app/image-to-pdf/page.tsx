'use client';

import React, { useState, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { downloadBlob } from '@/lib/pdf';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PDFPreviewModal from '@/components/PDFPreviewModal';

interface ImageItem {
  file: File;
  url: string;
}

const OK_TYPES = ['image/jpeg', 'image/png'];

export default function ImageToPdfPage() {
  const { addToQueue, queue, downloadItem } = useDownloadQueue();
  const [items, setItems] = useState<ImageItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  // Clean up object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      items.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [items]);

  const addFiles = (incoming: File[]) => {
    const imgs = incoming.filter((f) => OK_TYPES.includes(f.type));
    if (imgs.length < incoming.length) {
      setError('รองรับเฉพาะ JPG และ PNG — ข้ามไฟล์ประเภทอื่นให้แล้ว');
    } else {
      setError(null);
    }
    setDone(false);

    const newItems = imgs.map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
    }));

    setItems((prev) => [...prev, ...newItems]);
  };

  const move = (i: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const remove = (i: number) => {
    const item = items[i];
    URL.revokeObjectURL(item.url);
    setItems((prev) => prev.filter((_, k) => k !== i));
  };

  const convert = async () => {
    setBusy(true);
    setError(null);
    setDone(false);
    setResultItemId(null);
    try {
      const doc = await PDFDocument.create();
      for (const item of items) {
        const bytes = await item.file.arrayBuffer();
        const img =
          item.file.type === 'image/png'
            ? await doc.embedPng(bytes)
            : await doc.embedJpg(bytes);
        const page = doc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      const outBytes = await doc.save();
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const id = addToQueue('images.pdf', blob);
      setResultItemId(id);
      setDone(true);
    } catch (e) {
      setError('แปลงไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไฟล์รูปอาจเสียหาย'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader icon="🖼️" title="รูปภาพ → PDF" description="แปลงรูปภาพ JPG / PNG หลายรูปเป็น PDF ไฟล์เดียว (1 รูป = 1 หน้า) พร้อมลากย้ายจัดลำดับหน้าได้อิสระ" />

      <div className="space-y-6">
        <FileDropzone
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          multiple
          label="ลากรูปภาพมาวาง หรือคลิกเลือก (JPG, PNG)"
          onFiles={addFiles}
        />

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}

        {items.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              จัดคิวลำดับรูปภาพ ({items.length} รูป):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map((item, i) => (
                <div
                  key={`${item.file.name}-${i}`}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col justify-between hover:shadow transition relative select-none"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-full aspect-[3/4] overflow-hidden flex items-center justify-center bg-white border border-gray-100 rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.file.name} className="max-w-full max-h-full object-contain" />
                    </div>
                    <p className="font-semibold text-[10px] text-gray-600 mt-2 text-center line-clamp-1 w-full" title={item.file.name}>
                      {i + 1}. {item.file.name}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 mt-3 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="px-2 py-1 rounded border border-gray-200 bg-white text-[10px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                    >
                      ← ซ้าย
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1}
                      className="px-2 py-1 rounded border border-gray-200 bg-white text-[10px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                    >
                      ขวา →
                    </button>
                    <button
                      onClick={() => remove(i)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-50 text-red-500 border border-red-100 flex items-center justify-center text-xs hover:bg-red-500 hover:text-white transition cursor-pointer active:scale-95"
                      title="นำออก"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {done && resultItemId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
            <span className="text-4xl block">🎉</span>
            <h3 className="font-bold text-emerald-800 text-sm">แปลงไฟล์รูปภาพเป็น PDF สำเร็จแล้ว!</h3>
            <p className="text-xs text-emerald-600">ตรวจสอบความถูกต้องผ่านพรีวิวก่อนเปิดดาวน์โหลดลงเครื่องได้ทันที</p>
            
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  const item = queue.find((q) => q.id === resultItemId);
                  if (item) setPreviewItem(item);
                }}
                className="px-4 py-2 border border-blue-200 bg-white hover:bg-blue-50 text-blue-600 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                👁️ พรีวิวไฟล์ผลลัพธ์
              </button>
              <button
                onClick={() => downloadItem(resultItemId)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                📥 ดาวน์โหลดไฟล์ทันที
              </button>
            </div>
          </div>
        )}

        <ActionButton onClick={convert} disabled={items.length === 0 || busy} busy={busy}>
          🖼️ เริ่มแปลงรูปภาพทั้งหมดเป็น PDF
        </ActionButton>
      </div>

      {previewItem && (
        <PDFPreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onDownload={() => downloadItem(previewItem.id)}
        />
      )}
    </main>
  );
}
