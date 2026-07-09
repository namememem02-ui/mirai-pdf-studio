'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PDFPreviewModal from '@/components/PDFPreviewModal';

interface EraserInstance {
  id: string;
  pageIndex: number;
  x: number; // HTML viewport center x
  y: number; // HTML viewport center y
  width: number; // HTML viewport width
  height: number; // HTML viewport height
  color: string; // Hex color code
  renderedWidth: number;
  renderedHeight: number;
}

interface EditablePageProps {
  pageNumber: number;
  pdfDoc: any;
  eraserInstances: EraserInstance[];
  activeColor: string;
  onAddEraser: (
    pageIndex: number,
    x: number,
    y: number,
    width: number,
    height: number,
    renderedWidth: number,
    renderedHeight: number
  ) => void;
  onUpdateWidth: (id: string, width: number) => void;
  onUpdateHeight: (id: string, height: number) => void;
  onUpdateColor: (id: string, color: string) => void;
  onDeleteEraser: (id: string) => void;
  onStartDrag: (e: React.MouseEvent, id: string) => void;
}

function EditablePage({
  pageNumber,
  pdfDoc,
  eraserInstances,
  activeColor,
  onAddEraser,
  onUpdateWidth,
  onUpdateHeight,
  onUpdateColor,
  onDeleteEraser,
  onStartDrag,
}: EditablePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);

  // States for click & drag rectangle drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    let active = true;
    const renderPage = async () => {
      setLoading(true);
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.25 });
        if (!active) return;
        setDimensions({ width: viewport.width, height: viewport.height });

        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        setLoading(false);
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };
    renderPage();

    return () => {
      active = false;
    };
  }, [pdfDoc, pageNumber]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent starting a draw if clicking on existing stamps / control popovers
    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    setIsDrawing(true);
    setStartPos({ x: startX, y: startY });
    setDrawRect({ x: startX, y: startY, width: 0, height: 0 });

    const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX - rect.left;
      const currentY = moveEvent.clientY - rect.top;

      // Constrain within page boundaries
      const boundedX = Math.max(0, Math.min(rect.width, currentX));
      const boundedY = Math.max(0, Math.min(rect.height, currentY));

      const x = Math.min(startX, boundedX);
      const y = Math.min(startY, boundedY);
      const w = Math.abs(boundedX - startX);
      const h = Math.abs(boundedY - startY);

      setDrawRect({ x, y, width: w, height: h });
    };

    const handleGlobalMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);

      setIsDrawing(false);
      setStartPos(null);
      setDrawRect(null);

      const finalRect = rect;
      const endX = upEvent.clientX - finalRect.left;
      const endY = upEvent.clientY - finalRect.top;

      const boundedEndX = Math.max(0, Math.min(finalRect.width, endX));
      const boundedEndY = Math.max(0, Math.min(finalRect.height, endY));

      const w = Math.abs(boundedEndX - startX);
      const h = Math.abs(boundedEndY - startY);

      const x = Math.min(startX, boundedEndX);
      const y = Math.min(startY, boundedEndY);

      if (w < 6 && h < 6) {
        // It's a simple click! Place a default eraser (100x25) centered at click
        onAddEraser(pageNumber - 1, startX, startY, 100, 25, finalRect.width, finalRect.height);
      } else {
        // Place drag-drawn box
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        onAddEraser(pageNumber - 1, centerX, centerY, w, h, finalRect.width, finalRect.height);
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  };

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-gray-400 mb-2 font-semibold">หน้าที่ {pageNumber}</span>
      <div
        className="relative border border-gray-300 bg-white shadow-md select-none mb-8 cursor-crosshair"
        style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
        onMouseDown={handleMouseDown}
      >
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

        {loading && (
          <div className="absolute inset-0 bg-gray-50/50 flex items-center justify-center text-xs text-gray-500">
            ⏳ กำลังโหลดกระดาษ...
          </div>
        )}

        {/* Real-time Drawing Box Preview Overlay */}
        {isDrawing && drawRect && (
          <div
            className="absolute border border-dashed border-yellow-500 z-50 pointer-events-none"
            style={{
              left: `${drawRect.x}px`,
              top: `${drawRect.y}px`,
              width: `${drawRect.width}px`,
              height: `${drawRect.height}px`,
              backgroundColor: activeColor,
              opacity: 0.65,
            }}
          />
        )}

        {eraserInstances.map((inst) => (
          <div
            key={inst.id}
            className="absolute border border-dashed border-gray-400 cursor-move group z-20"
            style={{
              left: `${inst.x}px`,
              top: `${inst.y}px`,
              width: `${inst.width}px`,
              height: `${inst.height}px`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: inst.color,
              boxShadow: '0 0 2px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => onStartDrag(e, inst.id)}
          >
            {/* Visual Indicator of Eraser Color to distinguish from background */}
            <div className="absolute inset-0 border border-white/30 pointer-events-none flex items-center justify-center">
              <span className="text-[8px] font-bold text-gray-400 opacity-0 group-hover:opacity-100 select-none bg-white/80 px-1 py-0.5 rounded shadow">
                ยางลบ
              </span>
            </div>

            {/* Eraser Controls Overlay */}
            <div
              className="absolute left-1/2 bottom-full mb-2.5 -translate-x-1/2 bg-white border border-gray-200 shadow-2xl rounded-xl p-3 flex flex-col gap-2.5 z-30 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition pointer-events-auto w-56"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block border-b border-gray-100 pb-1">
                🧼 ปรับปรุงกล่องลบคำ
              </span>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium">
                  <span>ความกว้าง: {inst.width}px</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="350"
                  value={inst.width}
                  onChange={(e) => onUpdateWidth(inst.id, parseInt(e.target.value) || 10)}
                  className="w-full h-1 bg-gray-200 rounded-lg cursor-pointer accent-yellow-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium">
                  <span>ความสูง: {inst.height}px</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="150"
                  value={inst.height}
                  onChange={(e) => onUpdateHeight(inst.id, parseInt(e.target.value) || 10)}
                  className="w-full h-1 bg-gray-250 rounded-lg cursor-pointer accent-yellow-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-gray-50 pt-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={inst.color}
                    onChange={(e) => onUpdateColor(inst.id, e.target.value)}
                    className="w-6 h-6 p-0 border border-gray-300 rounded cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-400 uppercase font-mono">{inst.color}</span>
                </div>
                <button
                  onClick={() => onDeleteEraser(inst.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 hover:bg-red-50 rounded"
                >
                  ✕ ลบกรอบ
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EraseTextPage() {
  const { addToQueue, queue, downloadItem } = useDownloadQueue();

  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [eraserInstances, setEraserInstances] = useState<EraserInstance[]>([]);

  // Eraser Color settings
  const [activeColor, setActiveColor] = useState('#ffffff'); // Default: White (to match white backgrounds)
  const [eyeDropperSupported, setEyeDropperSupported] = useState(false);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  // Check browser EyeDropper API support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      setEyeDropperSupported(true);
    }
  }, []);

  const pick = async (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('กรุณาเลือกไฟล์ PDF');
      return;
    }
    setError(null);
    setDone(false);
    setFile(f);
    setEraserInstances([]);
    setBusy(true);
    setProgress('กำลังโหลดไฟล์ PDF...');

    try {
      const buffer = await f.arrayBuffer();
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ data: buffer.slice(0) }).promise;
      setPdfDoc(doc);
      setPageCount(doc.numPages);
    } catch (err) {
      setError('เปิดไฟล์ไม่ได้ ไฟล์อาจเสียหายหรือถูกล็อก');
      setFile(null);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const handleAddEraser = (
    pageIndex: number,
    x: number,
    y: number,
    width: number,
    height: number,
    rWidth: number,
    rHeight: number
  ) => {
    const newInst: EraserInstance = {
      id: `eraser-${Date.now()}-${Math.random()}`,
      pageIndex,
      x,
      y,
      width,
      height,
      color: activeColor,
      renderedWidth: rWidth,
      renderedHeight: rHeight,
    };

    setEraserInstances((prev) => [...prev, newInst]);
    setDone(false);
  };

  const handleUpdateWidth = (id: string, width: number) => {
    setEraserInstances((prev) =>
      prev.map((inst) => (inst.id === id ? { ...inst, width } : inst))
    );
    setDone(false);
  };

  const handleUpdateHeight = (id: string, height: number) => {
    setEraserInstances((prev) =>
      prev.map((inst) => (inst.id === id ? { ...inst, height } : inst))
    );
    setDone(false);
  };

  const handleUpdateColor = (id: string, color: string) => {
    setEraserInstances((prev) =>
      prev.map((inst) => (inst.id === id ? { ...inst, color } : inst))
    );
    setDone(false);
  };

  const handleDeleteEraser = (id: string) => {
    setEraserInstances((prev) => prev.filter((inst) => inst.id !== id));
    setDone(false);
  };

  const handleStartDrag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const inst = eraserInstances.find((s) => s.id === id);
    if (!inst) return;
    const initialX = inst.x;
    const initialY = inst.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const nextX = Math.max(0, Math.min(inst.renderedWidth, initialX + dx));
      const nextY = Math.max(0, Math.min(inst.renderedHeight, initialY + dy));

      setEraserInstances((prev) =>
        prev.map((s) => (s.id === id ? { ...s, x: nextX, y: nextY } : s))
      );
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Launch EyeDropper to pick background color
  const launchEyeDropper = async () => {
    if (!eyeDropperSupported) return;
    try {
      const eyeDropper = new (window as any).EyeDropper();
      const result = await eyeDropper.open();
      setActiveColor(result.sRGBHex);
      setError(null);
    } catch (err) {
      console.warn('EyeDropper closed or failed:', err);
    }
  };

  const savePdf = async () => {
    if (!file) return;
    if (eraserInstances.length === 0) {
      setError('กรุณาคลิกเพื่อสร้างกรอบยางลบถมปิดทับข้อความเดิมอย่างน้อย 1 จุด');
      return;
    }

    setBusy(true);
    setProgress('กำลังประมวลผลวาดกรอบถมสีปิดทับข้อความเดิม (ยางลบ)...');
    setError(null);
    setDone(false);
    setResultItemId(null);

    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });

      for (const inst of eraserInstances) {
        const page = doc.getPage(inst.pageIndex);
        const { width, height } = page.getSize();

        // Convert Hex to rgb
        const cleanHex = inst.color.replace('#', '');
        const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
        const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

        // Bounding box mapping (HTML center coordinates translation)
        const sigLeft = inst.x - inst.width / 2;
        const sigTop = inst.y - inst.height / 2;

        const pdfX = (sigLeft / inst.renderedWidth) * width;
        const pdfY = ((inst.renderedHeight - sigTop - inst.height) / inst.renderedHeight) * height;
        const pdfWidth = (inst.width / inst.renderedWidth) * width;
        const pdfHeight = (inst.height / inst.renderedHeight) * height;

        // Draw filled rectangle over the page content
        page.drawRectangle({
          x: pdfX,
          y: pdfY,
          width: pdfWidth,
          height: pdfHeight,
          color: rgb(r, g, b),
          borderColor: rgb(r, g, b),
          borderWidth: 0,
        });
      }

      const outName = `${baseName(file.name)}_redacted.pdf`;
      const outBytes = await doc.save();
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const id = addToQueue(outName, blob);
      setResultItemId(id);
      setDone(true);
    } catch (err) {
      setError('บันทึกลบรอยข้อความไม่สำเร็จ: ' + (err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader
        icon="🧼"
        title="ลบข้อความ PDF (ลบคำเดิม)"
        description="ลบคำ พิมพ์ทับ หรือเซ็นเซอร์รอยข้อความเดิมบน PDF โดยการวาดกล่องถมสีทับ (สีเริ่มต้นคือสีขาว) เลือกสีกลมกลืนกับกระดาษเดิมได้ด้วยเครื่องมือดูดสี"
      />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวางที่นี่ หรือคลิกเพื่ออัปโหลดไฟล์ที่จะทำการลบข้อความ'}
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Eraser Color Control Sidebar */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-4 space-y-5 shadow-sm">
              <span className="text-sm font-bold text-gray-700 block border-b border-gray-100 pb-2">
                ⚙️ ตั้งค่าสีกล่องลบ/ถม
              </span>

              {/* standard palettes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">จานสียางลบด่วน</label>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { name: 'สีขาว', value: '#ffffff', border: 'border-gray-300' },
                    { name: 'สีดำ', value: '#000000', border: 'border-black' },
                    { name: 'สีเทาอ่อน', value: '#f3f4f6', border: 'border-gray-200' },
                    { name: 'สีครีม', value: '#faf8f5', border: 'border-gray-200' },
                  ]).map((colorItem) => (
                    <button
                      key={colorItem.value}
                      onClick={() => setActiveColor(colorItem.value)}
                      className={`h-9 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer relative ${
                        colorItem.border
                      } ${activeColor === colorItem.value ? 'ring-2 ring-yellow-400 font-bold scale-95' : 'hover:scale-105'}`}
                      style={{ backgroundColor: colorItem.value }}
                      title={colorItem.name}
                    >
                      {activeColor === colorItem.value && (
                        <span className="text-[10px] mix-blend-difference text-white font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Picker and EyeDropper */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-600">สีที่กำหนดเอง</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={activeColor}
                      onChange={(e) => setActiveColor(e.target.value)}
                      className="w-8 h-8 p-0 border border-gray-300 rounded cursor-pointer border-none bg-transparent"
                    />
                    <span className="text-xs font-mono uppercase text-gray-500">{activeColor}</span>
                  </div>
                </div>

                {eyeDropperSupported && (
                  <button
                    onClick={launchEyeDropper}
                    className="w-full py-2 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 text-yellow-800 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    🎨 ดูดสีตรงจากหน้าจอ (สีพื้นหลัง)
                  </button>
                )}
              </div>

              <div className="text-[10px] text-gray-400 bg-gray-50 p-2.5 rounded-lg border border-gray-150 leading-relaxed">
                💡 **วิธีการใช้งานให้แนบเนียน**: 
                หากสีเอกสารไม่ใช่สีขาวล้วน (กระดาษแสกนเหลือง/เทา) ให้กดปุ่ม **ดูดสีตรงจากหน้าจอ** แล้วนำกล้องขยายไปแตะดูดสีเนื้อกระดาษใกล้ตัวอักษรเพื่อคัดลอกรหัสสีที่เนียนที่สุดมาถมทับ
              </div>
            </div>

            {/* Stamping Grid pages preview */}
            <div className="lg:col-span-8 flex flex-col items-center">
              <div className="w-full bg-yellow-50 text-yellow-800 rounded-lg p-3.5 border border-yellow-100 text-xs font-semibold text-center mb-5 shadow-sm leading-relaxed">
                <p>👉 **คลิกค้างแล้วลากเมาส์** บนหน้ากระดาษเพื่อ **ตีกรอบสี่เหลี่ยมยางลบ** ขนาดตามต้องการทันที (หรือคลิกเฉย ๆ เพื่อวางกล่องขนาดมาตรฐาน 100x25 ก็ได้เช่นกัน)</p>
              </div>

              <div className="w-full max-h-[750px] overflow-y-auto pr-2 space-y-4">
                {Array.from({ length: pageCount }, (_, i) => (
                  <EditablePage
                    key={i}
                    pageNumber={i + 1}
                    pdfDoc={pdfDoc}
                    eraserInstances={eraserInstances.filter((s) => s.pageIndex === i)}
                    activeColor={activeColor}
                    onAddEraser={handleAddEraser}
                    onUpdateWidth={handleUpdateWidth}
                    onUpdateHeight={handleUpdateHeight}
                    onUpdateColor={handleUpdateColor}
                    onDeleteEraser={handleDeleteEraser}
                    onStartDrag={handleStartDrag}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {done && resultItemId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
            <span className="text-4xl block">🎉</span>
            <h3 className="font-bold text-emerald-800 text-sm">ลบลายข้อความสำเร็จแล้ว!</h3>
            <p className="text-xs text-emerald-600">ตรวจสอบความเรียบร้อยของยางลบผ่านพรีวิวก่อนเปิดดาวน์โหลดลงเครื่องได้ทันที</p>
            
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

        <ActionButton onClick={savePdf} disabled={!file || eraserInstances.length === 0 || busy} busy={busy}>
          🧼 เริ่มถมลบข้อความ PDF
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
