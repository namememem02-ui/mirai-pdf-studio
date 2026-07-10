'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PDFPreviewModal from '@/components/PDFPreviewModal';

interface OrganizePageItem {
  id: string; // React key
  type: 'pdf' | 'blank' | 'image';
  fileId?: string; // Key in loadedBuffers
  fileName?: string; // Display file source name
  originalIndex?: number; // 0-indexed page index in the source PDF
  thumbnail?: string; // Data URL for PDF pages
  imageFile?: File; // If type is image
  imageUrl?: string; // URL for image preview
  rotation: number; // 0, 90, 180, 270
}

export default function OrganizePage() {
  const { addToQueue, queue, downloadItem } = useDownloadQueue();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [items, setItems] = useState<OrganizePageItem[]>([]);
  const [loadedBuffers, setLoadedBuffers] = useState<Record<string, ArrayBuffer>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  const insertPdfInputRef = useRef<HTMLInputElement>(null);
  const insertImageInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.imageUrl) URL.revokeObjectURL(item.imageUrl);
      });
    };
  }, [items]);

  const loadPdfPages = async (f: File, isPrimary: boolean) => {
    try {
      const buffer = await f.arrayBuffer();
      const fileId = `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      setLoadedBuffers((prev) => ({
        ...prev,
        [fileId]: buffer,
      }));

      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/cmaps/',
        cMapPacked: true, data: buffer.slice(0) }).promise;
      const count = doc.numPages;

      const newItems: OrganizePageItem[] = [];
      for (let i = 0; i < count; i++) {
        setProgress(`กำลังอ่านและพรีวิวหน้า ${i + 1} จาก ${count} ของไฟล์ ${f.name}...`);
        const page = await doc.getPage(i + 1);
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        newItems.push({
          id: `page-${fileId}-${i}-${Math.random()}`,
          type: 'pdf',
          fileId,
          fileName: f.name,
          originalIndex: i,
          thumbnail: canvas.toDataURL(),
          rotation: 0,
        });
      }

      if (isPrimary) {
        setFile(f);
        setPageCount(count);
        setItems(newItems);
      } else {
        setItems((prev) => [...prev, ...newItems]);
      }
      setError(null);
    } catch (err) {
      setError(`เปิดไฟล์ ${f.name} ไม่สำเร็จ ไฟล์อาจเสียหายหรือมีระบบป้องกันการเข้าถึง`);
    }
  };

  const pickPrimary = async (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('กรุณาเลือกไฟล์ PDF หลัก');
      return;
    }
    setBusy(true);
    setDone(false);
    setItems([]);
    setLoadedBuffers({});
    await loadPdfPages(f, true);
    setBusy(false);
    setProgress('');
  };

  // Insert Pages from another PDF
  const handleInsertPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('กรุณาเลือกไฟล์ PDF สำหรับแทรก');
      return;
    }
    setBusy(true);
    setDone(false);
    await loadPdfPages(f, false);
    setBusy(false);
    setProgress('');
    e.target.value = '';
  };

  // Insert Image Page
  const handleInsertImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const f = files[0];
    const type = f.type;
    if (type !== 'image/jpeg' && type !== 'image/png') {
      setError('รองรับเฉพาะภาพ JPG และ PNG เท่านั้น');
      return;
    }
    setError(null);
    setDone(false);

    const newItem: OrganizePageItem = {
      id: `img-${Date.now()}-${Math.random()}`,
      type: 'image',
      fileName: f.name,
      imageFile: f,
      imageUrl: URL.createObjectURL(f),
      rotation: 0,
    };

    setItems((prev) => [...prev, newItem]);
    e.target.value = '';
  };

  // Insert Blank A4 Page
  const handleInsertBlank = () => {
    setDone(false);
    const newItem: OrganizePageItem = {
      id: `blank-${Date.now()}-${Math.random()}`,
      type: 'blank',
      rotation: 0,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const move = (i: number, dir: -1 | 1) => {
    setDone(false);
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const rotate = (i: number) => {
    setDone(false);
    setItems((prev) => {
      const next = [...prev];
      next[i] = {
        ...next[i],
        rotation: (next[i].rotation + 90) % 360,
      };
      return next;
    });
  };

  const remove = (i: number) => {
    setDone(false);
    const item = items[i];
    if (item.imageUrl) URL.revokeObjectURL(item.imageUrl);
    setItems((prev) => prev.filter((_, k) => k !== i));
  };

  const savePdf = async () => {
    if (items.length === 0) {
      setError('ไม่มีหน้าใด ๆ ในคิวงาน กรุณาแทรกหน้าข้อมูล');
      return;
    }
    setBusy(true);
    setProgress('กำลังประมวลผลและสร้างไฟล์ PDF ใหม่...');
    setError(null);
    setDone(false);
    setResultItemId(null);

    try {
      const out = await PDFDocument.create();

      for (const item of items) {
        if (item.type === 'pdf' && item.fileId && item.originalIndex !== undefined) {
          const buffer = loadedBuffers[item.fileId];
          const srcDoc = await PDFDocument.load(buffer.slice(0), { ignoreEncryption: true });
          const [copiedPage] = await out.copyPages(srcDoc, [item.originalIndex]);
          
          // Apply custom rotation
          if (item.rotation !== 0) {
            copiedPage.setRotation(degrees((copiedPage.getRotation().angle + item.rotation) % 360));
          }
          out.addPage(copiedPage);
        } else if (item.type === 'blank') {
          const blankPage = out.addPage([595.275, 841.89]); // A4 Size
          if (item.rotation !== 0) {
            blankPage.setRotation(degrees(item.rotation));
          }
        } else if (item.type === 'image' && item.imageFile) {
          const imgBytes = await item.imageFile.arrayBuffer();
          const embeddedImage =
            item.imageFile.type === 'image/png'
              ? await out.embedPng(imgBytes)
              : await out.embedJpg(imgBytes);

          const imgPage = out.addPage([embeddedImage.width, embeddedImage.height]);
          imgPage.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: embeddedImage.width,
            height: embeddedImage.height,
          });

          if (item.rotation !== 0) {
            imgPage.setRotation(degrees(item.rotation));
          }
        }
      }

      const outName = file ? `${baseName(file.name)}_organized.pdf` : 'organized.pdf';
      const outBytes = await out.save();
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const id = addToQueue(outName, blob);
      setResultItemId(id);
      setDone(true);
    } catch (err) {
      setError('ประมวลผลบันทึกไฟล์ไม่สำเร็จ: ' + (err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader
        icon="📋"
        title="จัดระเบียบหน้า PDF (Page Organizer)"
        description="ปรับแต่งไฟล์อย่างสมบูรณ์แบบ — ลากสลับลำดับหน้า, หมุน, ลบ, แทรกหน้าว่าง หรือแทรกไฟล์ PDF/รูปภาพเพิ่มเติมในคิวหน้าได้แบบในโปรแกรม PDFgear"
      />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์หลัก` : 'ลากไฟล์ PDF หลักมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์เริ่มต้น'}
          onFiles={pickPrimary}
        />

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
        {progress && (
          <div className="text-blue-600 text-sm flex items-center gap-2 font-medium bg-blue-50 p-3 rounded-lg">
            <span className="animate-spin text-lg">⏳</span>
            {progress}
          </div>
        )}

        {/* Hidden inputs for tools */}
        <input
          ref={insertPdfInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleInsertPdf}
        />
        <input
          ref={insertImageInputRef}
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleInsertImage}
        />

        {items.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            {/* Toolbar section */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <span className="text-sm font-bold text-gray-700">แทรกหน้าเนื้อหาเพิ่มเติม:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleInsertBlank}
                  className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer"
                >
                  ➕ แทรกหน้าว่าง (A4)
                </button>
                <button
                  onClick={() => insertPdfInputRef.current?.click()}
                  className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer"
                >
                  ➕ แทรกหน้าจาก PDF อื่น
                </button>
                <button
                  onClick={() => insertImageInputRef.current?.click()}
                  className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer"
                >
                  ➕ แทรกหน้าจากรูปภาพ
                </button>
                <button
                  onClick={() => {
                    if (confirm('คุณแน่ใจใช่ไหมว่าต้องการล้างคิวหน้าทั้งหมด?')) {
                      setItems([]);
                      setFile(null);
                    }
                  }}
                  className="px-3.5 py-2 bg-red-50 border border-red-150 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition cursor-pointer"
                >
                  🗑️ ล้างทั้งหมด
                </button>
              </div>
            </div>

            {/* Organize Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col justify-between hover:shadow-md transition relative group"
                >
                  <div>
                    {/* Thumbnail Viewport */}
                    <div className="w-full aspect-[3/4] overflow-hidden flex items-center justify-center bg-white border border-gray-100 rounded-lg relative">
                      {item.type === 'pdf' && item.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnail}
                          alt={`หน้า ${i + 1}`}
                          className="max-w-full max-h-full object-contain transition-transform duration-150"
                          style={{ transform: `rotate(${item.rotation}deg)` }}
                        />
                      )}
                      {item.type === 'blank' && (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-white">
                          <span className="text-[10px] font-bold text-gray-400 border border-dashed border-gray-300 px-2 py-3 uppercase tracking-wider select-none">
                            หน้าว่าง
                          </span>
                        </div>
                      )}
                      {item.type === 'image' && item.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={`รูปภาพหน้า ${i + 1}`}
                          className="max-w-full max-h-full object-contain transition-transform duration-150"
                          style={{ transform: `rotate(${item.rotation}deg)` }}
                        />
                      )}
                      
                      {/* Delete absolute button */}
                      <button
                        onClick={() => remove(i)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-50 text-red-500 border border-red-100 flex items-center justify-center text-xs hover:bg-red-500 hover:text-white transition cursor-pointer active:scale-90 z-20"
                        title="ลบหน้านี้ออก"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="text-center mt-2.5 space-y-0.5">
                      <span className="text-[11px] font-bold text-gray-700 block">คิวที่ {i + 1}</span>
                      
                      {/* Sub-label explaining source */}
                      <span className="text-[9px] text-gray-400 block truncate px-1 max-w-full">
                        {item.type === 'pdf' && `📄 ${item.fileName} (หน้า ${item.originalIndex! + 1})`}
                        {item.type === 'blank' && '⬜ กระดาษเปล่า A4'}
                        {item.type === 'image' && `🖼️ ${item.fileName}`}
                      </span>
                    </div>
                  </div>

                  {/* Actions footer bar */}
                  <div className="flex items-center justify-between border-t border-gray-200/50 mt-3 pt-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        className="w-6 h-6 rounded border border-gray-200 bg-white text-xs text-gray-700 flex items-center justify-center hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                        title="ย้ายไปซ้าย"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => move(i, 1)}
                        disabled={i === items.length - 1}
                        className="w-6 h-6 rounded border border-gray-200 bg-white text-xs text-gray-700 flex items-center justify-center hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                        title="ย้ายไปขวา"
                      >
                        →
                      </button>
                    </div>

                    <button
                      onClick={() => rotate(i)}
                      className="px-2 h-6 rounded border border-gray-200 bg-white text-[10px] font-semibold text-gray-600 flex items-center gap-1 hover:bg-gray-100 cursor-pointer active:scale-95"
                      title="หมุนหน้านี้ 90°"
                    >
                      🔄 {item.rotation !== 0 ? `${item.rotation}°` : 'หมุน'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {done && resultItemId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
            <span className="text-4xl block">🎉</span>
            <h3 className="font-bold text-emerald-800 text-sm">จัดระเบียบหน้า PDF เสร็จเรียบร้อยแล้ว!</h3>
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

        <ActionButton onClick={savePdf} disabled={items.length === 0 || busy} busy={busy}>
          💾 เริ่มประมวลผลจัดระเบียบและบันทึก PDF ใหม่
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
