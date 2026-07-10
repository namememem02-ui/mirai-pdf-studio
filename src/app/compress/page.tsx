'use client';

import React, { useState } from 'react';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PDFPreviewModal from '@/components/PDFPreviewModal';

type CompressionMode = 'image-stream' | 'structural' | 'rasterize';

export default function CompressPage() {
  const { addToQueue, queue, downloadItem } = useDownloadQueue();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Settings
  const [mode, setMode] = useState<CompressionMode>('image-stream');
  const [imageQuality, setImageQuality] = useState(0.7); // 0.1 to 1.0
  const [rasterizeScale, setRasterizeScale] = useState(1.2); // 0.8 to 2.0

  // Result info
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  const pick = (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('กรุณาเลือกไฟล์ PDF');
      return;
    }
    setError(null);
    setDone(false);
    setFile(f);
    setOriginalSize(f.size);
    setResultItemId(null);
  };

  // Helper to format bytes to human readable string
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper to compress raw JPEG bytes using browser canvas
  const compressJpegBytes = (bytes: Uint8Array, quality: number): Promise<Uint8Array> => {
    const blob = new Blob([bytes] as any, { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (compressedBlob) => {
            if (!compressedBlob) {
              resolve(bytes);
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(new Uint8Array(reader.result as ArrayBuffer));
            };
            reader.readAsArrayBuffer(compressedBlob);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(bytes); // Fallback
      };
      img.src = url;
    });
  };

  const handleCompress = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(false);
    setProgress('กำลังอ่านไฟล์เอกสารและเตรียมวิเคราะห์โครงสร้าง...');

    try {
      let finalBytes: Uint8Array;

      if (mode === 'rasterize') {
        // Mode 3: Rasterize all pages into images and rebuild PDF
        setProgress('กำลังเตรียมเครื่องมือถอดภาพสีกระดาษ...');
        const pdfjs = await getPdfjs();
        const docPdfjs = await pdfjs.getDocument({
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          data: await file.arrayBuffer(),
        }).promise;

        const outDoc = await PDFDocument.create();
        const count = docPdfjs.numPages;

        for (let p = 1; p <= count; p++) {
          setProgress(`กำลังแปลงหน้ากระดาษที่ ${p} จาก ${count} เป็นภาพสแกน...`);
          const page = await docPdfjs.getPage(p);
          const viewport = page.getViewport({ scale: rasterizeScale });
          
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport }).promise;

          // Compress to JPEG
          const jpegBytes = await new Promise<Uint8Array>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Canvas to blob failed'));
                  return;
                }
                const reader = new FileReader();
                reader.onloadend = () => {
                  resolve(new Uint8Array(reader.result as ArrayBuffer));
                };
                reader.readAsArrayBuffer(blob);
              },
              'image/jpeg',
              imageQuality
            );
          });

          const embeddedImage = await outDoc.embedJpg(jpegBytes);
          const newPage = outDoc.addPage([embeddedImage.width, embeddedImage.height]);
          newPage.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: embeddedImage.width,
            height: embeddedImage.height,
          });
        }

        setProgress('กำลังประมวลผลจัดเก็บไฟล์ระดับสูง...');
        finalBytes = await outDoc.save({ useObjectStreams: true });

      } else {
        // Mode 1 & 2: Modify existing PDF structure
        const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
        const context = doc.context;

        if (mode === 'image-stream') {
          // Re-compress DCTDecode (JPEG) images
          const indirectObjects = context.enumerateIndirectObjects();
          let imageCount = 0;

          for (const [ref, obj] of indirectObjects) {
            if (obj instanceof PDFRawStream) {
              const dict = obj.dict;
              const subtype = dict.get(PDFName.of('Subtype'));
              if (subtype === PDFName.of('Image')) {
                imageCount++;
                const filter = dict.get(PDFName.of('Filter'));
                if (filter === PDFName.of('DCTDecode')) {
                  setProgress(`กำลังบีบอัดรูปภาพประกอบชิ้นที่ ${imageCount} ในเอกสาร...`);
                  const originalBytes = obj.contents;
                  try {
                    const compressedBytes = await compressJpegBytes(originalBytes, imageQuality);
                    if (compressedBytes.length < originalBytes.length) {
                      dict.set(PDFName.of('Length'), context.obj(compressedBytes.length));
                      const newStream = PDFRawStream.of(dict, compressedBytes);
                      context.assign(ref, newStream);
                    }
                  } catch (e) {
                    console.warn('Failed to compress image stream:', e);
                  }
                }
              }
            }
          }
        }

        setProgress('กำลังจัดเรียงออบเจกต์และจัดเก็บโครงสร้างบีบอัด...');
        finalBytes = await doc.save({ useObjectStreams: true });
      }

      setCompressedSize(finalBytes.length);
      const outName = `${baseName(file.name)}_compressed.pdf`;
      const blob = new Blob([finalBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const id = addToQueue(outName, blob);
      setResultItemId(id);
      setDone(true);
    } catch (e) {
      setError('การบีบอัดไฟล์ล้มเหลว: ' + (e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const savingsPercent = originalSize > 0 ? Math.round(((originalSize - compressedSize) / originalSize) * 100) : 0;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <PageHeader
        icon="📉"
        title="บีบอัดไฟล์ PDF (Compress PDF)"
        description="ลดขนาดไฟล์เอกสาร PDF ให้เล็กลงโดยการย่อสเกลภาพและบีบอัดคุณภาพรูปภาพประกอบ หรือจัดระเบียบโครงสร้างข้อมูลภายใน"
      />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} (${formatSize(originalSize)}) — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวางที่นี่ หรือคลิกเพื่ออัปโหลดไฟล์ที่จะบีบอัด'}
          onFiles={pick}
        />

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
        
        {progress && (
          <div className="text-blue-600 text-sm flex items-center gap-2 font-medium bg-blue-50 p-3.5 rounded-xl border border-blue-100 shadow-sm animate-pulse">
            <span className="animate-spin text-lg">⏳</span>
            {progress}
          </div>
        )}

        {file && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-5">
            <span className="text-xs font-bold text-gray-700 block border-b border-gray-100 pb-2">
              ⚙️ ตั้งค่าความเข้มข้นการบีบอัด
            </span>

            {/* Mode selection cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setMode('image-stream')}
                className={`p-3 border rounded-xl text-left transition flex flex-col justify-between cursor-pointer ${
                  mode === 'image-stream'
                    ? 'border-pink-500 bg-pink-50/40 ring-1 ring-pink-500'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-800 block">🖼️ บีบอัดภาพประกอบในหน้า</span>
                  <p className="text-[10px] text-gray-400 leading-normal">
                    ย่อคุณภาพรูปถ่าย/ภาพประกอบภายในหน้ากระดาษลง แต่ยังคงเก็บความคมชัดและเลือกคัดลอกตัวอักษรได้เหมือนเดิม
                  </p>
                </div>
                <span className="text-[9px] text-pink-600 font-bold mt-3 block">แนะนำสำหรับเอกสารทั่วไป</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('structural')}
                className={`p-3 border rounded-xl text-left transition flex flex-col justify-between cursor-pointer ${
                  mode === 'structural'
                    ? 'border-pink-500 bg-pink-50/40 ring-1 ring-pink-500'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-800 block">⬜ บีบอัดโครงสร้างปลอดภัย</span>
                  <p className="text-[10px] text-gray-400 leading-normal">
                    จัดระเบียบโครงสร้างออบเจกต์และ Metadata ภายในโดยไม่มีการย่อคุณภาพรูปภาพใดๆ (ลดขนาดได้น้อยกว่า)
                  </p>
                </div>
                <span className="text-[9px] text-pink-600 font-bold mt-3 block">คุณภาพรูปภาพคมชัด 100%</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('rasterize')}
                className={`p-3 border rounded-xl text-left transition flex flex-col justify-between cursor-pointer ${
                  mode === 'rasterize'
                    ? 'border-pink-500 bg-pink-50/40 ring-1 ring-pink-500'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-800 block">📄 บีบอัดแบบสแกนรูปหน้า</span>
                  <p className="text-[10px] text-gray-400 leading-normal">
                    แปลงทุกหน้ากระดาษเป็นรูปถ่าย JPEG เพื่อลดขนาดขั้นสุดและแบนเอกสาร (ตัวหนังสือจะกลายเป็นรูปภาพ เลือกคัดลอกไม่ได้)
                  </p>
                </div>
                <span className="text-[9px] text-pink-600 font-bold mt-3 block">ลดขนาดได้มหาศาลที่สุด</span>
              </button>
            </div>

            {/* Slider parameters depending on mode */}
            {mode !== 'structural' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    คุณภาพของรูปถ่าย (Quality): {Math.round(imageQuality * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.3"
                    max="0.9"
                    step="0.05"
                    value={imageQuality}
                    onChange={(e) => setImageQuality(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-pink-600"
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    *ค่ายิ่งน้อยไฟล์ยิ่งเล็กมาก แต่อาจเกิดลายแตกเบลอบนภาพถ่าย
                  </span>
                </div>

                {mode === 'rasterize' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      ความละเอียดหน้าสแกน (Resolution): {rasterizeScale}x
                    </label>
                    <input
                      type="range"
                      min="0.8"
                      max="1.6"
                      step="0.1"
                      value={rasterizeScale}
                      onChange={(e) => setRasterizeScale(parseFloat(e.target.value))}
                      className="w-full cursor-pointer accent-pink-600"
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      *สเกลสแกนภาพหน้ากระดาษ 1.2x เป็นสัดส่วนมาตรฐานที่เหมาะสม
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <ActionButton onClick={handleCompress} disabled={!file || busy} busy={busy}>
          📉 เริ่มบีบอัดไฟล์ PDF
        </ActionButton>

        {done && resultItemId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
            <span className="text-4xl block">🎉</span>
            <h3 className="font-bold text-emerald-800 text-sm">บีบอัดไฟล์ PDF สำเร็จแล้ว!</h3>
            
            <div className="max-w-xs mx-auto bg-white border border-emerald-100 rounded-xl p-3 shadow-sm grid grid-cols-2 gap-2 text-left">
              <div>
                <span className="text-[10px] text-gray-400 block font-semibold uppercase">ขนาดไฟล์เดิม</span>
                <span className="text-xs font-bold text-gray-700">{formatSize(originalSize)}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block font-semibold uppercase">ขนาดไฟล์ใหม่</span>
                <span className="text-xs font-bold text-emerald-600">{formatSize(compressedSize)}</span>
              </div>
              <div className="col-span-2 border-t border-gray-100 pt-1.5 mt-1 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-semibold">เปอร์เซ็นต์ที่ลดลง:</span>
                <span className="text-xs font-extrabold text-emerald-700">
                  {savingsPercent > 0 ? `📉 ลดลง -${savingsPercent}%` : 'ไม่มีความแตกต่าง'}
                </span>
              </div>
            </div>

            <p className="text-xs text-emerald-600">ตรวจสอบความถูกต้องผ่านหน้าต่างพรีวิวก่อนดาวน์โหลดลงเครื่องได้ทันที</p>
            
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
