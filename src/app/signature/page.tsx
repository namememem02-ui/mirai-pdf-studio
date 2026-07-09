'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PDFPreviewModal from '@/components/PDFPreviewModal';

interface SignatureInstance {
  id: string;
  pageIndex: number;
  x: number; // HTML viewport x (left)
  y: number; // HTML viewport y (top)
  width: number; // HTML pixels
  height: number; // HTML pixels
  renderedWidth: number;
  renderedHeight: number;
  dataUrl: string;
}

interface EditablePageProps {
  pageNumber: number;
  pdfDoc: any;
  signatures: SignatureInstance[];
  activeSignature: string | null;
  onAddSignature: (pageIndex: number, x: number, y: number, renderedWidth: number, renderedHeight: number) => void;
  onUpdateSignatureWidth: (id: string, width: number) => void;
  onDeleteSignature: (id: string) => void;
  onStartDrag: (e: React.MouseEvent, id: string) => void;
}

function EditablePage({
  pageNumber,
  pdfDoc,
  signatures,
  activeSignature,
  onAddSignature,
  onUpdateSignatureWidth,
  onDeleteSignature,
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
    if (!activeSignature) return; // Only add if we have an active signature selected
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onAddSignature(pageNumber - 1, x, y, dimensions.width, dimensions.height);
  };

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-gray-400 mb-2 font-semibold">หน้าที่ {pageNumber}</span>
      <div
        className={`relative border border-gray-300 bg-white shadow-md select-none mb-8 ${
          activeSignature ? 'cursor-copy' : 'cursor-default'
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

        {signatures.map((sig) => (
          <div
            key={sig.id}
            className="absolute border border-dashed border-purple-400 bg-white/40 p-1 rounded cursor-move group z-20"
            style={{
              left: `${sig.x}px`,
              top: `${sig.y}px`,
              width: `${sig.width}px`,
              height: `${sig.height}px`,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => onStartDrag(e, sig.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sig.dataUrl}
              alt="ลายเซ็น"
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* Signature Control Panel */}
            <div
              className="absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 bg-white border border-gray-200 shadow-xl rounded-lg p-2 flex items-center gap-2.5 z-30 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition pointer-events-auto w-48"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex-1 flex flex-col gap-0.5">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">ขนาดกว้าง</span>
                <input
                  type="range"
                  min="40"
                  max="350"
                  value={sig.width}
                  onChange={(e) => onUpdateSignatureWidth(sig.id, parseInt(e.target.value) || 100)}
                  className="w-full h-1 bg-gray-200 rounded-lg cursor-pointer accent-purple-600"
                />
              </div>
              <button
                onClick={() => onDeleteSignature(sig.id)}
                className="text-xs text-red-500 hover:text-red-700 font-bold px-1.5 py-1 hover:bg-red-50 rounded"
                title="ลบลายเซ็นนี้"
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

export default function SignaturePage() {
  const { addToQueue, queue, downloadItem } = useDownloadQueue();
  
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [signatures, setSignatures] = useState<SignatureInstance[]>([]);

  // Signature creation states
  const [activeSignature, setActiveSignature] = useState<string | null>(null);
  const [customSignatures, setCustomSignatures] = useState<string[]>([]);
  const [creationMode, setCreationMode] = useState<'draw' | 'upload'>('draw');

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  // Drawing Pad Canvas references
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  // Load drawing context settings
  useEffect(() => {
    if (creationMode === 'draw') {
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000000';
    }
  }, [creationMode]);

  const pick = async (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('กรุณาเลือกไฟล์ PDF');
      return;
    }
    setError(null);
    setDone(false);
    setFile(f);
    setSignatures([]);
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

  // Drawing pad drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d')!;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearDrawing = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveDrawing = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    
    // Check if canvas is empty to prevent blank signatures
    const ctx = canvas.getContext('2d')!;
    const buffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
    const hasDrawContent = buffer.some(color => color !== 0);

    if (!hasDrawContent) {
      setError('กรุณาวาดลายเซ็นก่อนทำการบันทึก');
      return;
    }

    setError(null);
    const dataUrl = canvas.toDataURL('image/png');
    setCustomSignatures((prev) => [dataUrl, ...prev]);
    setActiveSignature(dataUrl);
    clearDrawing();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const f = files[0];
    if (f.type !== 'image/png' && f.type !== 'image/jpeg') {
      setError('รองรับเฉพาะรูปภาพ PNG และ JPG');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCustomSignatures((prev) => [dataUrl, ...prev]);
      setActiveSignature(dataUrl);
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  // Add signature stamp instance to a page
  const handleAddSignature = (pageIndex: number, x: number, y: number, rWidth: number, rHeight: number) => {
    if (!activeSignature) return;

    // Create a temporary image to calculate aspect ratio
    const img = new Image();
    img.src = activeSignature;
    img.onload = () => {
      const ratio = img.width / img.height;
      const width = 150; // Default width in HTML pixels
      const height = width / ratio;

      const newSig: SignatureInstance = {
        id: `sig-${Date.now()}-${Math.random()}`,
        pageIndex,
        x,
        y,
        width,
        height,
        renderedWidth: rWidth,
        renderedHeight: rHeight,
        dataUrl: activeSignature,
      };

      setSignatures((prev) => [...prev, newSig]);
      setDone(false);
    };
  };

  const handleUpdateSignatureWidth = (id: string, width: number) => {
    setSignatures((prev) =>
      prev.map((sig) => {
        if (sig.id === id) {
          const ratio = sig.width / sig.height;
          return {
            ...sig,
            width,
            height: width / ratio,
          };
        }
        return sig;
      })
    );
    setDone(false);
  };

  const handleDeleteSignature = (id: string) => {
    setSignatures((prev) => prev.filter((sig) => sig.id !== id));
    setDone(false);
  };

  const handleStartDrag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const sig = signatures.find((s) => s.id === id);
    if (!sig) return;
    const initialX = sig.x;
    const initialY = sig.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const nextX = Math.max(0, Math.min(sig.renderedWidth, initialX + dx));
      const nextY = Math.max(0, Math.min(sig.renderedHeight, initialY + dy));

      setSignatures((prev) =>
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
    if (signatures.length === 0) {
      setError('กรุณาเซ็นชื่อ/ประทับตราวางบนหน้ากระดาษอย่างน้อย 1 จุด');
      return;
    }

    setBusy(true);
    setProgress('กำลังฝังลายนามภาพและลายเซ็นลงบนไฟล์ PDF...');
    setError(null);
    setDone(false);
    setResultItemId(null);

    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });

      // Keep cache of embedded image instances in PDF
      const embeddedImageCache: Record<string, any> = {};

      for (const sig of signatures) {
        const page = doc.getPage(sig.pageIndex);
        const { width, height } = page.getSize();

        // Convert base64 dataUrl signature to image bytes
        let sigImage = embeddedImageCache[sig.dataUrl];
        if (!sigImage) {
          const base64Content = sig.dataUrl.split(',')[1];
          const imgBytes = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
          
          sigImage = sig.dataUrl.startsWith('data:image/png')
            ? await doc.embedPng(imgBytes)
            : await doc.embedJpg(imgBytes);
            
          embeddedImageCache[sig.dataUrl] = sigImage;
        }

        // Convert HTML viewport pixels coordinates to PDF bottom-left origin coordinates
        // HTML signature is centered at (sig.x, sig.y) due to transform: translate(-50%, -50%)
        const sigLeft = sig.x - sig.width / 2;
        const sigTop = sig.y - sig.height / 2;

        const pdfX = (sigLeft / sig.renderedWidth) * width;
        const pdfY = ((sig.renderedHeight - sigTop - sig.height) / sig.renderedHeight) * height;
        const pdfWidth = (sig.width / sig.renderedWidth) * width;
        const pdfHeight = (sig.height / sig.renderedHeight) * height;

        page.drawImage(sigImage, {
          x: pdfX,
          y: pdfY,
          width: pdfWidth,
          height: pdfHeight,
        });
      }

      const outName = `${baseName(file.name)}_signed.pdf`;
      const outBytes = await doc.save();
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const id = addToQueue(outName, blob);
      setResultItemId(id);
      setDone(true);
    } catch (err) {
      setError('ปั๊มลายเซ็นไม่สำเร็จ: ' + (err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader
        icon="🖋️"
        title="เซ็นชื่อ PDF"
        description="วาดเขียนลายเซ็น หรืออัปโหลดภาพลายเซ็นเพื่อปั๊มวางทับลงหน้าเอกสาร PDF ขยับเลื่อนพิกัด และย่อขยายขนาดได้ทันที"
      />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวางที่นี่ หรือคลิกเพื่ออัปโหลดไฟล์ที่จะเซ็น'}
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
            {/* Signature Creation Panel */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-4 space-y-5 shadow-sm">
              <span className="text-sm font-bold text-gray-700 block border-b border-gray-100 pb-2">
                ✍️ สร้างและเลือกลายเซ็น
              </span>

              {/* Mode switch */}
              <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs font-bold divide-x divide-gray-200">
                <button
                  onClick={() => setCreationMode('draw')}
                  className={`flex-1 py-2 text-center transition cursor-pointer border-none ${
                    creationMode === 'draw' ? 'bg-purple-50 text-purple-700' : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  ✏️ เขียนลายเซ็น
                </button>
                <button
                  onClick={() => setCreationMode('upload')}
                  className={`flex-1 py-2 text-center transition cursor-pointer border-none ${
                    creationMode === 'upload' ? 'bg-purple-50 text-purple-700' : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  🖼️ อัปโหลดรูปภาพ
                </button>
              </div>

              {creationMode === 'draw' && (
                <div className="space-y-3">
                  <div className="border border-gray-200 bg-gray-50 rounded-lg relative overflow-hidden h-40">
                    <canvas
                      ref={drawCanvasRef}
                      width={300}
                      height={160}
                      className="w-full h-full bg-white cursor-pencil"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={clearDrawing}
                        className="p-1 text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded border border-gray-200 transition cursor-pointer"
                      >
                        เคลียร์หน้า
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={saveDrawing}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    💾 บันทึกลายเซ็นเพื่อใช้
                  </button>
                </div>
              )}

              {creationMode === 'upload' && (
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg h-32 hover:bg-gray-50 cursor-pointer p-4 text-center">
                    <span className="text-xl">📷</span>
                    <span className="text-xs font-bold text-gray-600 mt-1">เลือกรูปลายเซ็น (PNG แนะนำ)</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">รองรับ JPG, PNG</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              )}

              {/* Signature List selection */}
              {customSignatures.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    ลายเซ็นที่พร้อมใช้งาน:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {customSignatures.map((sig, idx) => (
                      <div
                        key={idx}
                        onClick={() => setActiveSignature(sig)}
                        className={`border rounded-lg p-2 flex items-center justify-center h-16 bg-white cursor-pointer relative transition ${
                          activeSignature === sig
                            ? 'border-purple-600 ring-2 ring-purple-100'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sig} alt="Signature thumbnail" className="max-w-full max-h-full object-contain" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeSignature === sig) setActiveSignature(null);
                            setCustomSignatures((prev) => prev.filter((item) => item !== sig));
                          }}
                          className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center hover:bg-red-600 shadow cursor-pointer border-none"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Preview and Stamper area */}
            <div className="lg:col-span-8 flex flex-col items-center">
              <div className="w-full bg-purple-50 text-purple-800 rounded-lg p-3.5 border border-purple-100 text-xs font-semibold text-center mb-5 shadow-sm leading-relaxed">
                {activeSignature ? (
                  <p>👉 **แตะ/คลิกเมาส์** ตรงตำแหน่งใดก็ได้บนหน้าพรีวิวด้านล่าง เพื่อ **ประทับลายเซ็น** | ลากย้ายตำแหน่ง หรือโฮเวอร์เพื่อย่อขยายขนาดได้อิสระ</p>
                ) : (
                  <p>💡 กรุณาสร้างหรือเลือกลายเซ็นจากแผงควบคุมด้านซ้ายก่อนเริ่มเซ็นชื่อบนหน้าเอกสาร</p>
                )}
              </div>

              <div className="w-full max-h-[750px] overflow-y-auto pr-2 space-y-4">
                {Array.from({ length: pageCount }, (_, i) => (
                  <EditablePage
                    key={i}
                    pageNumber={i + 1}
                    pdfDoc={pdfDoc}
                    signatures={signatures.filter((s) => s.pageIndex === i)}
                    activeSignature={activeSignature}
                    onAddSignature={handleAddSignature}
                    onUpdateSignatureWidth={handleUpdateSignatureWidth}
                    onDeleteSignature={handleDeleteSignature}
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
            <h3 className="font-bold text-emerald-800 text-sm">ฝังลายเซ็นลงบน PDF เสร็จเรียบร้อยแล้ว!</h3>
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

        <ActionButton onClick={savePdf} disabled={!file || signatures.length === 0 || busy} busy={busy}>
          🖋️ เริ่มฝังลายเซ็นลงบน PDF
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
