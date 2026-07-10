'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PDFPreviewModal from '@/components/PDFPreviewModal';

type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export default function WatermarkPage() {
  const { addToQueue, queue, downloadItem } = useDownloadQueue();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  // Watermark Settings
  const [text, setText] = useState('DRAFT');
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState('#ff0000');
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(45);
  const [position, setPosition] = useState<WatermarkPosition>('center');

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
      const doc = await pdfjs.getDocument({
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/cmaps/',
        cMapPacked: true, data: buffer }).promise;
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

  const getPositionStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
      transformOrigin: 'center center',
      color: color,
      opacity: opacity,
      fontSize: `${fontSize}px`,
      fontWeight: 'bold',
      fontFamily: 'sans-serif',
    };

    switch (position) {
      case 'top-left':
        return { ...base, left: '20%', top: '15%' };
      case 'top-center':
        return { ...base, left: '50%', top: '15%' };
      case 'top-right':
        return { ...base, left: '80%', top: '15%' };
      case 'center-left':
        return { ...base, left: '20%', top: '50%' };
      case 'center':
        return { ...base, left: '50%', top: '50%' };
      case 'center-right':
        return { ...base, left: '80%', top: '50%' };
      case 'bottom-left':
        return { ...base, left: '20%', top: '85%' };
      case 'bottom-center':
        return { ...base, left: '50%', top: '85%' };
      case 'bottom-right':
        return { ...base, left: '80%', top: '85%' };
      default:
        return base;
    }
  };

  const addWatermark = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress('กำลังปั๊มลายน้ำลงบนเอกสาร...');

    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      // Fetch local Sarabun-Bold font to support Thai characters
      let fontBytes: ArrayBuffer | null = null;
      try {
        const res = await fetch('/fonts/Sarabun-Bold.ttf');
        if (res.ok) {
          fontBytes = await res.arrayBuffer();
        }
      } catch (err) {
        console.warn('Failed to load local Sarabun-Bold font, fallback to Helvetica', err);
      }

      doc.registerFontkit(fontkit);
      const font = fontBytes
        ? await doc.embedFont(fontBytes, { subset: true })
        : await doc.embedFont(StandardFonts.HelveticaBold);

      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;

      const pageCount = doc.getPageCount();
      for (let i = 0; i < pageCount; i++) {
        const page = doc.getPage(i);
        const { width, height } = page.getSize();

        // Calculate approximate text size in PDF points
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const textHeight = fontSize;

        let x = 0;
        let y = 0;

        switch (position) {
          case 'top-left':
            x = 40;
            y = height - textHeight - 40;
            break;
          case 'top-center':
            x = (width - textWidth) / 2;
            y = height - textHeight - 40;
            break;
          case 'top-right':
            x = width - textWidth - 40;
            y = height - textHeight - 40;
            break;
          case 'center-left':
            x = 40;
            y = (height - textHeight) / 2;
            break;
          case 'center':
            x = (width - textWidth) / 2;
            y = (height - textHeight) / 2;
            break;
          case 'center-right':
            x = width - textWidth - 40;
            y = (height - textHeight) / 2;
            break;
          case 'bottom-left':
            x = 40;
            y = 40;
            break;
          case 'bottom-center':
            x = (width - textWidth) / 2;
            y = 40;
            break;
          case 'bottom-right':
            x = width - textWidth - 40;
            y = 40;
            break;
        }

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(r, g, b),
          opacity: opacity,
          rotate: degrees(rotation),
        });
      }

      const outName = `${baseName(file.name)}_watermarked.pdf`;
      const outBytes = await doc.save();
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const id = addToQueue(outName, blob);
      setResultItemId(id);
      setDone(true);
    } catch (err) {
      setError('ปั๊มลายน้ำไม่สำเร็จ: ' + (err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader icon="✍️" title="ใส่ลายน้ำ PDF" description="เพิ่มข้อความลายน้ำลงบนทุกหน้าของเอกสาร ปรับตำแหน่ง ความจาง สี และมุมหมุนพร้อมตัวอย่างสด" />

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
                ⚙️ ตั้งค่าลายน้ำ
              </span>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ข้อความลายน้ำ</label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setDone(false);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">ขนาดตัวอักษร</label>
                  <input
                    type="number"
                    value={fontSize}
                    onChange={(e) => {
                      setFontSize(parseInt(e.target.value) || 24);
                      setDone(false);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">สีอักษร</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        setDone(false);
                      }}
                      className="w-8 h-8 p-0 border border-gray-300 rounded cursor-pointer"
                    />
                    <span className="text-xs uppercase text-gray-500">{color}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  ความโปร่งแสง (Opacity): {Math.round(opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => {
                    setOpacity(parseFloat(e.target.value));
                    setDone(false);
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  มุมหมุน: {rotation}°
                </label>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  value={rotation}
                  onChange={(e) => {
                    setRotation(parseInt(e.target.value));
                    setDone(false);
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ตำแหน่งวางลายน้ำ</label>
                <div className="grid grid-cols-3 gap-1">
                  {([
                    'top-left',
                    'top-center',
                    'top-right',
                    'center-left',
                    'center',
                    'center-right',
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
              <span className="text-xs text-gray-400 mb-2 font-semibold">👀 ตัวอย่างหน้าแรก (First Page Preview)</span>
              <div
                className="relative border border-gray-300 shadow-md bg-white overflow-hidden"
                style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
              >
                <canvas ref={canvasRef} />
                
                {/* Visual Watermark Overlay */}
                <div style={getPositionStyles()}>{text}</div>
              </div>
            </div>
          </div>
        )}

        {done && resultItemId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
            <span className="text-4xl block">🎉</span>
            <h3 className="font-bold text-emerald-800 text-sm">ใส่ลายน้ำลงบนเอกสาร PDF สำเร็จแล้ว!</h3>
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

        <ActionButton onClick={addWatermark} disabled={!file || busy} busy={busy}>
          ✍️ เริ่มประมวลผลใส่ลายน้ำ PDF
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
