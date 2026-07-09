'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';

interface ExistingText {
  id: string;
  pageIndex: number;
  text: string;
  originalText: string;
  x: number; // viewport x (left)
  y: number; // viewport y (top)
  width: number;
  height: number;
  pdfX: number; // original PDF coordinate x
  pdfY: number; // original PDF coordinate y
  fontSize: number; // original PDF font size
  isDeleted: boolean;
}

interface NewTextBox {
  id: string;
  pageIndex: number;
  text: string;
  x: number; // HTML relative coordinate x
  y: number; // HTML relative coordinate y
  renderedWidth: number;
  renderedHeight: number;
  fontSize: number;
  color: string;
}

interface EditablePageProps {
  pageNumber: number;
  pdfDoc: any;
  existingTexts: ExistingText[];
  newTextBoxes: NewTextBox[];
  onLoadExistingTexts: (pageIndex: number, texts: ExistingText[]) => void;
  onUpdateExistingText: (id: string, text: string) => void;
  onDeleteExistingText: (id: string) => void;
  onAddNewTextBox: (pageIndex: number, x: number, y: number, renderedWidth: number, renderedHeight: number) => void;
  onUpdateNewTextBox: (id: string, field: keyof NewTextBox, value: any) => void;
  onDeleteNewTextBox: (id: string) => void;
  onStartDragNewTextBox: (e: React.MouseEvent, id: string) => void;
}

function EditablePage({
  pageNumber,
  pdfDoc,
  existingTexts,
  newTextBoxes,
  onLoadExistingTexts,
  onUpdateExistingText,
  onDeleteExistingText,
  onAddNewTextBox,
  onUpdateNewTextBox,
  onDeleteNewTextBox,
  onStartDragNewTextBox,
}: EditablePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const loadedTextRef = useRef(false);

  useEffect(() => {
    let active = true;
    const renderPageAndExtractText = async () => {
      setLoading(true);
      try {
        const page = await pdfDoc.getPage(pageNumber);
        // Render at scale 1.25 for a sharp desktop canvas size
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

        // Extract text locations for overlays (run once per page number)
        if (!loadedTextRef.current) {
          const textContent = await page.getTextContent();
          const parsed: ExistingText[] = textContent.items.map((item: any) => {
            // Convert PDF coordinates [translateX, translateY] to HTML Viewport pixels [x, y]
            const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
            const fontSize = Math.abs(item.transform[3]);
            const rHeight = fontSize * viewport.scale;
            const rWidth = item.width * viewport.scale;

            return {
              id: `existing-${pageNumber}-${Math.random().toString(36).substr(2, 9)}`,
              pageIndex: pageNumber - 1,
              text: item.str,
              originalText: item.str,
              x,
              y: y - rHeight, // align baseline to top-left coordinate
              width: rWidth,
              height: rHeight,
              pdfX: item.transform[4],
              pdfY: item.transform[5],
              fontSize,
              isDeleted: false,
            };
          });
          onLoadExistingTexts(pageNumber - 1, parsed);
          loadedTextRef.current = true;
        }
      } catch (err) {
        console.error('Error rendering/extracting page:', err);
      }
    };
    renderPageAndExtractText();

    return () => {
      active = false;
    };
  }, [pdfDoc, pageNumber]);

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onAddNewTextBox(pageNumber - 1, x, y, dimensions.width, dimensions.height);
  };

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-gray-400 mb-2 font-semibold">หน้าที่ {pageNumber}</span>
      <div
        className="relative border border-gray-300 bg-white shadow-md cursor-crosshair select-none mb-8"
        style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
        onClick={handlePageClick}
      >
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

        {loading && (
          <div className="absolute inset-0 bg-gray-50/50 flex items-center justify-center text-xs text-gray-500">
            ⏳ กำลังโหลดกระดาษ...
          </div>
        )}

        {/* Existing PDF Texts Overlay */}
        {!loading &&
          existingTexts.map((t) => {
            if (t.isDeleted) return null;
            return (
              <div
                key={t.id}
                className="absolute border border-transparent hover:border-blue-400 hover:bg-blue-50/10 group z-10 transition-colors"
                style={{
                  left: `${t.x}px`,
                  top: `${t.y}px`,
                  width: `${Math.max(30, t.width)}px`,
                  height: `${t.height}px`,
                }}
                onClick={(e) => e.stopPropagation()} // Prevent adding new box
              >
                <input
                  type="text"
                  value={t.text}
                  onChange={(e) => onUpdateExistingText(t.id, e.target.value)}
                  className="w-full h-full bg-white/70 hover:bg-white focus:bg-white border-none outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 font-sans px-1"
                  style={{
                    fontSize: `${t.height * 0.85}px`,
                    lineHeight: `${t.height}px`,
                  }}
                />
                
                {/* Delete button for existing text */}
                <button
                  onClick={() => onDeleteExistingText(t.id)}
                  className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px] font-bold opacity-0 group-hover:opacity-100 transition z-20 cursor-pointer active:scale-90"
                  title="ลบข้อความนี้ออกจากหน้า"
                >
                  ✕
                </button>
              </div>
            );
          })}

        {/* New Text Boxes Overlay */}
        {!loading &&
          newTextBoxes.map((t) => (
            <div
              key={t.id}
              className="absolute border border-dashed border-blue-400 bg-white/90 p-1 rounded cursor-move group z-20"
              style={{
                left: `${t.x}px`,
                top: `${t.y}px`,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => onStartDragNewTextBox(e, t.id)}
            >
              <input
                type="text"
                value={t.text}
                onChange={(e) => onUpdateNewTextBox(t.id, 'text', e.target.value)}
                className="bg-transparent border-none outline-none focus:ring-0 px-1 py-0.5 font-sans min-w-[60px]"
                style={{ fontSize: `${t.fontSize}px`, color: t.color }}
                autoFocus
              />

              {/* Action Toolbar */}
              <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 shadow-xl rounded-lg p-1.5 flex items-center gap-2 z-30 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition pointer-events-auto">
                <input
                  type="number"
                  value={t.fontSize}
                  onChange={(e) => onUpdateNewTextBox(t.id, 'fontSize', Math.max(8, parseInt(e.target.value) || 12))}
                  className="w-12 text-xs border border-gray-200 rounded px-1.5 py-0.5 text-center font-sans focus:outline-none"
                  title="ขนาดตัวอักษร"
                />
                <input
                  type="color"
                  value={t.color}
                  onChange={(e) => onUpdateNewTextBox(t.id, 'color', e.target.value)}
                  className="w-5 h-5 p-0 border border-gray-200 rounded cursor-pointer"
                  title="สีตัวอักษร"
                />
                <button
                  onClick={() => onDeleteNewTextBox(t.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-bold px-1 hover:bg-red-50 rounded"
                  title="ลบข้อความนี้"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function EditTextPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [existingTexts, setExistingTexts] = useState<ExistingText[]>([]);
  const [newTextBoxes, setNewTextBoxes] = useState<NewTextBox[]>([]);
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
    setExistingTexts([]);
    setNewTextBoxes([]);
    setBusy(true);
    setProgress('กำลังโหลดไฟล์ PDF...');

    try {
      const buffer = await f.arrayBuffer();
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ data: buffer }).promise;
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

  const handleLoadExistingTexts = (pageIndex: number, texts: ExistingText[]) => {
    setExistingTexts((prev) => {
      const filtered = prev.filter((t) => t.pageIndex !== pageIndex);
      return [...filtered, ...texts];
    });
  };

  const handleUpdateExistingText = (id: string, text: string) => {
    setDone(false);
    setExistingTexts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text } : t))
    );
  };

  const handleDeleteExistingText = (id: string) => {
    setDone(false);
    setExistingTexts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDeleted: true } : t))
    );
  };

  const handleAddNewTextBox = (pageIndex: number, x: number, y: number, rWidth: number, rHeight: number) => {
    setDone(false);
    const newBox: NewTextBox = {
      id: `text-${Date.now()}-${Math.random()}`,
      pageIndex,
      text: 'พิมพ์ข้อความแทรกใหม่',
      x,
      y,
      renderedWidth: rWidth,
      renderedHeight: rHeight,
      fontSize: 16,
      color: '#000000',
    };
    setNewTextBoxes((prev) => [...prev, newBox]);
  };

  const handleUpdateNewTextBox = (id: string, field: keyof NewTextBox, value: any) => {
    setDone(false);
    setNewTextBoxes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleDeleteNewTextBox = (id: string) => {
    setDone(false);
    setNewTextBoxes((prev) => prev.filter((t) => t.id !== id));
  };

  const handleStartDragNewTextBox = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const box = newTextBoxes.find((t) => t.id === id);
    if (!box) return;
    const initialX = box.x;
    const initialY = box.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const nextX = Math.max(0, Math.min(box.renderedWidth, initialX + dx));
      const nextY = Math.max(0, Math.min(box.renderedHeight, initialY + dy));

      setNewTextBoxes((prev) =>
        prev.map((t) => (t.id === id ? { ...t, x: nextX, y: nextY } : t))
      );
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const savePdf = async () => {
    if (!file) return;
    setBusy(true);
    setProgress('กำลังประมวลผลข้อความเดิมและวาดข้อความอัปเดตลงบน PDF...');
    setError(null);

    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);

      // 1. Process Existing texts (erase original & write modifications)
      for (const t of existingTexts) {
        const page = doc.getPage(t.pageIndex);
        const { width, height } = page.getSize();

        // Calculate scaling factor between viewport pixels and PDF points
        // In EditablePage, scale was 1.25
        const scaleFactor = 1.25;
        const pdfWidth = t.width / scaleFactor;
        const pdfHeight = t.fontSize;

        // Erase original text bounding box by painting a solid white rectangle
        page.drawRectangle({
          x: t.pdfX - 2, // Slight offset padding
          y: t.pdfY - 2, // Cover descenders
          width: pdfWidth + 4,
          height: pdfHeight + 4,
          color: rgb(1, 1, 1), // Solid white
        });

        // If not deleted, write the updated text on top of the erased white box
        if (!t.isDeleted) {
          // Standard fonts only support English/Latin out of the box in pdf-lib
          page.drawText(t.text, {
            x: t.pdfX,
            y: t.pdfY,
            size: t.fontSize,
            font,
            color: rgb(0, 0, 0), // Default to black text
          });
        }
      }

      // 2. Process newly added text boxes
      for (const t of newTextBoxes) {
        const page = doc.getPage(t.pageIndex);
        const { width, height } = page.getSize();

        const pdfX = (t.x / t.renderedWidth) * width;
        const pdfY = ((t.renderedHeight - t.y - t.fontSize) / t.renderedHeight) * height;
        const pdfFontSize = (t.fontSize / t.renderedHeight) * height;

        const hex = t.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;

        page.drawText(t.text, {
          x: pdfX,
          y: pdfY,
          size: pdfFontSize,
          font,
          color: rgb(r, g, b),
        });
      }

      downloadBlob(await doc.save(), `${baseName(file.name)}_edited.pdf`);
      setDone(true);
    } catch (err) {
      setError('บันทึกการแก้ไขไม่สำเร็จ: ' + (err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader
        icon="✍️"
        title="แก้ไขข้อความ PDF (PDF Text Editor)"
        description="แก้ไข ลบ หรือคุมไฮไลต์ข้อความเก่าในไฟล์เดิม พร้อมพิมพ์เสริมแทรกกล่องข้อความใหม่ทับหน้ากระดาษทำงานในเครื่องคุณทั้งหมด"
      />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวางที่นี่ หรือคลิกเพื่อเปิดการแก้ไข'}
          onFiles={pick}
        />

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
        {progress && (
          <div className="text-blue-600 text-sm flex items-center gap-2 font-medium bg-blue-50 p-3 rounded-lg">
            <span className="animate-spin text-lg">⏳</span>
            {progress}
          </div>
        )}

        {file && pdfDoc && (
          <div className="bg-gray-100 rounded-xl border border-gray-200 p-6 flex flex-col items-center">
            <div className="w-full text-center mb-6 bg-white p-4 rounded-lg border border-gray-200 text-xs text-gray-500 font-semibold shadow-sm space-y-1">
              <p>✏️ **คลิกแก้ไขข้อความเดิม**: นำเมาส์ไปคลิกบนข้อความดั้งเดิมเพื่อ ลบ แก้ไข หรือพิมพ์เติมข้อความใหม่</p>
              <p>➕ **เพิ่มข้อความใหม่**: คลิกบนที่ว่างของหน้ากระดาษเพื่อสร้างกล่องข้อความใหม่ ปรับสี ปรับขนาด และลากเลื่อนย้ายพิกัดได้อิสระ</p>
            </div>

            <div className="w-full max-h-[750px] overflow-y-auto pr-2 space-y-4">
              {Array.from({ length: pageCount }, (_, i) => (
                <EditablePage
                  key={i}
                  pageNumber={i + 1}
                  pdfDoc={pdfDoc}
                  existingTexts={existingTexts.filter((t) => t.pageIndex === i)}
                  newTextBoxes={newTextBoxes.filter((t) => t.pageIndex === i)}
                  onLoadExistingTexts={handleLoadExistingTexts}
                  onUpdateExistingText={handleUpdateExistingText}
                  onDeleteExistingText={handleDeleteExistingText}
                  onAddNewTextBox={handleAddNewTextBox}
                  onUpdateNewTextBox={handleUpdateNewTextBox}
                  onDeleteNewTextBox={handleDeleteNewTextBox}
                  onStartDragNewTextBox={handleStartDragNewTextBox}
                />
              ))}
            </div>
          </div>
        )}

        {done && <p className="text-green-600 text-sm font-semibold">✅ บันทึกและดาวน์โหลดไฟล์ที่แก้ไขเรียบร้อยแล้ว!</p>}

        <ActionButton onClick={savePdf} disabled={!file || busy} busy={busy}>
          💾 ดาวน์โหลด PDF ที่บันทึกการแก้ไขทั้งหมด
        </ActionButton>
      </div>
    </main>
  );
}
