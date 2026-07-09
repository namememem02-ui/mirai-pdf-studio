'use client';

import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob } from '@/lib/pdf';

interface MergeItem {
  file: File;
  thumbnail: string;
}

export default function MergePage() {
  const [items, setItems] = useState<MergeItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const addFiles = async (incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length < incoming.length) {
      setError('ข้ามไฟล์ที่ไม่ใช่ PDF ให้แล้ว');
    } else {
      setError(null);
    }
    setDone(false);
    setBusy(true);
    setProgress('กำลังโหลดหน้าตัวอย่างไฟล์...');

    try {
      const pdfjs = await getPdfjs();
      const newItems: MergeItem[] = [];

      for (const f of pdfs) {
        setProgress(`กำลังอ่านไฟล์ ${f.name}...`);
        const buffer = await f.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buffer }).promise;
        let thumbnail = '';

        if (doc.numPages > 0) {
          const page = await doc.getPage(1);
          const viewport = page.getViewport({ scale: 0.3 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          thumbnail = canvas.toDataURL();
        }

        newItems.push({ file: f, thumbnail });
      }

      setItems((prev) => [...prev, ...newItems]);
    } catch (err) {
      setError('มีไฟล์บางไฟล์เปิดไม่ได้เนื่องจากเสียหายหรือเข้ารหัสลับอยู่');
    } finally {
      setBusy(false);
      setProgress('');
    }
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

  const remove = (i: number) => setItems((prev) => prev.filter((_, k) => k !== i));

  const merge = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await PDFDocument.create();
      for (const item of items) {
        const src = await PDFDocument.load(await item.file.arrayBuffer(), { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      downloadBlob(await out.save(), 'merged.pdf');
      setDone(true);
    } catch (e) {
      setError('รวมไฟล์ไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไฟล์อาจเสียหายหรือถูกล็อก'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader icon="🗂️" title="รวม PDF" description="เลือกหลายไฟล์ จัดลำดับลากเลื่อนย้ายหน้าพรีวิว แล้วรวมเป็นไฟล์เดียว" />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          multiple
          label="ลากไฟล์ PDF มาวาง หรือคลิกเลือก (เลือกได้หลายไฟล์)"
          hint="ลำดับไฟล์ = ลำดับหน้าในไฟล์ PDF ผลลัพธ์"
          onFiles={addFiles}
        />

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
        {progress && (
          <div className="text-blue-600 text-sm flex items-center gap-2 font-medium bg-blue-50 p-3 rounded-lg">
            <span className="animate-spin text-lg">⏳</span>
            {progress}
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-3">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">ลำดับคิวและตัวอย่างไฟล์:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {items.map((item, i) => (
                <div
                  key={`${item.file.name}-${i}`}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition relative group"
                >
                  <div className="flex flex-col items-center">
                    {/* Visual 1st page Thumbnail */}
                    <div className="w-24 h-32 bg-gray-50 border border-gray-100 rounded shadow-inner flex items-center justify-center overflow-hidden mb-3">
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnail} alt={`หน้า 1 ${item.file.name}`} className="max-w-full max-h-full object-contain" />
                      ) : (
                        <span className="text-xl text-gray-300">📄</span>
                      )}
                    </div>
                    
                    <p className="font-semibold text-xs text-gray-700 text-center line-clamp-2 w-full px-2" title={item.file.name}>
                      {i + 1}. {item.file.name}
                    </p>
                    <span className="text-[10px] text-gray-400 mt-1 font-semibold">
                      {(item.file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>

                  {/* Actions overlay panel */}
                  <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-gray-50">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="px-2 py-1 rounded border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                      title="ย้ายขึ้น"
                    >
                      ← ย้ายก่อนหน้า
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1}
                      className="px-2 py-1 rounded border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                      title="ย้ายลง"
                    >
                      ย้ายไปหลังสุด →
                    </button>
                    <button
                      onClick={() => remove(i)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-50 text-red-500 border border-red-100 flex items-center justify-center text-xs hover:bg-red-500 hover:text-white transition cursor-pointer active:scale-95"
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

        {done && <p className="text-green-600 text-sm font-semibold">✅ รวมไฟล์สำเร็จ — ดาวน์โหลดไฟล์เรียบร้อยแล้ว!</p>}

        <ActionButton onClick={merge} disabled={items.length < 2 || busy} busy={busy}>
          🗂️ ดาวน์โหลดไฟล์ PDF ที่รวมเรียบร้อย ({items.length} ไฟล์)
        </ActionButton>
        {items.length === 1 && <p className="text-center text-xs text-gray-400 mt-2">กรุณาเพิ่มอย่างน้อย 2 ไฟล์เพื่อรวมข้อมูล</p>}
      </div>
    </main>
  );
}
