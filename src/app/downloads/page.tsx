'use client';

import React, { useState } from 'react';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PageHeader from '@/components/PageHeader';
import PDFPreviewModal from '@/components/PDFPreviewModal';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'เมื่อสักครู่';
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

export default function DownloadsPage() {
  const { queue, removeFromQueue, clearQueue, downloadItem, downloadAll } = useDownloadQueue();
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <PageHeader
          icon="📥"
          title="คิวดาวน์โหลดประวัติงาน"
          description="รายการผลลัพธ์ไฟล์ PDF ทั้งหมดที่คุณสร้างเสร็จ — สามารถตรวจสอบ เห็นหน้าพรีวิวก่อนดาวน์โหลดจริงลงเครื่อง"
        />

        {queue.length > 0 && (
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={downloadAll}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              📥 ดาวน์โหลดทั้งหมด ({queue.length})
            </button>
            <button
              onClick={() => {
                if (confirm('คุณต้องการล้างคิวประวัติและไฟล์ทั้งหมดใช่หรือไม่?')) clearQueue();
              }}
              className="flex items-center gap-1 border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer bg-white"
            >
              🗑️ ล้างคิวทั้งหมด
            </button>
          </div>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <span className="text-3xl text-gray-300">📥</span>
          </div>
          <p className="font-bold text-gray-500 text-sm">ยังไม่มีไฟล์ในคิว</p>
          <p className="text-xs text-gray-400 mt-1">ไฟล์ที่คุณสั่งประมวลผลเสร็จในเมนูต่าง ๆ จะถูกเก็บไว้ที่นี่ชั่วคราว</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {queue.map((item) => (
            <div key={item.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors group">
              <span className="text-3xl">📄</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-gray-800 truncate" title={item.filename}>
                    {item.filename}
                  </span>
                  <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                    {item.fileExt}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                  <span>{formatSize(item.size)}</span>
                  <span>·</span>
                  <span>{formatTime(item.createdAt)}</span>
                </div>
              </div>

              {/* Actions panel */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewItem(item)}
                  className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-blue-100 transition cursor-pointer bg-white"
                  title="ดูตัวอย่างก่อนดาวน์โหลด"
                >
                  👁️ พรีวิว
                </button>
                <button
                  onClick={() => downloadItem(item.id)}
                  className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  title="ดาวน์โหลดลงเครื่อง"
                >
                  📥 โหลด
                </button>
                <button
                  onClick={() => removeFromQueue(item.id)}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer border-none bg-transparent"
                  title="ลบออก"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warning Alert Note */}
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 text-xs font-medium">
        ⚠️ หมายเหตุ: ไฟล์ในคิวนี้จะคงอยู่ชั่วคราวบนเว็บเบราว์เซอร์ หากคุณทำการรีเฟรชหน้าเว็บหรือปิดหน้าต่างเบราว์เซอร์ ไฟล์ในหน่วยความจำเหล่านี้จะถูกล้างออกโดยอัตโนมัติ กรุณาดาวน์โหลดเก็บไว้ลงเครื่องก่อนปิดการทำงาน
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <PDFPreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onDownload={() => {
            downloadItem(previewItem.id);
            setPreviewItem(null);
          }}
        />
      )}
    </main>
  );
}
