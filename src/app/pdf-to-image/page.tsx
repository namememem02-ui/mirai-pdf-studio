'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, baseName } from '@/lib/pdf';
import { createZipBlob } from '@/lib/download';
import { createStitchedLongImageBlob } from '@/lib/image-stitch';
import { useDownloadQueue } from '@/context/DownloadQueueContext';
import { recordToolUsage } from '@/lib/usage';

interface PageImage {
  page: number;
  url: string;      // object URL for preview/download
  blob: Blob;
}

export default function PdfToImagePage() {
  const { requestBlobDownload } = useDownloadQueue();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<PageImage[]>([]);
  const [longImageBlob, setLongImageBlob] = useState<Blob | null>(null);
  const [longImageUrl, setLongImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pages' | 'long'>('pages');

  // ทำความสะอาด object URL ป้องกัน memory leak
  useEffect(() => {
    return () => {
      images.forEach((im) => URL.revokeObjectURL(im.url));
      if (longImageUrl) URL.revokeObjectURL(longImageUrl);
    };
  }, [images, longImageUrl]);

  const pick = (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('กรุณาเลือกไฟล์ PDF'); return; }
    setError(null);
    images.forEach((im) => URL.revokeObjectURL(im.url));
    if (longImageUrl) URL.revokeObjectURL(longImageUrl);
    setImages([]);
    setLongImageBlob(null);
    setLongImageUrl(null);
    setActiveTab('pages');
    setFile(f);
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    if (longImageUrl) URL.revokeObjectURL(longImageUrl);
    setLongImageBlob(null);
    setLongImageUrl(null);

    try {
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({
        cMapUrl: '/cmaps/',
        cMapPacked: true, data: await file.arrayBuffer() }).promise;
      const out: PageImage[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        setProgress(`กำลังแปลงหน้า ${p} / ${doc.numPages}…`);
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render failed'))), 'image/png')
        );
        out.push({ page: p, blob, url: URL.createObjectURL(blob) });
      }
      setImages(out);

      // ต่อภาพทุกหน้าเป็นรูปเดียวยาวในแนวตั้ง
      if (out.length > 0) {
        setProgress('กำลังประมวลผลต่อภาพยาว...');
        try {
          const stitched = await createStitchedLongImageBlob(out);
          setLongImageBlob(stitched);
          setLongImageUrl(URL.createObjectURL(stitched));
        } catch (stitchErr) {
          console.warn('สร้างภาพเดียวยาวล้มเหลว:', stitchErr);
        }
      }

      recordToolUsage('pdf-to-image');
    } catch (e) {
      setError('แปลงไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไฟล์อาจเสียหายหรือถูกล็อก'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const downloadZip = async () => {
    if (!file || images.length === 0) return;
    const blob = await createZipBlob(images.map((im) => ({ filename: `${baseName(file.name)}_page${im.page}.png`, blob: im.blob })));
    requestBlobDownload(`${baseName(file.name)}_images.zip`, blob);
  };

  const downloadLongImage = () => {
    if (!file || !longImageBlob) return;
    requestBlobDownload(`${baseName(file.name)}_long_image.png`, longImageBlob);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <PageHeader icon="📸" title="PDF → รูปภาพ" description="แปลงทุกหน้าเป็นรูป PNG ความละเอียดสูง หรือต่อทุกหน้าเป็นรูปเดียวยาว" />

      <div className="space-y-4">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวาง หรือคลิกเลือก'}
          onFiles={pick}
        />

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
        {progress && <p className="text-blue-600 text-sm font-medium bg-blue-50 p-3 rounded-lg animate-pulse">⏳ {progress}</p>}

        <ActionButton onClick={convert} disabled={!file} busy={busy}>
          📸 แปลงเป็นรูปภาพ
        </ActionButton>

        {images.length > 0 && (
          <div className="space-y-4 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            {/* Header: จำนวนหน้าและปุ่มดาวน์โหลดหลัก */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <p className="text-emerald-700 text-sm font-bold flex items-center gap-1.5">
                <span>✅</span>
                <span>แปลงสำเร็จ {images.length} หน้า</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {longImageBlob && (
                  <button
                    onClick={downloadLongImage}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                    title="ดาวน์โหลดทุกหน้ารวมต่อกันเป็นรูปภาพเดียวยาวแนวตั้ง"
                  >
                    <span>📜</span>
                    <span>ดาวน์โหลดรูปเดียวยาว (PNG)</span>
                  </button>
                )}
                <button
                  onClick={downloadZip}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-white text-xs font-bold hover:bg-gray-700 transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                  title="ดาวน์โหลดแยกไฟล์ทุกหน้าเป็นไฟล์ ZIP"
                >
                  <span>💾</span>
                  <span>ดาวน์โหลดทั้งหมด (ZIP)</span>
                </button>
              </div>
            </div>

            {/* แท็บสลับมุมมอง */}
            <div className="flex items-center gap-2 border-b border-gray-150">
              <button
                type="button"
                onClick={() => setActiveTab('pages')}
                className={`px-3.5 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'pages'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>📑</span>
                <span>แยกรายหน้า ({images.length} หน้า)</span>
              </button>
              {longImageUrl && (
                <button
                  type="button"
                  onClick={() => setActiveTab('long')}
                  className={`px-3.5 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'long'
                      ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span>📜</span>
                  <span>ดูรูปเดียวยาว</span>
                </button>
              )}
            </div>

            {/* แสดงผลตามแท็บที่เลือก */}
            {activeTab === 'pages' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {images.map((im) => (
                  <button
                    key={im.page}
                    onClick={() => requestBlobDownload(`${baseName(file!.name)}_page${im.page}.png`, im.blob)}
                    className="bg-white border border-gray-200 rounded-lg p-2 hover:shadow-md hover:border-blue-300 transition text-center group cursor-pointer"
                    title="คลิกเพื่อดาวน์โหลดเฉพาะหน้านี้"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.url} alt={`หน้า ${im.page}`} className="w-full rounded border border-gray-100 shadow-inner group-hover:scale-[1.01] transition-transform" />
                    <span className="text-xs text-gray-500 mt-2 font-medium block group-hover:text-blue-600">
                      หน้า {im.page} ⬇
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col items-center space-y-3">
                <div className="w-full flex justify-between items-center text-xs text-slate-600 px-2 font-medium">
                  <span>📜 ภาพเดียวยาวต่อกันทุกหน้า (เลื่อนลงเพื่อดูต่อ)</span>
                  <button
                    onClick={downloadLongImage}
                    className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    📥 ดาวน์โหลดรูปนี้
                  </button>
                </div>
                <div className="max-h-[600px] overflow-y-auto w-full max-w-xl bg-white shadow-md rounded-lg p-2 border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={longImageUrl!}
                    alt="รูปเดียวยาว"
                    className="w-full h-auto block rounded"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
