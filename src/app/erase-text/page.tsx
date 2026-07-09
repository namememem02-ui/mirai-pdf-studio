'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument, rgb, LineCapStyle } from 'pdf-lib';
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

interface EraserLine {
  id: string;
  pageIndex: number;
  points: { x: number; y: number }[]; // HTML viewport points list
  thickness: number;
  color: string;
  renderedWidth: number;
  renderedHeight: number;
}

interface EditablePageProps {
  pageNumber: number;
  pdfDoc: any;
  eraserInstances: EraserInstance[];
  eraserLines: EraserLine[];
  activeColor: string;
  eraserMode: 'box' | 'pencil';
  brushThickness: number;
  selectedEraserId: string | null;
  onAddEraser: (
    pageIndex: number,
    x: number,
    y: number,
    width: number,
    height: number,
    renderedWidth: number,
    renderedHeight: number
  ) => void;
  onAddLine: (line: EraserLine) => void;
  onSelectEraser: (id: string) => void;
  onDeleteLine: (id: string) => void;
  onStartDrag: (e: React.MouseEvent, id: string) => void;
}

function EditablePage({
  pageNumber,
  pdfDoc,
  eraserInstances,
  eraserLines,
  activeColor,
  eraserMode,
  brushThickness,
  selectedEraserId,
  onAddEraser,
  onAddLine,
  onSelectEraser,
  onDeleteLine,
  onStartDrag,
}: EditablePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);

  // States for drawing interactions
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [pencilPoints, setPencilPoints] = useState<{ x: number; y: number }[]>([]);

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
    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    setIsDrawing(true);
    setStartPos({ x: startX, y: startY });

    if (eraserMode === 'box') {
      setDrawRect({ x: startX, y: startY, width: 0, height: 0 });
    } else {
      setPencilPoints([{ x: startX, y: startY }]);
    }

    const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX - rect.left;
      const currentY = moveEvent.clientY - rect.top;

      // Constrain within page boundaries
      const boundedX = Math.max(0, Math.min(rect.width, currentX));
      const boundedY = Math.max(0, Math.min(rect.height, currentY));

      if (eraserMode === 'box') {
        const x = Math.min(startX, boundedX);
        const y = Math.min(startY, boundedY);
        const w = Math.abs(boundedX - startX);
        const h = Math.abs(boundedY - startY);
        setDrawRect({ x, y, width: w, height: h });
      } else {
        setPencilPoints((prev) => [...prev, { x: boundedX, y: boundedY }]);
      }
    };

    const handleGlobalMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);

      setIsDrawing(false);
      setStartPos(null);

      if (eraserMode === 'box') {
        setDrawRect(null);

        const endX = upEvent.clientX - rect.left;
        const endY = upEvent.clientY - rect.top;
        const boundedEndX = Math.max(0, Math.min(rect.width, endX));
        const boundedEndY = Math.max(0, Math.min(rect.height, endY));

        const w = Math.abs(boundedEndX - startX);
        const h = Math.abs(boundedEndY - startY);
        const x = Math.min(startX, boundedEndX);
        const y = Math.min(startY, boundedEndY);

        if (w < 6 && h < 6) {
          // Default stamp
          onAddEraser(pageNumber - 1, startX, startY, 100, 25, rect.width, rect.height);
        } else {
          // Custom drag-draw
          const centerX = x + w / 2;
          const centerY = y + h / 2;
          onAddEraser(pageNumber - 1, centerX, centerY, w, h, rect.width, rect.height);
        }
      } else {
        // Complete freehand pencil stroke
        if (pencilPoints.length > 1) {
          onAddLine({
            id: `line-${Date.now()}-${Math.random()}`,
            pageIndex: pageNumber - 1,
            points: pencilPoints,
            thickness: brushThickness,
            color: activeColor,
            renderedWidth: rect.width,
            renderedHeight: rect.height,
          });
        }
        setPencilPoints([]);
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  };

  return (
    <div className="flex flex-col items-center select-none">
      <span className="text-xs text-gray-400 mb-2 font-semibold">หน้าที่ {pageNumber}</span>
      <div
        ref={containerRef}
        className={`relative border border-gray-300 bg-white shadow-md mb-8 ${
          eraserMode === 'pencil' ? 'cursor-pencil' : 'cursor-crosshair'
        }`}
        style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
        onMouseDown={handleMouseDown}
      >
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

        {loading && (
          <div className="absolute inset-0 bg-gray-50/50 flex items-center justify-center text-xs text-gray-500">
            ⏳ กำลังโหลดกระดาษ...
          </div>
        )}

        {/* Freehand SVG Overlay for compiled Lines */}
        <svg className="absolute inset-0 z-10 w-full h-full" style={{ pointerEvents: 'none' }}>
          {eraserLines.map((line) => (
            <polyline
              key={line.id}
              points={line.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={line.color}
              strokeWidth={line.thickness}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="hover:opacity-80 transition-opacity"
              style={{ pointerEvents: 'visibleStroke', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('ต้องการลบเส้นวาดดินสอนี้ใช่หรือไม่?')) {
                  onDeleteLine(line.id);
                }
              }}
            />
          ))}
          {/* Active drawing line preview */}
          {eraserMode === 'pencil' && isDrawing && pencilPoints.length > 0 && (
            <polyline
              points={pencilPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={activeColor}
              strokeWidth={brushThickness}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
          )}
        </svg>

        {/* Real-time Box Drawing Preview Overlay */}
        {eraserMode === 'box' && isDrawing && drawRect && (
          <div
            className="absolute border border-dashed border-yellow-500 z-20 pointer-events-none"
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

        {/* Rendered Eraser Boxes */}
        {eraserInstances.map((inst) => {
          const isSelected = selectedEraserId === inst.id;
          return (
            <div
              key={inst.id}
              className={`absolute border transition-shadow z-20 cursor-move ${
                isSelected
                  ? 'border-pink-500 ring-2 ring-pink-500/30 shadow-lg scale-[1.01]'
                  : 'border-dashed border-gray-400 hover:border-gray-600'
              }`}
              style={{
                left: `${inst.x}px`,
                top: `${inst.y}px`,
                width: `${inst.width}px`,
                height: `${inst.height}px`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: inst.color,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEraser(inst.id);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onStartDrag(e, inst.id);
                onSelectEraser(inst.id);
              }}
            />
          );
        })}
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
  const [eraserLines, setEraserLines] = useState<EraserLine[]>([]);

  // Action history for Undo
  const [actionHistory, setActionHistory] = useState<{ type: 'box' | 'line'; id: string }[]>([]);

  // Tool Modes
  const [eraserMode, setEraserMode] = useState<'box' | 'pencil'>('box');
  const [brushThickness, setBrushThickness] = useState(12);

  // Selected Box ID for properties sidebar panel
  const [selectedEraserId, setSelectedEraserId] = useState<string | null>(null);

  // Eraser Color settings
  const [activeColor, setActiveColor] = useState('#ffffff');
  const [eyeDropperSupported, setEyeDropperSupported] = useState(false);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

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
    setEraserLines([]);
    setActionHistory([]);
    setSelectedEraserId(null);
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
    setActionHistory((prev) => [...prev, { type: 'box', id: newInst.id }]);
    setSelectedEraserId(newInst.id); // Auto-select the box to adjust in sidebar
    setDone(false);
  };

  const handleAddLine = (line: EraserLine) => {
    setEraserLines((prev) => [...prev, line]);
    setActionHistory((prev) => [...prev, { type: 'line', id: line.id }]);
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
    setActionHistory((prev) => prev.filter((act) => act.id !== id));
    if (selectedEraserId === id) setSelectedEraserId(null);
    setDone(false);
  };

  // Undo the last action (either eraser line or box)
  const handleUndo = () => {
    if (actionHistory.length === 0) return;
    const lastAction = actionHistory[actionHistory.length - 1];

    if (lastAction.type === 'box') {
      setEraserInstances((prev) => prev.filter((inst) => inst.id !== lastAction.id));
      if (selectedEraserId === lastAction.id) setSelectedEraserId(null);
    } else {
      setEraserLines((prev) => prev.filter((line) => line.id !== lastAction.id));
    }

    setActionHistory((prev) => prev.slice(0, -1));
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

  const launchEyeDropper = async () => {
    if (!eyeDropperSupported) return;
    try {
      const eyeDropper = new (window as any).EyeDropper();
      const result = await eyeDropper.open();
      
      // If a box is selected, apply directly to it. Otherwise, set as default color.
      if (selectedEraserId) {
        handleUpdateColor(selectedEraserId, result.sRGBHex);
      } else {
        setActiveColor(result.sRGBHex);
      }
      setError(null);
    } catch (err) {
      console.warn('EyeDropper closed or failed:', err);
    }
  };

  const savePdf = async () => {
    if (!file) return;
    if (eraserInstances.length === 0 && eraserLines.length === 0) {
      setError('กรุณาตีกรอบหรือขีดเขียนยางลบปิดทับข้อความอย่างน้อย 1 จุด');
      return;
    }

    setBusy(true);
    setProgress('กำลังถมทับสีและประมวลผลลบรอยข้อความใน PDF...');
    setError(null);
    setDone(false);
    setResultItemId(null);

    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });

      // Compile Box Erasers
      for (const inst of eraserInstances) {
        const page = doc.getPage(inst.pageIndex);
        const { width, height } = page.getSize();

        const cleanHex = inst.color.replace('#', '');
        const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
        const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

        const sigLeft = inst.x - inst.width / 2;
        const sigTop = inst.y - inst.height / 2;

        const pdfX = (sigLeft / inst.renderedWidth) * width;
        const pdfY = ((inst.renderedHeight - sigTop - inst.height) / inst.renderedHeight) * height;
        const pdfWidth = (inst.width / inst.renderedWidth) * width;
        const pdfHeight = (inst.height / inst.renderedHeight) * height;

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

      // Compile Pencil Erasers (Freehand Lines)
      for (const line of eraserLines) {
        if (line.points.length < 2) continue;
        const page = doc.getPage(line.pageIndex);
        const { width, height } = page.getSize();

        const cleanHex = line.color.replace('#', '');
        const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
        const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

        // Map scale thickness
        const pdfThickness = (line.thickness / line.renderedHeight) * height;

        for (let i = 0; i < line.points.length - 1; i++) {
          const p1 = line.points[i];
          const p2 = line.points[i + 1];

          const pdfX1 = (p1.x / line.renderedWidth) * width;
          const pdfY1 = ((line.renderedHeight - p1.y) / line.renderedHeight) * height;
          const pdfX2 = (p2.x / line.renderedWidth) * width;
          const pdfY2 = ((line.renderedHeight - p2.y) / line.renderedHeight) * height;

          page.drawLine({
            start: { x: pdfX1, y: pdfY1 },
            end: { x: pdfX2, y: pdfY2 },
            thickness: pdfThickness,
            color: rgb(r, g, b),
            lineCap: LineCapStyle.Round,
          });
        }
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

  const selectedEraser = eraserInstances.find((e) => e.id === selectedEraserId);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader
        icon="🧼"
        title="ลบข้อความ PDF (ลบคำเดิม)"
        description="ลบข้อความหรือปกปิดข้อมูลโดยไม่ทับตาตัวหนังสือ ด้วยเครื่องมือตีกรอบถมสี หรือเครื่องมือขีดเขียนลบดินสออิสระ"
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
            {/* Sidebar Controls Panel */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* Eraser Tool Mode and Undo */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
                <span className="text-sm font-bold text-gray-700 block border-b border-gray-100 pb-2">
                  🛠️ เครื่องมือยางลบ
                </span>

                <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs font-bold divide-x divide-gray-200">
                  <button
                    onClick={() => {
                      setEraserMode('box');
                      setSelectedEraserId(null);
                    }}
                    className={`flex-1 py-2 text-center transition cursor-pointer border-none ${
                      eraserMode === 'box' ? 'bg-yellow-50 text-yellow-800' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    📐 ตีกรอบลบ (Box)
                  </button>
                  <button
                    onClick={() => {
                      setEraserMode('pencil');
                      setSelectedEraserId(null);
                    }}
                    className={`flex-1 py-2 text-center transition cursor-pointer border-none ${
                      eraserMode === 'pencil' ? 'bg-yellow-50 text-yellow-800' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    ✏️ ดินสอลบ (Pencil)
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleUndo}
                    disabled={actionHistory.length === 0}
                    className="flex-1 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    ↩️ เลิกทำ (Undo)
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('ล้างข้อมูลลบทังหมดของเอกสารนี้?')) {
                        setEraserInstances([]);
                        setEraserLines([]);
                        setActionHistory([]);
                        setSelectedEraserId(null);
                      }
                    }}
                    className="py-2 px-3 border border-red-200 hover:bg-red-50 text-red-500 rounded-lg text-xs font-bold transition cursor-pointer"
                    title="ล้างทั้งหมด"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Color Settings (Pristine or Selected Box) */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
                <span className="text-sm font-bold text-gray-700 block border-b border-gray-100 pb-2">
                  ⚙️ ตั้งค่าสีและขนาด
                </span>

                {eraserMode === 'pencil' && (
                  <div className="space-y-1.5 pb-2">
                    <label className="block text-xs font-semibold text-gray-600">
                      ขนาดดินสอลบ: {brushThickness}px
                    </label>
                    <input
                      type="range"
                      min="4"
                      max="40"
                      value={brushThickness}
                      onChange={(e) => setBrushThickness(parseInt(e.target.value) || 12)}
                      className="w-full h-1 bg-gray-200 rounded-lg cursor-pointer accent-yellow-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">
                    {selectedEraser ? 'สีกรอบที่เลือก' : 'สียางลบเริ่มต้น'}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { name: 'สีขาว', value: '#ffffff', border: 'border-gray-300' },
                      { name: 'สีดำ', value: '#000000', border: 'border-black' },
                      { name: 'สีเทาอ่อน', value: '#f3f4f6', border: 'border-gray-200' },
                      { name: 'สีครีม', value: '#faf8f5', border: 'border-gray-200' },
                    ]).map((colorItem) => (
                      <button
                        key={colorItem.value}
                        onClick={() => {
                          if (selectedEraser) {
                            handleUpdateColor(selectedEraser.id, colorItem.value);
                          } else {
                            setActiveColor(colorItem.value);
                          }
                        }}
                        className={`h-9 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer relative ${
                          colorItem.border
                        } ${(selectedEraser ? selectedEraser.color : activeColor) === colorItem.value ? 'ring-2 ring-yellow-400 font-bold scale-95' : 'hover:scale-105'}`}
                        style={{ backgroundColor: colorItem.value }}
                        title={colorItem.name}
                      >
                        {(selectedEraser ? selectedEraser.color : activeColor) === colorItem.value && (
                          <span className="text-[10px] mix-blend-difference text-white font-bold">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-600">สีที่เลือกปรับเอง</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={selectedEraser ? selectedEraser.color : activeColor}
                        onChange={(e) => {
                          if (selectedEraser) {
                            handleUpdateColor(selectedEraser.id, e.target.value);
                          } else {
                            setActiveColor(e.target.value);
                          }
                        }}
                        className="w-8 h-8 p-0 border border-gray-300 rounded cursor-pointer border-none bg-transparent"
                      />
                      <span className="text-xs font-mono uppercase text-gray-500">
                        {selectedEraser ? selectedEraser.color : activeColor}
                      </span>
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
              </div>

              {/* Selected Box Settings Panel (Instead of Popover!) */}
              {selectedEraser && (
                <div className="bg-white border border-pink-200 rounded-xl p-5 space-y-4 shadow-sm animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-pink-100 pb-2">
                    <span className="text-xs font-bold text-pink-700 uppercase tracking-wide">
                      🧼 ปรับขนาดกล่องถมที่เลือก
                    </span>
                    <button
                      onClick={() => setSelectedEraserId(null)}
                      className="text-[10px] text-gray-400 hover:text-gray-600 font-bold"
                    >
                      ยกเลิกเลือก
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-semibold">
                      <span>ความกว้าง: {selectedEraser.width}px</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="400"
                      value={selectedEraser.width}
                      onChange={(e) => handleUpdateWidth(selectedEraser.id, parseInt(e.target.value) || 10)}
                      className="w-full h-1 bg-gray-200 rounded-lg cursor-pointer accent-pink-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-semibold">
                      <span>ความสูง: {selectedEraser.height}px</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="200"
                      value={selectedEraser.height}
                      onChange={(e) => handleUpdateHeight(selectedEraser.id, parseInt(e.target.value) || 10)}
                      className="w-full h-1 bg-gray-200 rounded-lg cursor-pointer accent-pink-500"
                    />
                  </div>

                  <button
                    onClick={() => handleDeleteEraser(selectedEraser.id)}
                    className="w-full py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    🗑️ ลบกล่องยางลบนี้ออก
                  </button>
                </div>
              )}

              {/* List of all annotations */}
              {(eraserInstances.length > 0 || eraserLines.length > 0) && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 shadow-sm">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block border-b border-gray-100 pb-2">
                    📋 รายการสี่เหลี่ยม / ลายเส้นวาด ({eraserInstances.length + eraserLines.length})
                  </span>
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {eraserInstances.map((inst, idx) => (
                      <div
                        key={inst.id}
                        onClick={() => {
                          setEraserMode('box');
                          setSelectedEraserId(inst.id);
                        }}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer border transition ${
                          selectedEraserId === inst.id
                            ? 'bg-pink-50 border-pink-200 text-pink-700 font-semibold'
                            : 'bg-gray-50 border-gray-100 hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        <span>
                          📐 กล่องลบที่ {idx + 1} (หน้า {inst.pageIndex + 1})
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEraser(inst.id);
                          }}
                          className="text-red-500 hover:text-red-700 font-bold px-1.5"
                          title="ลบกล่องนี้"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {eraserLines.map((line, idx) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between p-2 bg-gray-50 border border-gray-100 rounded text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <span>
                          ✏️ เส้นดินสอที่ {idx + 1} (หน้า {line.pageIndex + 1})
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEraserLines((prev) => prev.filter((l) => l.id !== line.id));
                            setActionHistory((prev) => prev.filter((act) => act.id !== line.id));
                            setDone(false);
                          }}
                          className="text-red-500 hover:text-red-700 font-bold px-1.5"
                          title="ลบเส้นวาดนี้"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Stamping Grid pages preview */}
            <div className="lg:col-span-8 flex flex-col items-center">
              <div className="w-full bg-yellow-50 text-yellow-800 rounded-lg p-3.5 border border-yellow-100 text-xs font-semibold text-center mb-5 shadow-sm leading-relaxed">
                {eraserMode === 'box' ? (
                  <p>👉 **คลิกค้างแล้วลากเมาส์** บนหน้ากระดาษเพื่อ **ตีกรอบยางลบถมสี** | ขอบเขตจะถูกถมทับเนียนตามสีที่เลือก (สียางลบสามารถมาคลิกเลือกขยับย่อขยายขนาดได้ที่แผงควบคุมด้านซ้าย)</p>
                ) : (
                  <p>✏️ **คลิกแล้ววาดขีดเขียน** ลายเส้นทับข้อความ/รูปภาพเพื่อลบออก (ขีดทับได้ทันทีตามขนาดขนาดดินสอและสีที่เลือก)</p>
                )}
              </div>

              <div className="w-full max-h-[750px] overflow-y-auto pr-2 space-y-4">
                {Array.from({ length: pageCount }, (_, i) => (
                  <EditablePage
                    key={i}
                    pageNumber={i + 1}
                    pdfDoc={pdfDoc}
                    eraserInstances={eraserInstances.filter((s) => s.pageIndex === i)}
                    eraserLines={eraserLines.filter((s) => s.pageIndex === i)}
                    activeColor={activeColor}
                    eraserMode={eraserMode}
                    brushThickness={brushThickness}
                    selectedEraserId={selectedEraserId}
                    onAddEraser={handleAddEraser}
                    onAddLine={handleAddLine}
                    onSelectEraser={setSelectedEraserId}
                    onDeleteLine={(id) => {
                      setEraserLines((prev) => prev.filter((l) => l.id !== id));
                      setActionHistory((prev) => prev.filter((act) => act.id !== id));
                      setDone(false);
                    }}
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

        <ActionButton onClick={savePdf} disabled={!file || (eraserInstances.length === 0 && eraserLines.length === 0) || busy} busy={busy}>
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
