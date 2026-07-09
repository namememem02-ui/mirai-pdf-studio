'use client';

import React, { useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';
import { useDownloadQueue } from '@/context/DownloadQueueContext';

interface PageThumbnail {
  index: number;
  url: string;
}

export default function RotatePage() {
  const { addToQueue } = useDownloadQueue();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<PageThumbnail[]>([]);
  const [rotations, setRotations] = useState<Record<number, number>>({}); // page index -> rotation angle (0, 90, 180, 270)
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const pick = async (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('กรุณาเลือกไฟล์ PDF');
      return;
    }
    setError(null);
    setDone(false);
    setFile(f);
    setPages([]);
    setRotations({});
    setBusy(true);
    setProgress('กำลังโหลดไฟล์ PDF...');

    try {
      const buffer = await f.arrayBuffer();
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ data: buffer }).promise;
      const count = doc.numPages;
      setPageCount(count);

      const thumbnails: PageThumbnail[] = [];
      const initialRotations: Record<number, number> = {};

      for (let i = 0; i < count; i++) {
        setProgress(`กำลังสร้างรูปตัวอย่างหน้า ${i + 1} จาก ${count}...`);
        const page = await doc.getPage(i + 1);
        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        thumbnails.push({
          index: i,
          url: canvas.toDataURL(),
        });
        initialRotations[i] = 0;
      }

      setPages(thumbnails);
      setRotations(initialRotations);
    } catch (err) {
      setError('เปิดไฟล์ไม่ได้ ไฟล์อาจเสียหายหรือถูกล็อก');
      setFile(null);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const rotateSinglePage = (index: number) => {
    setDone(false);
    setRotations((prev) => ({
      ...prev,
      [index]: ((prev[index] || 0) + 90) % 360,
    }));
  };

  const rotateAllPages = (angle: number) => {
    setDone(false);
    const next: Record<number, number> = {};
    for (let i = 0; i < pageCount; i++) {
      next[i] = ((rotations[i] || 0) + angle) % 360;
    }
    setRotations(next);
  };

  const rotatePdf = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      for (let i = 0; i < pageCount; i++) {
        const angle = rotations[i] || 0;
        if (angle !== 0) {
          const page = doc.getPage(i);
          page.setRotation(degrees((page.getRotation().angle + angle) % 360));
        }
      }
      const outName = `${baseName(file.name)}_rotated.pdf`;
      const outBytes = await doc.save();
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      addToQueue(outName, blob);
      downloadBlob(outBytes, outName);
      setDone(true);
    } catch (e) {
      setError('หมุนหน้าไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader icon="🔄" title="หมุนหน้า PDF" description="หมุนทุกหน้า หรือเลือกหมุนเฉพาะบางหน้าแบบเห็นหน้าพรีวิวภาพจริง" />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} (${pageCount} หน้า) — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวาง หรือคลิกเลือก'}
          onFiles={pick}
        />

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
        {progress && (
          <div className="text-blue-600 text-sm flex items-center gap-2 font-medium bg-blue-50 p-3 rounded-lg">
            <span className="animate-spin text-lg">⏳</span>
            {progress}
          </div>
        )}

        {file && pages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <span className="text-sm font-bold text-gray-700">หมุนไฟล์ร่วมกัน:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => rotateAllPages(90)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition"
                >
                  🔄 หมุนทุกหน้า +90°
                </button>
                <button
                  onClick={() => rotateAllPages(180)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition"
                >
                  🔄 กลับทุกหน้า 180°
                </button>
                <button
                  onClick={() => rotateAllPages(270)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition"
                >
                  🔄 หมุนทุกหน้า -90°
                </button>
                <button
                  onClick={() => {
                    const reset: Record<number, number> = {};
                    for (let i = 0; i < pageCount; i++) reset[i] = 0;
                    setRotations(reset);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  ↩️ รีเซ็ตทั้งหมด
                </button>
              </div>
            </div>

            {/* Thumbnail Preview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pages.map((p) => (
                <div
                  key={p.index}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col items-center relative group hover:shadow-md transition"
                >
                  <div className="w-full aspect-[3/4] overflow-hidden flex items-center justify-center bg-white border border-gray-100 rounded-lg relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`หน้า ${p.index + 1}`}
                      className="max-w-full max-h-full object-contain transition-transform duration-200"
                      style={{ transform: `rotate(${rotations[p.index] || 0}deg)` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 mt-2 font-semibold">หน้า {p.index + 1}</span>
                  {rotations[p.index] !== 0 && (
                    <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded mt-0.5">
                      หมุน {rotations[p.index]}°
                    </span>
                  )}
                  <button
                    onClick={() => rotateSinglePage(p.index)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow-md transition-opacity cursor-pointer active:scale-95"
                    title="คลิกเพื่อหมุนหน้านี้ 90°"
                  >
                    🔄
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {done && <p className="text-green-600 text-sm font-semibold">✅ หมุนหน้าสำเร็จ — ดาวน์โหลดไฟล์หมุนเรียบร้อยแล้ว!</p>}

        <ActionButton onClick={rotatePdf} disabled={!file || busy} busy={busy}>
          🔄 ดาวน์โหลดไฟล์ PDF ที่หมุนแล้ว
        </ActionButton>
      </div>
    </main>
  );
}
