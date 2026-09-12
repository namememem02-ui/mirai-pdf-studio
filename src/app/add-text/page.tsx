'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument, rgb, LineCapStyle, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { recordToolUsage } from '@/lib/usage';

interface TextInstance {
  id: string;
  pageIndex: number;
  text: string;
  x: number; // HTML viewport x (center)
  y: number; // HTML viewport y (center)
  fontSize: number;
  color: string; // Hex color code
  renderedWidth: number;
  renderedHeight: number;
  isBold?: boolean;
  isItalic?: boolean;
}

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
  scale: number;
  textInstances: TextInstance[];
  eraserInstances: EraserInstance[];
  eraserLines: EraserLine[];
  activeText: string;
  activeFontSize: number;
  activeColor: string;
  activeIsBold: boolean;
  activeIsItalic: boolean;
  editorMode: 'text' | 'box' | 'pencil';
  eraserColor: string;
  brushThickness: number;
  selectedTextId: string | null;
  selectedEraserId: string | null;
  onAddText: (pageIndex: number, x: number, y: number, renderedWidth: number, renderedHeight: number) => void;
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
  onSelectText: (id: string) => void;
  onSelectEraser: (id: string) => void;
  onDeleteLine: (id: string) => void;
  onStartDragText: (e: React.PointerEvent | React.MouseEvent, id: string, currentWidth: number, currentHeight: number) => void;
  onStartDragEraser: (e: React.PointerEvent | React.MouseEvent, id: string, currentWidth: number, currentHeight: number) => void;
}

function EditablePage({
  pageNumber,
  pdfDoc,
  scale,
  textInstances,
  eraserInstances,
  eraserLines,
  activeText,
  activeFontSize,
  activeColor,
  activeIsBold,
  activeIsItalic,
  editorMode,
  eraserColor,
  brushThickness,
  selectedTextId,
  selectedEraserId,
  onAddText,
  onAddEraser,
  onAddLine,
  onSelectText,
  onSelectEraser,
  onDeleteLine,
  onStartDragText,
  onStartDragEraser,
}: EditablePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);

  // States for drawing interactions
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [pencilPoints, setPencilPoints] = useState<{ x: number; y: number }[]>([]);
  const pencilPointsRef = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    let active = true;
    const renderPage = async () => {
      setLoading(true);
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
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
  }, [pdfDoc, pageNumber, scale]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const target = e.target as HTMLElement;
    if (target.closest('[data-annotation]') || target.closest('button')) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    if (editorMode === 'text') {
      onAddText(pageNumber - 1, startX, startY, rect.width, rect.height);
      return;
    }

    setIsDrawing(true);
    setStartPos({ x: startX, y: startY });

    if (editorMode === 'box') {
      setDrawRect({ x: startX, y: startY, width: 0, height: 0 });
    } else if (editorMode === 'pencil') {
      const initialPoints = [{ x: startX, y: startY }];
      pencilPointsRef.current = initialPoints;
      setPencilPoints(initialPoints);
    }

    const handleGlobalPointerMove = (moveEvent: PointerEvent) => {
      const currentX = moveEvent.clientX - rect.left;
      const currentY = moveEvent.clientY - rect.top;

      const boundedX = Math.max(0, Math.min(rect.width, currentX));
      const boundedY = Math.max(0, Math.min(rect.height, currentY));

      if (editorMode === 'box') {
        const x = Math.min(startX, boundedX);
        const y = Math.min(startY, boundedY);
        const w = Math.abs(boundedX - startX);
        const h = Math.abs(boundedY - startY);
        setDrawRect({ x, y, width: w, height: h });
      } else if (editorMode === 'pencil') {
        const newPoints = [...pencilPointsRef.current, { x: boundedX, y: boundedY }];
        pencilPointsRef.current = newPoints;
        setPencilPoints(newPoints);
      }
    };

    const handleGlobalPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);

      setIsDrawing(false);
      setStartPos(null);

      if (editorMode === 'box') {
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
          const defaultW = Math.min(100, Math.max(30, rect.width * 0.15));
          const defaultH = Math.min(25, Math.max(15, rect.height * 0.03));
          onAddEraser(pageNumber - 1, startX, startY, defaultW, defaultH, rect.width, rect.height);
        } else {
          const centerX = x + w / 2;
          const centerY = y + h / 2;
          onAddEraser(pageNumber - 1, centerX, centerY, w, h, rect.width, rect.height);
        }
      } else if (editorMode === 'pencil') {
        const finalPoints = pencilPointsRef.current;
        if (finalPoints.length > 1) {
          onAddLine({
            id: `line-${Date.now()}-${Math.random()}`,
            pageIndex: pageNumber - 1,
            points: finalPoints,
            thickness: brushThickness,
            color: eraserColor,
            renderedWidth: rect.width,
            renderedHeight: rect.height,
          });
        }
        setPencilPoints([]);
        pencilPointsRef.current = [];
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
  };

  return (
    <div className="flex flex-col items-center select-none">
      <span className="text-xs text-gray-400 mb-2 font-semibold">หน้าที่ {pageNumber}</span>
      <div
        className={`relative border border-gray-300 bg-white shadow-md mb-8 ${
          editorMode === 'text' ? 'cursor-text' : editorMode === 'pencil' ? 'cursor-pencil' : 'cursor-crosshair'
        }`}
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
      >
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

        {loading && (
          <div className="absolute inset-0 bg-gray-50/50 flex items-center justify-center text-xs text-gray-500">
            ⏳ กำลังโหลดกระดาษ...
          </div>
        )}

        {/* Freehand SVG Overlay for Pencil Strokes */}
        <svg className="absolute inset-0 z-10 w-full h-full pointer-events-none">
          {eraserLines.map((line) => {
            const scaleX = dimensions.width > 0 && line.renderedWidth > 0 ? dimensions.width / line.renderedWidth : 1;
            const scaleY = dimensions.height > 0 && line.renderedHeight > 0 ? dimensions.height / line.renderedHeight : 1;
            const scaledPoints = line.points.map((p) => `${p.x * scaleX},${p.y * scaleY}`).join(' ');
            const scaledThickness = Math.max(1, line.thickness * scaleY);

            return (
              <polyline
                key={line.id}
                points={scaledPoints}
                fill="none"
                stroke={line.color}
                strokeWidth={scaledThickness}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="hover:opacity-85 transition-opacity pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('ต้องการลบเส้นวาดดินสอนี้ใช่หรือไม่?')) {
                    onDeleteLine(line.id);
                  }
                }}
              />
            );
          })}
          {/* Active drawing line preview */}
          {editorMode === 'pencil' && isDrawing && pencilPoints.length > 0 && (
            <polyline
              points={pencilPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={eraserColor}
              strokeWidth={brushThickness}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
          )}
        </svg>

        {/* Real-time Box Drawing Preview Overlay */}
        {editorMode === 'box' && isDrawing && drawRect && (
          <div
            className="absolute border border-dashed border-yellow-500 z-20 pointer-events-none"
            style={{
              left: `${drawRect.x}px`,
              top: `${drawRect.y}px`,
              width: `${drawRect.width}px`,
              height: `${drawRect.height}px`,
              backgroundColor: eraserColor,
              opacity: 0.65,
            }}
          />
        )}

        {/* Rendered Solid Eraser Rectangles */}
        {eraserInstances.map((inst) => {
          const isSelected = selectedEraserId === inst.id;
          const leftPct = (inst.x / inst.renderedWidth) * 100;
          const topPct = (inst.y / inst.renderedHeight) * 100;
          const widthPct = (inst.width / inst.renderedWidth) * 100;
          const heightPct = (inst.height / inst.renderedHeight) * 100;

          return (
            <div
              key={inst.id}
              data-annotation="eraser"
              className={`absolute border transition-shadow z-20 cursor-move ${
                isSelected
                  ? 'border-pink-500 ring-2 ring-pink-500/35 shadow-lg scale-[1.01]'
                  : 'border-dashed border-gray-400 hover:border-gray-600'
              }`}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: inst.color,
                touchAction: 'none',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEraser(inst.id);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onStartDragEraser(e, inst.id, dimensions.width, dimensions.height);
                onSelectEraser(inst.id);
              }}
            />
          );
        })}

        {/* Rendered Text Annotations */}
        {textInstances.map((inst) => {
          const isSelected = selectedTextId === inst.id;
          const leftPct = (inst.x / inst.renderedWidth) * 100;
          const topPct = (inst.y / inst.renderedHeight) * 100;
          const currentFontSize = dimensions.height > 0 && inst.renderedHeight > 0
            ? (inst.fontSize / inst.renderedHeight) * dimensions.height
            : inst.fontSize;

          return (
            <div
              key={inst.id}
              data-annotation="text"
              className={`absolute p-1.5 rounded cursor-move z-20 transition-shadow ${
                isSelected
                  ? 'border-2 border-pink-500 bg-white/70 shadow-lg ring-2 ring-pink-500/20'
                  : 'border border-dashed border-pink-400 hover:border-pink-600 bg-white/40'
              }`}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: 'translate(-50%, -50%)',
                whiteSpace: 'nowrap',
                touchAction: 'none',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectText(inst.id);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onStartDragText(e, inst.id, dimensions.width, dimensions.height);
                onSelectText(inst.id);
              }}
            >
              <span
                style={{
                  fontSize: `${Math.max(8, currentFontSize)}px`,
                  color: inst.color,
                  fontWeight: inst.isBold ? 'bold' : 'normal',
                  fontStyle: inst.isItalic ? 'italic' : 'normal',
                  fontFamily: 'Sarabun, sans-serif',
                  userSelect: 'none',
                }}
              >
                {inst.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CombinedPdfEditorPage() {
  const { addToQueue, queue, downloadItem } = useDownloadQueue();

  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);

  // Zoom and responsive scaling states
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [basePageWidth, setBasePageWidth] = useState<number>(595.28);
  const [zoomMode, setZoomMode] = useState<'fit' | 'manual'>('fit');
  const [customScale, setCustomScale] = useState<number>(1.0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [file]);

  useEffect(() => {
    if (!pdfDoc) return;
    pdfDoc.getPage(1).then((page: any) => {
      const vp = page.getViewport({ scale: 1.0 });
      if (vp && vp.width > 0) {
        setBasePageWidth(vp.width);
      }
    }).catch((err: any) => console.warn('Could not read base page width', err));
  }, [pdfDoc]);

  // Compute effective scale: on 'fit' mode, adjust dynamically to container width
  const fitScale = containerWidth > 0
    ? Math.min(2.0, Math.max(0.35, Number(((containerWidth - 36) / (basePageWidth || 595.28)).toFixed(3))))
    : 1.0;

  const effectiveScale = zoomMode === 'fit' ? fitScale : customScale;

  // Editor mode selection
  const [editorMode, setEditorMode] = useState<'text' | 'box' | 'pencil'>('text');

  // Multi-object states
  const [textInstances, setTextInstances] = useState<TextInstance[]>([]);
  const [eraserInstances, setEraserInstances] = useState<EraserInstance[]>([]);
  const [eraserLines, setEraserLines] = useState<EraserLine[]>([]);
  const [actionHistory, setActionHistory] = useState<{ type: 'text' | 'box' | 'line'; id: string }[]>([]);

  // Selection states
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedEraserId, setSelectedEraserId] = useState<string | null>(null);

  // Typewriter parameters
  const [activeText, setActiveText] = useState('ข้อความใหม่');
  const [activeFontSize, setActiveFontSize] = useState(16);
  const [activeColor, setActiveColor] = useState('#000000');
  const [activeIsBold, setActiveIsBold] = useState(false);
  const [activeIsItalic, setActiveIsItalic] = useState(false);

  // Local state for free typing of font size (to avoid React lock when clearing/deleting)
  const [fontSizeInput, setFontSizeInput] = useState<string>('16');

  useEffect(() => {
    const matchedText = textInstances.find((t) => t.id === selectedTextId);
    if (matchedText) {
      setFontSizeInput(matchedText.fontSize.toString());
    } else {
      setFontSizeInput(activeFontSize.toString());
    }
  }, [selectedTextId, activeFontSize, textInstances]);

  // Eraser parameters
  const [eraserColor, setEraserColor] = useState('#ffffff');
  const [brushThickness, setBrushThickness] = useState(12);
  const [eyeDropperSupported, setEyeDropperSupported] = useState(false);

  // Status and compiler progress
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  // 4 Thai Sarabun font variants
  const [thaiFontRegular, setThaiFontRegular] = useState<ArrayBuffer | null>(null);
  const [thaiFontBold, setThaiFontBold] = useState<ArrayBuffer | null>(null);
  const [thaiFontItalic, setThaiFontItalic] = useState<ArrayBuffer | null>(null);
  const [thaiFontBoldItalic, setThaiFontBoldItalic] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      setEyeDropperSupported(true);
    }

    const loadFont = async (url: string, setter: (b: ArrayBuffer) => void) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP error');
        const bytes = await res.arrayBuffer();
        setter(bytes);
      } catch (err) {
        console.warn('Failed to load font:', url, err);
      }
    };

    loadFont('/fonts/Sarabun-Regular.ttf', setThaiFontRegular);
    loadFont('/fonts/Sarabun-Bold.ttf', setThaiFontBold);
    loadFont('/fonts/Sarabun-Italic.ttf', setThaiFontItalic);
    loadFont('/fonts/Sarabun-BoldItalic.ttf', setThaiFontBoldItalic);
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
    setTextInstances([]);
    setEraserInstances([]);
    setEraserLines([]);
    setActionHistory([]);
    setSelectedTextId(null);
    setSelectedEraserId(null);
    setBusy(true);
    setProgress('กำลังโหลดไฟล์ PDF...');

    try {
      const buffer = await f.arrayBuffer();
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({
        cMapUrl: '/cmaps/',
        cMapPacked: true, data: buffer.slice(0) }).promise;
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

  const handleAddText = (pageIndex: number, x: number, y: number, rWidth: number, rHeight: number) => {
    if (!activeText.trim()) return;

    const newInst: TextInstance = {
      id: `text-${Date.now()}-${Math.random()}`,
      pageIndex,
      text: activeText,
      x,
      y,
      fontSize: activeFontSize,
      color: activeColor,
      renderedWidth: rWidth,
      renderedHeight: rHeight,
      isBold: activeIsBold,
      isItalic: activeIsItalic,
    };

    setTextInstances((prev) => [...prev, newInst]);
    setActionHistory((prev) => [...prev, { type: 'text', id: newInst.id }]);
    setSelectedTextId(newInst.id);
    setSelectedEraserId(null);
    setDone(false);
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
      color: eraserColor,
      renderedWidth: rWidth,
      renderedHeight: rHeight,
    };

    setEraserInstances((prev) => [...prev, newInst]);
    setActionHistory((prev) => [...prev, { type: 'box', id: newInst.id }]);
    setSelectedEraserId(newInst.id);
    setSelectedTextId(null);
    setDone(false);
  };

  const handleAddLine = (line: EraserLine) => {
    setEraserLines((prev) => [...prev, line]);
    setActionHistory((prev) => [...prev, { type: 'line', id: line.id }]);
    setDone(false);
  };

  // Text specific updates
  const handleUpdateTextVal = (id: string, text: string) => {
    setTextInstances((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
    setDone(false);
  };
  const handleUpdateTextSize = (id: string, fontSize: number) => {
    setTextInstances((prev) => prev.map((t) => (t.id === id ? { ...t, fontSize } : t)));
    setDone(false);
  };
  const handleUpdateTextColor = (id: string, color: string) => {
    setTextInstances((prev) => prev.map((t) => (t.id === id ? { ...t, color } : t)));
    setDone(false);
  };
  const handleToggleTextBold = (id: string) => {
    setTextInstances((prev) => prev.map((t) => (t.id === id ? { ...t, isBold: !t.isBold } : t)));
    setDone(false);
  };
  const handleToggleTextItalic = (id: string) => {
    setTextInstances((prev) => prev.map((t) => (t.id === id ? { ...t, isItalic: !t.isItalic } : t)));
    setDone(false);
  };
  const handleDeleteText = (id: string) => {
    setTextInstances((prev) => prev.filter((t) => t.id !== id));
    setActionHistory((prev) => prev.filter((h) => h.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
    setDone(false);
  };

  // Eraser specific updates
  const handleUpdateEraserWidth = (id: string, width: number) => {
    setEraserInstances((prev) => prev.map((e) => (e.id === id ? { ...e, width } : e)));
    setDone(false);
  };
  const handleUpdateEraserHeight = (id: string, height: number) => {
    setEraserInstances((prev) => prev.map((e) => (e.id === id ? { ...e, height } : e)));
    setDone(false);
  };
  const handleUpdateEraserColor = (id: string, color: string) => {
    setEraserInstances((prev) => prev.map((e) => (e.id === id ? { ...e, color } : e)));
    setDone(false);
  };
  const handleDeleteEraser = (id: string) => {
    setEraserInstances((prev) => prev.filter((e) => e.id !== id));
    setActionHistory((prev) => prev.filter((h) => h.id !== id));
    if (selectedEraserId === id) setSelectedEraserId(null);
    setDone(false);
  };

  // Universal Undo
  const handleUndo = () => {
    if (actionHistory.length === 0) return;
    const lastAction = actionHistory[actionHistory.length - 1];

    if (lastAction.type === 'text') {
      setTextInstances((prev) => prev.filter((t) => t.id !== lastAction.id));
      if (selectedTextId === lastAction.id) setSelectedTextId(null);
    } else if (lastAction.type === 'box') {
      setEraserInstances((prev) => prev.filter((e) => e.id !== lastAction.id));
      if (selectedEraserId === lastAction.id) setSelectedEraserId(null);
    } else if (lastAction.type === 'line') {
      setEraserLines((prev) => prev.filter((line) => line.id !== lastAction.id));
    }

    setActionHistory((prev) => prev.slice(0, -1));
    setDone(false);
  };

  const handleStartDragText = (
    e: React.PointerEvent | React.MouseEvent,
    id: string,
    currentWidth: number,
    currentHeight: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const inst = textInstances.find((t) => t.id === id);
    if (!inst) return;
    const initialX = inst.x;
    const initialY = inst.y;

    const scaleX = currentWidth > 0 ? inst.renderedWidth / currentWidth : 1;
    const scaleY = currentHeight > 0 ? inst.renderedHeight / currentHeight : 1;

    const handlePointerMove = (moveEvent: PointerEvent | MouseEvent) => {
      const dx = (moveEvent.clientX - startX) * scaleX;
      const dy = (moveEvent.clientY - startY) * scaleY;

      const nextX = Math.max(0, Math.min(inst.renderedWidth, initialX + dx));
      const nextY = Math.max(0, Math.min(inst.renderedHeight, initialY + dy));

      setTextInstances((prev) => prev.map((t) => (t.id === id ? { ...t, x: nextX, y: nextY } : t)));
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.removeEventListener('mousemove', handlePointerMove);
      document.removeEventListener('mouseup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('mouseup', handlePointerUp);
  };

  const handleStartDragEraser = (
    e: React.PointerEvent | React.MouseEvent,
    id: string,
    currentWidth: number,
    currentHeight: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const inst = eraserInstances.find((eraser) => eraser.id === id);
    if (!inst) return;
    const initialX = inst.x;
    const initialY = inst.y;

    const scaleX = currentWidth > 0 ? inst.renderedWidth / currentWidth : 1;
    const scaleY = currentHeight > 0 ? inst.renderedHeight / currentHeight : 1;

    const handlePointerMove = (moveEvent: PointerEvent | MouseEvent) => {
      const dx = (moveEvent.clientX - startX) * scaleX;
      const dy = (moveEvent.clientY - startY) * scaleY;

      const nextX = Math.max(0, Math.min(inst.renderedWidth, initialX + dx));
      const nextY = Math.max(0, Math.min(inst.renderedHeight, initialY + dy));

      setEraserInstances((prev) => prev.map((item) => (item.id === id ? { ...item, x: nextX, y: nextY } : item)));
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.removeEventListener('mousemove', handlePointerMove);
      document.removeEventListener('mouseup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('mouseup', handlePointerUp);
  };

  const launchEyeDropper = async () => {
    if (!eyeDropperSupported) return;
    try {
      const eyeDropper = new (window as any).EyeDropper();
      const result = await eyeDropper.open();

      if (selectedEraserId) {
        handleUpdateEraserColor(selectedEraserId, result.sRGBHex);
      } else {
        setEraserColor(result.sRGBHex);
      }
      setError(null);
    } catch (err) {
      console.warn('EyeDropper closed or failed:', err);
    }
  };

  const savePdf = async () => {
    if (!file) return;
    if (textInstances.length === 0 && eraserInstances.length === 0 && eraserLines.length === 0) {
      setError('กรุณาเติมข้อความ ตีกรอบลบ หรือขีดเขียนสัญกรณ์บนหน้ากระดาษอย่างน้อย 1 จุด');
      return;
    }

    setBusy(true);
    setProgress('กำลังประมวลผลจัดแต่งรายละเอียดและบันทึกไฟล์ PDF...');
    setError(null);
    setDone(false);
    setResultItemId(null);

    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      doc.registerFontkit(fontkit);

      // Chronological Layering:
      // 1. Draw solid eraser boxes
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

      // 2. Draw pencil lines
      for (const line of eraserLines) {
        if (line.points.length < 2) continue;
        const page = doc.getPage(line.pageIndex);
        const { width, height } = page.getSize();

        const cleanHex = line.color.replace('#', '');
        const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
        const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

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

      // 3. Draw text layers (embedded fonts)
      const embeddedFonts: Record<string, any> = {};

      for (const inst of textInstances) {
        const page = doc.getPage(inst.pageIndex);
        const { width, height } = page.getSize();

        const isBold = !!inst.isBold;
        const isItalic = !!inst.isItalic;
        const fontKey = `${isBold}-${isItalic}`;

        let customFont = embeddedFonts[fontKey];
        if (!customFont) {
          let fontBytes: ArrayBuffer | null = null;
          let standardFontName = StandardFonts.Helvetica;

          if (isBold && isItalic) {
            fontBytes = thaiFontBoldItalic;
            standardFontName = StandardFonts.HelveticaBoldOblique;
          } else if (isBold) {
            fontBytes = thaiFontBold;
            standardFontName = StandardFonts.HelveticaBold;
          } else if (isItalic) {
            fontBytes = thaiFontItalic;
            standardFontName = StandardFonts.HelveticaOblique;
          } else {
            fontBytes = thaiFontRegular;
            standardFontName = StandardFonts.Helvetica;
          }

          customFont = fontBytes
            ? await doc.embedFont(fontBytes, { subset: true })
            : await doc.embedFont(standardFontName);

          embeddedFonts[fontKey] = customFont;
        }

        const cleanHex = inst.color.replace('#', '');
        const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
        const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

        const pdfFontSize = (inst.fontSize / inst.renderedHeight) * height;

        const textWidth = customFont.widthOfTextAtSize(inst.text, pdfFontSize);
        const textHeight = customFont.heightAtSize(pdfFontSize);

        const pdfX = (inst.x / inst.renderedWidth) * width - textWidth / 2;
        const pdfY = ((inst.renderedHeight - inst.y) / inst.renderedHeight) * height - textHeight / 2;

        page.drawText(inst.text, {
          x: pdfX,
          y: pdfY,
          size: pdfFontSize,
          font: customFont,
          color: rgb(r, g, b),
        });
      }

      const outName = `${baseName(file.name)}_edited.pdf`;
      const outBytes = await doc.save();
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const id = addToQueue(outName, blob);
      recordToolUsage('add-text');
      setResultItemId(id);
      setDone(true);
    } catch (err) {
      setError('ประมวลผลเซฟไฟล์แก้ไขล้มเหลว: ' + (err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const selectedText = textInstances.find((t) => t.id === selectedTextId);
  const selectedEraser = eraserInstances.find((e) => e.id === selectedEraserId);

  return (
    <main className={`mx-auto px-4 py-6 sm:px-6 transition-all duration-200 ${file ? 'w-full max-w-[1680px]' : 'max-w-5xl'}`}>
      <PageHeader
        icon="✍️"
        title="เขียนและลบข้อความ PDF"
        description="แก้ไขเอกสาร PDF ได้ครบวงจร พิมพ์เขียนข้อความทับใหม่ หรือปกปิด/ลบคำเดิมออกด้วยยางลบถมสีและดินสอลบอิสระ"
      />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวางที่นี่ หรือคลิกเพื่ออัปโหลดไฟล์ที่จะทำงานแก้ไข'}
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
            <div className="lg:col-span-4 xl:col-span-3 space-y-4">
              
              {/* Tool Selector & History */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
                <span className="text-sm font-bold text-gray-700 block border-b border-gray-100 pb-2">
                  🛠️ เครื่องมือหลัก
                </span>

                <div className="grid grid-cols-3 border border-gray-200 rounded-lg overflow-hidden text-xs font-bold divide-x divide-gray-200">
                  <button
                    onClick={() => {
                      setEditorMode('text');
                      setSelectedTextId(null);
                      setSelectedEraserId(null);
                    }}
                    className={`py-2 text-center transition cursor-pointer border-none ${
                      editorMode === 'text' ? 'bg-pink-50 text-pink-700' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                    title="พิมพ์เขียนคำใหม่"
                  >
                    ✍️ พิมพ์คำ
                  </button>
                  <button
                    onClick={() => {
                      setEditorMode('box');
                      setSelectedTextId(null);
                      setSelectedEraserId(null);
                    }}
                    className={`py-2 text-center transition cursor-pointer border-none ${
                      editorMode === 'box' ? 'bg-yellow-50 text-yellow-800' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                    title="ตีกรอบลบภาพหรือคำเดิม"
                  >
                    📐 ลบกล่อง
                  </button>
                  <button
                    onClick={() => {
                      setEditorMode('pencil');
                      setSelectedTextId(null);
                      setSelectedEraserId(null);
                    }}
                    className={`py-2 text-center transition cursor-pointer border-none ${
                      editorMode === 'pencil' ? 'bg-yellow-50 text-yellow-800' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                    title="เขียนดินสอถมสีลบอิสระ"
                  >
                    ✏️ ลบดินสอ
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
                      if (confirm('ล้างสิ่งแก้ไขทั้งหมดของเอกสารนี้?')) {
                        setTextInstances([]);
                        setEraserInstances([]);
                        setEraserLines([]);
                        setActionHistory([]);
                        setSelectedTextId(null);
                        setSelectedEraserId(null);
                      }
                    }}
                    className="py-2 px-3 border border-red-200 hover:bg-red-50 text-red-500 rounded-lg text-xs font-bold transition cursor-pointer"
                    title="ล้างวัตถุทั้งหมด"
                  >
                    🗑️ ล้างทั้งหมด
                  </button>
                </div>
              </div>

              {/* Dynamic Context Settings (Typewriter vs Eraser parameters) */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
                <span className="text-sm font-bold text-gray-700 block border-b border-gray-100 pb-2">
                  ⚙️ {editorMode === 'text' ? 'ตั้งค่าตัวเขียนคำ' : 'ตั้งค่ายางลบ'}
                </span>

                {editorMode === 'text' ? (
                  /* Add Text configuration inputs */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">ข้อความที่จะเขียน</label>
                      <input
                        type="text"
                        value={activeText}
                        onChange={(e) => {
                          setActiveText(e.target.value);
                          if (selectedTextId) handleUpdateTextVal(selectedTextId, e.target.value);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500"
                        placeholder="พิมพ์ข้อความที่นี่..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">ขนาดตัวอักษร</label>
                        <input
                          type="text"
                          value={fontSizeInput}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '' || /^\d*$/.test(raw)) {
                              setFontSizeInput(raw);
                              const parsed = parseInt(raw, 10);
                              if (!isNaN(parsed) && parsed >= 4) {
                                if (selectedText) {
                                  handleUpdateTextSize(selectedText.id, parsed);
                                } else {
                                  setActiveFontSize(parsed);
                                }
                              }
                            }
                          }}
                          onBlur={() => {
                            let parsed = parseInt(fontSizeInput, 10);
                            if (isNaN(parsed) || parsed < 6) {
                              parsed = 12;
                            } else if (parsed > 100) {
                              parsed = 100;
                            }
                            setFontSizeInput(parsed.toString());
                            if (selectedText) {
                              handleUpdateTextSize(selectedText.id, parsed);
                            } else {
                              setActiveFontSize(parsed);
                            }
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-pink-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">สีตัวอักษร</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedText ? selectedText.color : activeColor}
                            onChange={(e) => {
                              if (selectedText) {
                                handleUpdateTextColor(selectedText.id, e.target.value);
                              } else {
                                setActiveColor(e.target.value);
                              }
                            }}
                            className="w-8 h-8 p-0 border border-gray-300 rounded cursor-pointer border-none bg-transparent"
                          />
                          <span className="text-xs font-mono uppercase text-gray-500">
                            {selectedText ? selectedText.color : activeColor}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">ลักษณะอักษร</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (selectedText) {
                              handleToggleTextBold(selectedText.id);
                            } else {
                              setActiveIsBold(!activeIsBold);
                            }
                          }}
                          className={`py-1.5 border rounded-lg text-xs font-bold transition cursor-pointer flex-1 text-center ${
                            (selectedText ? selectedText.isBold : activeIsBold)
                              ? 'border-pink-500 bg-pink-50 text-pink-600'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
                          }`}
                        >
                          ตัวหนา (B)
                        </button>
                        <button
                          onClick={() => {
                            if (selectedText) {
                              handleToggleTextItalic(selectedText.id);
                            } else {
                              setActiveIsItalic(!activeIsItalic);
                            }
                          }}
                          className={`py-1.5 border rounded-lg text-xs italic transition cursor-pointer flex-1 text-center ${
                            (selectedText ? selectedText.isItalic : activeIsItalic)
                              ? 'border-pink-500 bg-pink-50 text-pink-600 font-semibold'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
                          }`}
                        >
                          ตัวเอียง (I)
                        </button>
                      </div>
                    </div>

                    {!(thaiFontRegular && thaiFontBold && thaiFontItalic && thaiFontBoldItalic) && (
                      <div className="text-[9px] text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                        ⏳ กำลังโหลดฟอนต์ภาษาไทยออนไลน์ให้ครบ 4 สไตล์...
                      </div>
                    )}
                  </div>
                ) : (
                  /* Eraser configuration inputs */
                  <div className="space-y-4">
                    {editorMode === 'pencil' && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-600">
                          ขนาดหัวดินสอลบ: {brushThickness}px
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
                        {selectedEraser ? 'สีกรอบสี่เหลี่ยมที่เลือก' : 'สียางลบเริ่มต้น'}
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
                                handleUpdateEraserColor(selectedEraser.id, colorItem.value);
                              } else {
                                setEraserColor(colorItem.value);
                              }
                            }}
                            className={`h-9 rounded-lg border flex flex-col items-center justify-center transition cursor-pointer relative ${
                              colorItem.border
                            } ${(selectedEraser ? selectedEraser.color : eraserColor) === colorItem.value ? 'ring-2 ring-yellow-400 font-bold scale-95' : 'hover:scale-105'}`}
                            style={{ backgroundColor: colorItem.value }}
                            title={colorItem.name}
                          >
                            {(selectedEraser ? selectedEraser.color : eraserColor) === colorItem.value && (
                              <span className="text-[10px] mix-blend-difference text-white font-bold">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-600">สีที่ระบุเอง</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedEraser ? selectedEraser.color : eraserColor}
                            onChange={(e) => {
                              if (selectedEraser) {
                                handleUpdateEraserColor(selectedEraser.id, e.target.value);
                              } else {
                                setEraserColor(e.target.value);
                              }
                            }}
                            className="w-8 h-8 p-0 border border-gray-300 rounded cursor-pointer border-none bg-transparent"
                          />
                          <span className="text-xs font-mono uppercase text-gray-500">
                            {selectedEraser ? selectedEraser.color : eraserColor}
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
                )}
              </div>

              {/* Selected Box Settings Panel (Only shown if a box is selected) */}
              {selectedEraser && (
                <div className="bg-white border border-pink-200 rounded-xl p-5 space-y-4 shadow-sm animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-pink-100 pb-2">
                    <span className="text-xs font-bold text-pink-700 uppercase tracking-wide">
                      📐 ปรับขนาดกล่องถมที่เลือก
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
                      onChange={(e) => handleUpdateEraserWidth(selectedEraser.id, parseInt(e.target.value) || 10)}
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
                      onChange={(e) => handleUpdateEraserHeight(selectedEraser.id, parseInt(e.target.value) || 10)}
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

              {/* List of all active annotations */}
              {(textInstances.length > 0 || eraserInstances.length > 0 || eraserLines.length > 0) && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 shadow-sm">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block border-b border-gray-100 pb-2">
                    📋 รายการแก้ไขสะสม ({textInstances.length + eraserInstances.length + eraserLines.length})
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {/* Text Instances List */}
                    {textInstances.map((inst, idx) => (
                      <div
                        key={inst.id}
                        onClick={() => {
                          setEditorMode('text');
                          setSelectedTextId(inst.id);
                          setSelectedEraserId(null);
                        }}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer border transition ${
                          selectedTextId === inst.id
                            ? 'bg-pink-50 border-pink-200 text-pink-700 font-semibold'
                            : 'bg-gray-50 border-gray-100 hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        <span className="truncate max-w-[130px]">
                          ✍️ พิมพ์ &quot;{inst.text}&quot; (หน้า {inst.pageIndex + 1})
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteText(inst.id);
                          }}
                          className="text-red-500 hover:text-red-700 font-bold px-1.5"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {/* Box Instances List */}
                    {eraserInstances.map((inst, idx) => (
                      <div
                        key={inst.id}
                        onClick={() => {
                          setEditorMode('box');
                          setSelectedEraserId(inst.id);
                          setSelectedTextId(null);
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
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {/* Line Instances List */}
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
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pages workspace and PDF Rendering container */}
            <div ref={containerRef} className="lg:col-span-8 xl:col-span-9 flex flex-col items-center w-full min-w-0">
              <div className="w-full bg-pink-50 border border-pink-100 text-pink-850 rounded-lg p-3 text-xs font-semibold text-center mb-3 shadow-sm leading-relaxed">
                {editorMode === 'text' ? (
                  <p>✍️ **พิมพ์คำที่จะเขียน (ที่แผงควบคุม)** แล้ว **คลิก/แตะจุดบนกระดาษ** เพื่อวางตัวอักษรลงในหน้านั้นๆ | ลากย้ายปรับเปลี่ยนสีและขนาดฟอนต์ภายหลังได้อิสระ</p>
                ) : editorMode === 'box' ? (
                  <p>📐 **คลิกค้างแล้วลากเมาส์/นิ้ว** บนกระดาษเพื่อ **ตีกรอบสี่เหลี่ยมยางลบ** ถมสีทับคำเดิม (คลิกกรอบเพื่อเลือกปรับความยาวความสูงได้ที่แถบด้านซ้าย)</p>
                ) : (
                  <p>✏️ **คลิกค้างแล้ววาดลายเส้น** ทับข้อความ/รูปภาพเพื่อลบออกทันที (ปรับขนาดหัวแปรงยางลบดินสอได้ที่แผงควบคุม)</p>
                )}
              </div>

              {/* Zoom & View Control Toolbar */}
              <div className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 mb-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <span>🔍</span> มุมมอง:
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomMode('fit')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                      zoomMode === 'fit'
                        ? 'bg-pink-50 border-pink-300 text-pink-700 shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                    title="ปรับขนาดให้พอดีกับความกว้างหน้าจออัตโนมัติ (เหมาะกับมือถือและย่อจอ)"
                  >
                    📱 พอดีจอ (Fit Width)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoomMode('manual');
                      setCustomScale(1.0);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                      zoomMode === 'manual' && customScale === 1.0
                        ? 'bg-pink-50 border-pink-300 text-pink-700 shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                    title="ขนาดมาตรฐาน 100%"
                  >
                    100%
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(0.35, Number((effectiveScale - 0.15).toFixed(2)));
                      setZoomMode('manual');
                      setCustomScale(next);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-sm cursor-pointer transition"
                    title="ย่อขนาด"
                  >
                    −
                  </button>
                  <span className="text-xs font-mono font-bold text-gray-700 min-w-[50px] text-center">
                    {Math.round(effectiveScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(2.5, Number((effectiveScale + 0.15).toFixed(2)));
                      setZoomMode('manual');
                      setCustomScale(next);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-sm cursor-pointer transition"
                    title="ขยายขนาด"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="w-full max-h-[78vh] overflow-y-auto overflow-x-auto rounded-xl border border-gray-200 bg-gray-100/70 p-4 space-y-6">
                {Array.from({ length: pageCount }, (_, i) => (
                  <EditablePage
                    key={i}
                    pageNumber={i + 1}
                    pdfDoc={pdfDoc}
                    scale={effectiveScale}
                    textInstances={textInstances.filter((s) => s.pageIndex === i)}
                    eraserInstances={eraserInstances.filter((s) => s.pageIndex === i)}
                    eraserLines={eraserLines.filter((s) => s.pageIndex === i)}
                    activeText={activeText}
                    activeFontSize={activeFontSize}
                    activeColor={activeColor}
                    activeIsBold={activeIsBold}
                    activeIsItalic={activeIsItalic}
                    editorMode={editorMode}
                    eraserColor={eraserColor}
                    brushThickness={brushThickness}
                    selectedTextId={selectedTextId}
                    selectedEraserId={selectedEraserId}
                    onAddText={handleAddText}
                    onAddEraser={handleAddEraser}
                    onAddLine={handleAddLine}
                    onSelectText={setSelectedTextId}
                    onSelectEraser={setSelectedEraserId}
                    onDeleteLine={(id) => {
                      setEraserLines((prev) => prev.filter((l) => l.id !== id));
                      setActionHistory((prev) => prev.filter((act) => act.id !== id));
                      setDone(false);
                    }}
                    onStartDragText={handleStartDragText}
                    onStartDragEraser={handleStartDragEraser}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {done && resultItemId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
            <span className="text-4xl block">🎉</span>
            <h3 className="font-bold text-emerald-800 text-sm">แก้ไขไฟล์ PDF เรียบร้อยแล้ว!</h3>
            <p className="text-xs text-emerald-600">ตรวจสอบความเรียบร้อยของคำและยางลบผ่านพรีวิวก่อนเปิดดาวน์โหลดลงเครื่องได้ทันที</p>
            
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

        <ActionButton onClick={savePdf} disabled={!file || (textInstances.length === 0 && eraserInstances.length === 0 && eraserLines.length === 0) || busy} busy={busy}>
          💾 บันทึกและสรุปผลแก้ไข PDF
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
