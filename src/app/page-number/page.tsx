'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PDFPreviewModal from '@/components/PDFPreviewModal';

type NumberPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export default function PageNumberPage() {
  const { addToQueue, queue, downloadItem } = useDownloadQueue();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  // Settings
  const [format, setFormat] = useState('{page} / {total}');
  const [position, setPosition] = useState<NumberPosition>('bottom-center');
  const [fontSize, setFontSize] = useState(11);
  const [startPage, setStartPage] = useState(1); // skip cover page if set to 2

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pick = async (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('กรุณาเลือกไฟล์ PDF');
      return;
    }
    setError(null);
    setDone(false);
    setFile(f);
    setBusy(true);
    setProgress('กำลังโหลดไฟล์ PDF...');

    try {
      const buffer = await f.arrayBuffer();
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ data: buffer }).promise;
      setPdfDoc(doc);
      setPageCount(doc.numPages);

      // Render 1st page preview
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });
      setDimensions({ width: viewport.width, height: viewport.height });

      setTimeout(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
      }, 50);
    } catch (err) {
      setError('เปิดไฟล์ไม่ได้ ไฟล์อาจเสียหายหรือถูกล็อก');
      setFile(null);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const getFormatText = (pageNum: number) => {
    return format
      .replace('{page}', String(pageNum))
      .replace('{total}', String(pageCount));
  };

  const getPositionStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      pointerEvents: 'none',
      color: '#4b5563', // gray-600
      fontSize: `${fontSize}px`,
      fontFamily: 'sans-serif',
    };

    switch (position) {
      case 'top-left':
        return { ...base, left: '20px', top: '15px' };
      case 'top-center':
        return { ...base, left: '50%', top: '15px', transform: 'translateX(-50%)' };
      case 'top-right':
        return { ...base, right: '20px', top: '15px' };
      case 'bottom-left':
        return { ...base, left: '20px', bottom: '15px' };
      case 'bottom-center':
        return { ...base, left: '50%', bottom: '15px', transform: 'translateX(-50%)' };
      case 'bottom-right':
        return { ...base, right: '20px', bottom: '15px' };
      default:
        return base;
    }
  };

  const addPageNumbers = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress('กำลังคำนวณและปั๊มหมายเลขหน้าลงบนกระดาษ...');

    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);

      const total = doc.getPageCount();
      for (let i = 0; i < total; i++) {
        const pageNum = i + 1;
        // Skip page numbering if current page is less than startPage
        if (pageNum < startPage) continue;

        const page = doc.getPage(i);
        const { width, height } = page.getSize();

        const label = format
          .replace('{page}', String(pageNum))
          .replace('{total}', String(total));

        const textWidth = font.widthOfTextAtSize(label, fontSize);
        const textHeight = fontSize;

        let x = 0;
        let y = 0;
        const margin = 30; // Margin from page boundary in points

        switch (position) {
          case 'top-left':
            x = margin;
            y = height - textHeight - margin;
            break;
          case 'top-center':
            x = (width - textWidth) / 2;
            y = height - textHeight - margin;
            break;
          case 'top-right':
            x = width - textWidth - margin;
            y = height - textHeight - margin;
            break;
          case 'bottom-left':
            x = margin;
            y = margin;
            break;
          case 'bottom-center':
            x = (width - textWidth) / 2;
            y = margin;
            break;
          case 'bottom-right':
            x = width - textWidth - margin;
            y = margin;
            break;
        }

        page.drawText(label, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.2, 0.2, 0.2), // Dark grey
        });
      }

      const outName = `${baseName(file.name)}_numbered.pdf`;
      const outBytes = await doc.save();
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const id = addToQueue(outName, blob);
      setResultItemId(id);
      setDone(true);
    } catch (err) {
      setError('ปั๊มเลขหน้าไม่สำเร็จ: ' + (err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader icon="🔢" title="ใส่เลขหน้า PDF" description="พิมพ์หมายเลขหน้าลงบนทุกหน้าของเอกสาร ปรับรูปแบบตำแหน่งได้ตามต้องการ (เลือกเว้นไม่ปั๊มหน้าปกได้)" />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
          onFiles={pick}
        />

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
        {progress && (
          <div className="text-blue-600 text-sm flex items-center gap-2 font-medium bg-blue-50 p-3 rounded-lg">
            <span className="animate-spin text-lg">⏳</span>
            {progress}
          </div>
        )}

        {file && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Settings panel */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 md:col-span-5 space-y-4 shadow-sm">
              <span className="text-sm font-bold text-gray-700 block border-b border-gray-100 pb-2">
                ⚙️ ตั้งค่าหมายเลขหน้า
              </span>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">รูปแบบฟอร์แมตเลขหน้า</label>
                <div className="space-y-1.5 font-mono text-xs">
                  {([
                    { label: '1, 2, 3 (ตัวเลขธรรมดา)', value: '{page}' },
                    { label: '1 / 5 (สแลชตัวรวม)', value: '{page} / {total}' },
                    { label: 'Page 1 (ระบุหน้า)', value: 'Page {page}' },
                    { label: 'Page 1 of 5 (ระบุหน้าทั้งหมด)', value: 'Page {page} of {total}' },
                  ]).map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50">
                      <input
                        type="radio"
                        name="format"
                        checked={format === opt.value}
                        onChange={() => {
                          setFormat(opt.value);
                          setDone(false);
                        }}
                        className="cursor-pointer"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ขนาดตัวอักษร</label>
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => {
                    setFontSize(parseInt(e.target.value) || 10);
                    setDone(false);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  เริ่มปั๊มเลขหน้าตั้งแต่หน้านี้ (หน้าแรก = 1)
                </label>
                <input
                  type="number"
                  min="1"
                  max={pageCount}
                  value={startPage}
                  onChange={(e) => {
                    setStartPage(Math.max(1, parseInt(e.target.value) || 1));
                    setDone(false);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="เช่น ใส่เลข 2 เพื่อเว้นไม่เขียนหน้าปก"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  ใส่เลข 2 หากต้องการละเว้น/ไม่พิมพ์เลขหน้าลงบนหน้าแรก (หน้าปก)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ตำแหน่งหมายเลขหน้า</label>
                <div className="grid grid-cols-3 gap-1">
                  {([
                    'top-left',
                    'top-center',
                    'top-right',
                    'bottom-left',
                    'bottom-center',
                    'bottom-right',
                  ] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => {
                        setPosition(pos);
                        setDone(false);
                      }}
                      className={`py-1.5 border rounded-lg text-[10px] font-semibold transition ${
                        position === pos
                          ? 'border-blue-500 bg-blue-50 text-blue-600 font-bold'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      {pos.replace('-', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview panel */}
            <div className="md:col-span-7 flex flex-col items-center">
              <span className="text-xs text-gray-400 mb-2 font-semibold">👀 ตัวอย่างตำแหน่งเลขหน้า (หน้าแรก)</span>
              <div
                className="relative border border-gray-300 shadow-md bg-white overflow-hidden"
                style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
              >
                <canvas ref={canvasRef} />
                
                {/* Visual Overlay */}
                {startPage === 1 && (
                  <div style={getPositionStyles()}>{getFormatText(1)}</div>
                )}
                {startPage > 1 && (
                  <div className="absolute inset-x-0 bottom-4 text-center text-[10px] text-gray-400 bg-gray-50/80 py-1">
                    ⚠️ หน้าแรกเว้นการใส่เลขตามตัวเลือก (จะเริ่มพิมพ์ตั้งแต่หน้า {startPage})
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {done && resultItemId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
            <span className="text-4xl block">🎉</span>
            <h3 className="font-bold text-emerald-800 text-sm">ใส่เลขหน้าลงบนเอกสาร PDF สำเร็จแล้ว!</h3>
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

        <ActionButton onClick={addPageNumbers} disabled={!file || busy} busy={busy}>
          🔢 เริ่มประมวลผลใส่หมายเลขหน้า PDF
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
