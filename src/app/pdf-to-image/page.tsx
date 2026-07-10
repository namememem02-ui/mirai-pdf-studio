'use client';

import React, { useState } from 'react';
import JSZip from 'jszip';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';

interface PageImage {
  page: number;
  url: string;      // object URL for preview/download
  blob: Blob;
}

export default function PdfToImagePage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<PageImage[]>([]);

  const pick = (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('กรุณาเลือกไฟล์ PDF'); return; }
    setError(null);
    images.forEach((im) => URL.revokeObjectURL(im.url));
    setImages([]);
    setFile(f);
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
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
    } catch (e) {
      setError('แปลงไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไฟล์อาจเสียหายหรือถูกล็อก'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const downloadZip = async () => {
    if (!file || images.length === 0) return;
    const zip = new JSZip();
    for (const im of images) {
      zip.file(`${baseName(file.name)}_page${im.page}.png`, im.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `${baseName(file.name)}_images.zip`, 'application/zip');
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <PageHeader icon="📸" title="PDF → รูปภาพ" description="แปลงทุกหน้าเป็นรูป PNG ความละเอียดสูง" />

      <div className="space-y-4">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวาง หรือคลิกเลือก'}
          onFiles={pick}
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {progress && <p className="text-blue-600 text-sm">{progress}</p>}

        <ActionButton onClick={convert} disabled={!file} busy={busy}>
          📸 แปลงเป็นรูปภาพ
        </ActionButton>

        {images.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-green-600 text-sm">✅ แปลงสำเร็จ {images.length} หน้า</p>
              <button
                onClick={downloadZip}
                className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-gray-700"
              >
                💾 ดาวน์โหลดทั้งหมด (ZIP)
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((im) => (
                <a
                  key={im.page}
                  href={im.url}
                  download={`${baseName(file!.name)}_page${im.page}.png`}
                  className="bg-white border border-gray-200 rounded-lg p-2 hover:shadow-md transition text-center"
                  title="คลิกเพื่อดาวน์โหลดหน้านี้"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt={`หน้า ${im.page}`} className="w-full rounded border border-gray-100" />
                  <span className="text-xs text-gray-500 mt-1 block">หน้า {im.page} ⬇</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
