'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';

interface TextBox {
  id: string;
  pageIndex: number;
  text: string;
  x: number; // relative to rendered page width
  y: number; // relative to rendered page height
  renderedWidth: number;
  renderedHeight: number;
  fontSize: number; // in pixels
  color: string; // hex color
}

interface EditablePageProps {
  pageNumber: number;
  pdfDoc: any;
  textBoxes: TextBox[];
  onAddTextBox: (pageIndex: number, x: number, y: number, renderedWidth: number, renderedHeight: number) => void;
  onUpdateTextBox: (id: string, field: keyof TextBox, value: any) => void;
  onDeleteTextBox: (id: string) => void;
  onStartDrag: (e: React.MouseEvent, id: string) => void;
}

function EditablePage({
  pageNumber,
  pdfDoc,
  textBoxes,
  onAddTextBox,
  onUpdateTextBox,
  onDeleteTextBox,
  onStartDrag,
}: EditablePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const renderPage = async () => {
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
      } catch (err) {
        console.error('Error rendering page:', err);
      }
    };
    renderPage();

    return () => {
      active = false;
    };
  }, [pdfDoc, pageNumber]);

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onAddTextBox(pageNumber - 1, x, y, dimensions.width, dimensions.height);
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
            ⏳ กำลังโหลด...
          </div>
        )}

        {textBoxes.map((t) => (
          <div
            key={t.id}
            className="absolute border border-dashed border-blue-400 bg-white/90 p-1.5 rounded cursor-move group z-20"
            style={{
              left: `${t.x}px`,
              top: `${t.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent clicking page container
            onMouseDown={(e) => onStartDrag(e, t.id)}
          >
            <input
              type="text"
              value={t.text}
              onChange={(e) => onUpdateTextBox(t.id, 'text', e.target.value)}
              className="bg-transparent border-none outline-none focus:ring-0 px-1.5 py-0.5 font-sans min-w-[60px]"
              style={{ fontSize: `${t.fontSize}px`, color: t.color }}
              autoFocus
            />
            
            {/* Popover Toolbar */}
            <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 shadow-xl rounded-lg p-1.5 flex items-center gap-2 z-30 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition pointer-events-auto">
              <input
                type="number"
                value={t.fontSize}
                onChange={(e) => onUpdateTextBox(t.id, 'fontSize', Math.max(8, parseInt(e.target.value) || 12))}
                className="w-12 text-xs border border-gray-200 rounded px-1.5 py-0.5 text-center font-sans focus:outline-none"
                title="ขนาดตัวอักษร"
              />
              <input
                type="color"
                value={t.color}
                onChange={(e) => onUpdateTextBox(t.id, 'color', e.target.value)}
                className="w-5 h-5 p-0 border border-gray-200 rounded cursor-pointer"
                title="สีตัวอักษร"
              />
              <button
                onClick={() => onDeleteTextBox(t.id)}
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
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
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
    setTextBoxes([]);
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

  const addTextBox = (pageIndex: number, x: number, y: number, rWidth: number, rHeight: number) => {
    setDone(false);
    const newBox: TextBox = {
      id: `text-${Date.now()}-${Math.random()}`,
      pageIndex,
      text: 'พิมพ์ข้อความที่นี่',
      x,
      y,
      renderedWidth: rWidth,
      renderedHeight: rHeight,
      fontSize: 16,
      color: '#000000',
    };
    setTextBoxes((prev) => [...prev, newBox]);
  };

  const updateTextBox = (id: string, field: keyof TextBox, value: any) => {
    setDone(false);
    setTextBoxes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const deleteTextBox = (id: string) => {
    setDone(false);
    setTextBoxes((prev) => prev.filter((t) => t.id !== id));
  };

  const handleStartDrag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const box = textBoxes.find((t) => t.id === id);
    if (!box) return;
    const initialX = box.x;
    const initialY = box.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      // Restrict text boxes inside coordinates bounds
      const nextX = Math.max(0, Math.min(box.renderedWidth, initialX + dx));
      const nextY = Math.max(0, Math.min(box.renderedHeight, initialY + dy));

      setTextBoxes((prev) =>
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
    setProgress('กำลังวาดข้อความลงบน PDF...');
    setError(null);

    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);

      for (const t of textBoxes) {
        const page = doc.getPage(t.pageIndex);
        const { width, height } = page.getSize();

        // Convert HTML layout coordinates back to PDF bottom-left origin coordinates
        const pdfX = (t.x / t.renderedWidth) * width;
        const pdfY = ((t.renderedHeight - t.y - t.fontSize) / t.renderedHeight) * height;
        const pdfFontSize = (t.fontSize / t.renderedHeight) * height;

        // Parse color hex
        const hex = t.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;

        // Draw overlay text block
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
      setError('บันทึกข้อความลง PDF ไม่สำเร็จ: ' + (err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'));
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
        description="พิมพ์ข้อความฟอร์มเพิ่มเติมทับหน้ากระดาษ — คลิกตรงไหนก็ได้ในหน้าพรีวิวเพื่อเพิ่มข้อความใหม่ ลากย้ายตำแหน่ง ปรับขนาด และแก้ไขสีอักษรได้อิสระ"
      />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวางที่นี่ หรือคลิกเลือกเพื่อเริ่มพิมพ์แก้ไข'}
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
            <div className="w-full text-center mb-6 bg-white p-3 rounded-lg border border-gray-200 text-xs text-gray-500 font-semibold shadow-sm">
              💡 คลิกเมาส์ตำแหน่งใดก็ได้บนหน้ากระดาษเพื่อเพิ่มกล่องข้อความ | ลากกล่องข้อความเพื่อเลื่อนตำแหน่ง | โฮเวอร์กล่องข้อความเพื่อเปิดแถบเครื่องมือปรับสี/ขนาดอักษร
            </div>

            <div className="w-full max-h-[700px] overflow-y-auto pr-2 space-y-4">
              {Array.from({ length: pageCount }, (_, i) => (
                <EditablePage
                  key={i}
                  pageNumber={i + 1}
                  pdfDoc={pdfDoc}
                  textBoxes={textBoxes.filter((t) => t.pageIndex === i)}
                  onAddTextBox={addTextBox}
                  onUpdateTextBox={updateTextBox}
                  onDeleteTextBox={deleteTextBox}
                  onStartDrag={handleStartDrag}
                />
              ))}
            </div>
          </div>
        )}

        {done && <p className="text-green-600 text-sm font-semibold">✅ บันทึกและดาวน์โหลดไฟล์ที่แก้ไขข้อความเรียบร้อยแล้ว!</p>}

        <ActionButton onClick={savePdf} disabled={!file || busy} busy={busy}>
          💾 ดาวน์โหลด PDF ที่แก้ไขข้อความเรียบร้อย ({textBoxes.length} กล่องข้อความ)
        </ActionButton>
      </div>
    </main>
  );
}
