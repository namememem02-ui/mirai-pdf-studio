'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PDFPreviewModal from '@/components/PDFPreviewModal';

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
}

interface EditablePageProps {
  pageNumber: number;
  pdfDoc: any;
  textInstances: TextInstance[];
  activeText: string;
  activeFontSize: number;
  activeColor: string;
  onAddText: (pageIndex: number, x: number, y: number, renderedWidth: number, renderedHeight: number) => void;
  onUpdateText: (id: string, text: string) => void;
  onUpdateFontSize: (id: string, size: number) => void;
  onDeleteText: (id: string) => void;
  onStartDrag: (e: React.MouseEvent, id: string) => void;
}

function EditablePage({
  pageNumber,
  pdfDoc,
  textInstances,
  activeText,
  activeFontSize,
  activeColor,
  onAddText,
  onUpdateText,
  onUpdateFontSize,
  onDeleteText,
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
    if (!activeText.trim()) return; // Only add if we have active text
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onAddText(pageNumber - 1, x, y, dimensions.width, dimensions.height);
  };

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-gray-400 mb-2 font-semibold">หน้าที่ {pageNumber}</span>
      <div
        className={`relative border border-gray-300 bg-white shadow-md select-none mb-8 ${
          activeText ? 'cursor-text' : 'cursor-default'
        }`}
        style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
        onClick={handlePageClick}
      >
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

        {loading && (
          <div className="absolute inset-0 bg-gray-50/50 flex items-center justify-center text-xs text-gray-500">
            ⏳ กำลังโหลดกระดาษ...
          </div>
        )}

        {textInstances.map((inst) => (
          <div
            key={inst.id}
            className="absolute border border-dashed border-pink-400 bg-white/40 p-1.5 rounded cursor-move group z-20"
            style={{
              left: `${inst.x}px`,
              top: `${inst.y}px`,
              transform: 'translate(-50%, -50%)',
              whiteSpace: 'nowrap',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => onStartDrag(e, inst.id)}
          >
            <span
              style={{
                fontSize: `${inst.fontSize}px`,
                color: inst.color,
                fontWeight: 'bold',
                fontFamily: 'Sarabun, sans-serif',
              }}
            >
              {inst.text}
            </span>

            {/* Text Overlay Controls */}
            <div
              className="absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 bg-white border border-gray-200 shadow-xl rounded-lg p-2.5 flex flex-col gap-2 z-30 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition pointer-events-auto w-56"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">แก้ไขข้อความ</span>
                <input
                  type="text"
                  value={inst.text}
                  onChange={(e) => onUpdateText(inst.id, e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-sans focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">ขนาดอักษร: {inst.fontSize}px</span>
                  <input
                    type="range"
                    min="8"
                    max="64"
                    value={inst.fontSize}
                    onChange={(e) => onUpdateFontSize(inst.id, parseInt(e.target.value) || 12)}
                    className="w-full h-1 bg-gray-250 rounded-lg cursor-pointer accent-pink-500"
                  />
                </div>
                <button
                  onClick={() => onDeleteText(inst.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-bold px-1.5 py-1 hover:bg-red-50 rounded mt-2"
                  title="ลบข้อความนี้"
                >
                  ✕ ลบ
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AddTextPage() {
  const { addToQueue, queue, downloadItem } = useDownloadQueue();

  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [textInstances, setTextInstances] = useState<TextInstance[]>([]);

  // Text settings states
  const [activeText, setActiveText] = useState('ข้อความใหม่');
  const [activeFontSize, setActiveFontSize] = useState(16);
  const [activeColor, setActiveColor] = useState('#ff0055');
  const [thaiFontBytes, setThaiFontBytes] = useState<ArrayBuffer | null>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  // Fetch Thai Sarabun font at runtime for pdf-lib TrueType rendering
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Regular.ttf')
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.arrayBuffer();
      })
      .then((bytes) => setThaiFontBytes(bytes))
      .catch((err) => {
        console.warn('Failed to load online Sarabun font, Thai text will fall back to Helvetica.', err);
      });
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
    };

    setTextInstances((prev) => [...prev, newInst]);
    setDone(false);
  };

  const handleUpdateText = (id: string, text: string) => {
    setTextInstances((prev) =>
      prev.map((inst) => (inst.id === id ? { ...inst, text } : inst))
    );
    setDone(false);
  };

  const handleUpdateFontSize = (id: string, fontSize: number) => {
    setTextInstances((prev) =>
      prev.map((inst) => (inst.id === id ? { ...inst, fontSize } : inst))
    );
    setDone(false);
  };

  const handleDeleteText = (id: string) => {
    setTextInstances((prev) => prev.filter((inst) => inst.id !== id));
    setDone(false);
  };

  const handleStartDrag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const inst = textInstances.find((s) => s.id === id);
    if (!inst) return;
    const initialX = inst.x;
    const initialY = inst.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const nextX = Math.max(0, Math.min(inst.renderedWidth, initialX + dx));
      const nextY = Math.max(0, Math.min(inst.renderedHeight, initialY + dy));

      setTextInstances((prev) =>
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

  const savePdf = async () => {
    if (!file) return;
    if (textInstances.length === 0) {
      setError('กรุณาพิมพ์และคลิกวางข้อความบนหน้ากระดาษอย่างน้อย 1 จุด');
      return;
    }

    setBusy(true);
    setProgress('กำลังประมวลผลเขียนข้อความทับลงบนไฟล์ PDF...');
    setError(null);
    setDone(false);
    setResultItemId(null);

    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      doc.registerFontkit(fontkit);

      // Embed Thai font or Helvetica fallback
      const customFont = thaiFontBytes
        ? await doc.embedFont(thaiFontBytes, { subset: true })
        : await doc.embedFont(StandardFonts.Helvetica);

      for (const inst of textInstances) {
        if (!inst.text.trim()) continue;

        const page = doc.getPage(inst.pageIndex);
        const { width, height } = page.getSize();

        // Hex to rgb conversion
        const cleanHex = inst.color.replace('#', '');
        const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
        const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

        // Map HTML font size to PDF font size points
        const pdfFontSize = (inst.fontSize / inst.renderedHeight) * height;

        // Measure text boundary in PDF points to center properly
        const textWidth = customFont.widthOfTextAtSize(inst.text, pdfFontSize);
        const textHeight = customFont.heightAtSize(pdfFontSize);

        // Center overlay calculation mapping:
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
      setResultItemId(id);
      setDone(true);
    } catch (err) {
      setError('บันทึกข้อความลง PDF ไม่สำเร็จ: ' + (err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader
        icon="✍️"
        title="เพิ่มข้อความ PDF"
        description="พิมพ์ตัวอักษร เติมข้อความ หรือกรอกแบบฟอร์มลงบนเอกสาร PDF ลากย้ายจัดตำแหน่ง ปรับเปลี่ยนสีและขนาดฟอนต์ได้ตามต้องการ"
      />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวางที่นี่ หรือคลิกเพื่ออัปโหลดไฟล์ที่จะพิมพ์ข้อความ'}
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
            {/* Text Settings Sidebar */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-4 space-y-4 shadow-sm">
              <span className="text-sm font-bold text-gray-700 block border-b border-gray-100 pb-2">
                ⚙️ ตั้งค่าข้อความพิมพ์
              </span>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">คำที่จะพิมพ์</label>
                <input
                  type="text"
                  value={activeText}
                  onChange={(e) => setActiveText(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500"
                  placeholder="เช่น ข้อความของคุณ..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">ขนาดอักษรเริ่มต้น</label>
                  <input
                    type="number"
                    value={activeFontSize}
                    onChange={(e) => setActiveFontSize(Math.max(8, parseInt(e.target.value) || 12))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">สีตัวอักษร</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeColor}
                      onChange={(e) => setActiveColor(e.target.value)}
                      className="w-8 h-8 p-0 border border-gray-300 rounded cursor-pointer border-none bg-transparent"
                    />
                    <span className="text-xs uppercase text-gray-500">{activeColor}</span>
                  </div>
                </div>
              </div>

              {!thaiFontBytes && (
                <div className="text-[10px] text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-100 leading-normal">
                  ⚠️ ยังโหลดฟอนต์ภาษาไทยออนไลน์ไม่เสร็จ ตัวอักษรไทยอาจไม่ถูกวาดบนไฟล์ PDF หรือใช้อักษรพื้นหลังแทน
                </div>
              )}
            </div>

            {/* Preview and Stamping canvas container */}
            <div className="lg:col-span-8 flex flex-col items-center">
              <div className="w-full bg-pink-50 text-pink-800 rounded-lg p-3.5 border border-pink-100 text-xs font-semibold text-center mb-5 shadow-sm leading-relaxed">
                {activeText.trim() ? (
                  <p>👉 **คลิกเมาส์** ตรงจุดใดก็ได้บนหน้ากระดาษเพื่อ **วางพิมพ์ข้อความ** | ดึงลากเพื่อเปลี่ยนตำแหน่ง หรือขยับปัดแก้ไขข้อความได้ทันที</p>
                ) : (
                  <p>💡 กรุณากรอกข้อความที่จะพิมพ์ในแผงควบคุมด้านซ้ายก่อนวางบนหน้ากระดาษ</p>
                )}
              </div>

              <div className="w-full max-h-[750px] overflow-y-auto pr-2 space-y-4">
                {Array.from({ length: pageCount }, (_, i) => (
                  <EditablePage
                    key={i}
                    pageNumber={i + 1}
                    pdfDoc={pdfDoc}
                    textInstances={textInstances.filter((s) => s.pageIndex === i)}
                    activeText={activeText}
                    activeFontSize={activeFontSize}
                    activeColor={activeColor}
                    onAddText={handleAddText}
                    onUpdateText={handleUpdateText}
                    onUpdateFontSize={handleUpdateFontSize}
                    onDeleteText={handleDeleteText}
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
            <h3 className="font-bold text-emerald-800 text-sm">เขียนข้อความทับลงบนเอกสาร PDF สำเร็จแล้ว!</h3>
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

        <ActionButton onClick={savePdf} disabled={!file || textInstances.length === 0 || busy} busy={busy}>
          ✍️ เริ่มเขียนบันทึกข้อความลงบน PDF
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
