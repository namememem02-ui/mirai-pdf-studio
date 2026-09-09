'use client';

import React, { useState, useEffect, useRef } from 'react';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { recordToolUsage } from '@/lib/usage';
import {
  buildPdfFromImages,
  ImagePdfLayoutMode,
  LayoutItemInput,
} from '@/lib/image-to-pdf-layout';

interface QueueItem {
  id: string;
  type: 'image' | 'blank';
  file?: File;
  url?: string;
  caption?: string;
  isEditingCaption?: boolean;
}

const OK_TYPES = ['image/jpeg', 'image/png'];

export default function ImageToPdfPage() {
  const { addToQueue, queue, downloadItem } = useDownloadQueue();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);
  const [dragOverGrid, setDragOverGrid] = useState(false);

  // Layout and header settings
  const [layoutMode, setLayoutMode] = useState<ImagePdfLayoutMode>('grid_4');
  const [headerText, setHeaderText] = useState('');
  const [showHeaderInput, setShowHeaderInput] = useState(false);

  // Hidden input for appending extra images
  const appendFileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
    };
  }, [items]);

  const addFiles = (incoming: File[]) => {
    const imgs = incoming.filter((f) => OK_TYPES.includes(f.type));
    if (imgs.length < incoming.length) {
      setError('ข้ามไฟล์ที่ไม่ใช่ JPG หรือ PNG ให้แล้ว');
    } else {
      setError(null);
    }
    const newItems: QueueItem[] = imgs.map((f) => ({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'image',
      file: f,
      url: URL.createObjectURL(f),
      caption: '',
      isEditingCaption: false,
    }));
    setItems((prev) => [...prev, ...newItems]);
    setDone(false);
    setResultItemId(null);
  };

  const addBlankPage = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `blank-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'blank',
        caption: '',
        isEditingCaption: false,
      },
    ]);
    setDone(false);
    setResultItemId(null);
  };

  const clearAll = () => {
    items.forEach((it) => {
      if (it.url) URL.revokeObjectURL(it.url);
    });
    setItems([]);
    setDone(false);
    setResultItemId(null);
  };

  const move = (i: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const remove = (i: number) => {
    const item = items[i];
    if (item.url) URL.revokeObjectURL(item.url);
    setItems((prev) => prev.filter((_, k) => k !== i));
  };

  const toggleEditCaption = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, isEditingCaption: !item.isEditingCaption } : item
      )
    );
  };

  const updateCaption = (index: number, caption: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, caption } : item))
    );
  };

  const convert = async () => {
    if (items.length === 0) return;
    setBusy(true);
    setError(null);
    setDone(false);
    setResultItemId(null);

    try {
      // โหลดฟอนต์ Sarabun เพื่อรองรับภาษาไทยสำหรับคำบรรยายและหัวเรื่อง
      let sarabunFontBytes: ArrayBuffer | null = null;
      try {
        const fontRes = await fetch('/fonts/Sarabun-Regular.ttf');
        if (fontRes.ok) {
          sarabunFontBytes = await fontRes.arrayBuffer();
        }
      } catch (err) {
        console.warn('โหลดฟอนต์ภาษาไทย Sarabun ไม่สำเร็จ ใช้ Standard Font แทน', err);
      }

      const layoutInputs: LayoutItemInput[] = items.map((it) => ({
        id: it.id,
        type: it.type,
        file: it.file,
        url: it.url,
        caption: it.caption,
      }));

      const doc = await buildPdfFromImages({
        layoutMode,
        headerText,
        items: layoutInputs,
        sarabunFontBytes,
      });

      const outBytes = await doc.save();
      const blob = new Blob([outBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const id = addToQueue('images-report.pdf', blob);
      recordToolUsage('image-to-pdf');
      setResultItemId(id);
      setDone(true);
    } catch (e) {
      setError('แปลงไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไฟล์รูปอาจเสียหาย'));
    } finally {
      setBusy(false);
    }
  };

  const handleGridDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setDragOverGrid(true);
    }
  };

  const handleGridDragLeave = () => {
    setDragOverGrid(false);
  };

  const handleGridDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setDragOverGrid(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        addFiles(files);
      }
    }
  };

  const layoutOptions: { id: ImagePdfLayoutMode; label: string; icon: string; desc: string }[] = [
    { id: 'grid_4', icon: '▦', label: '4 รูป / หน้า', desc: 'ยอดนิยมสำหรับรายงานภาพถ่าย (2×2)' },
    { id: 'grid_2', icon: '⊞', label: '2 รูป / หน้า', desc: 'รูปขนาดกลาง 2 รูปบน-ล่าง' },
    { id: 'grid_6', icon: '⠿', label: '6 รูป / หน้า', desc: 'รวมรูปได้เยอะขึ้น ประหยัดหน้า (2×3)' },
    { id: 'single_fit', icon: '📄', label: '1 รูป (Fit A4)', desc: '1 รูปขนาดใหญ่พอดีหน้า A4' },
    { id: 'single_orig', icon: '🖼️', label: 'ขนาดดั้งเดิม', desc: '1 รูปต่อหน้าตามขนาดรูปจริง' },
    { id: 'continuous', icon: '📜', label: 'หน้าเดียวยาว', desc: 'ต่อทุกรูปเป็น 1 แถวยาวแนวตั้ง' },
  ];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader
        icon="🖼️"
        title="รูปภาพ → PDF"
        description="แปลงรูปภาพ JPG / PNG หลายรูปเป็น PDF จัดวางแบบ 1, 2, 4, 6 รูปต่อหน้า, เพิ่มหน้าว่าง และใส่คำบรรยายภาพได้อิสระ"
      />

      <div className="space-y-6">
        {/* Dropzone (เมื่อยังไม่มีไฟล์) */}
        {items.length === 0 ? (
          <FileDropzone
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            multiple
            label="ลากรูปภาพมาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์ (JPG, PNG)"
            onFiles={addFiles}
          />
        ) : null}

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}

        {items.length > 0 && (
          <div className="space-y-4">
            {/* 1. แผงควบคุมรูปแบบการจัดหน้า (Layout Mode Chips) */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <span>📐</span> รูปแบบการจัดหน้า PDF:
                </span>
                <span className="text-[11px] text-gray-500">
                  {layoutOptions.find((opt) => opt.id === layoutMode)?.desc}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {layoutOptions.map((opt) => {
                  const active = layoutMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLayoutMode(opt.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                      title={opt.desc}
                    >
                      <span className="text-sm">{opt.icon}</span>
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. แถบเครื่องมือไอคอนด่วน (Compact Toolbar) */}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">
                  คิวเนื้อหา ({items.length} รายการ)
                </span>
                {headerText && (
                  <span
                    onClick={() => setShowHeaderInput(true)}
                    className="text-[11px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer hover:bg-amber-200 transition truncate max-w-[200px]"
                    title="คลิกเพื่อแก้ไขหัวเรื่อง"
                  >
                    🏷️ หัวเรื่อง: {headerText}
                  </span>
                )}
              </div>

              {/* Action Buttons as Compact Icons */}
              <div className="flex items-center gap-2">
                {/* ปุ่มเพิ่มรูปภาพ */}
                <input
                  ref={appendFileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      addFiles(Array.from(e.target.files));
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => appendFileInputRef.current?.click()}
                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="เลือกรูปภาพจากเครื่องมาเพิ่มในคิว"
                >
                  <span>➕ 🖼️</span>
                  <span>เพิ่มรูป</span>
                </button>

                {/* ปุ่มแทรกหน้าว่าง */}
                <button
                  type="button"
                  onClick={addBlankPage}
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="แทรกหน้ากระดาษเปล่า A4"
                >
                  <span>📄+</span>
                  <span>หน้าว่าง</span>
                </button>

                {/* ปุ่มเปิดกล่องหัวเรื่อง */}
                <button
                  type="button"
                  onClick={() => setShowHeaderInput((prev) => !prev)}
                  className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    showHeaderInput || headerText
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                  title="เปิด/ปิดช่องใส่ชื่อหัวเรื่องเอกสาร"
                >
                  <span>🏷️</span>
                  <span>หัวเรื่อง</span>
                </button>

                {/* ปุ่มล้างทั้งหมด */}
                <button
                  type="button"
                  onClick={clearAll}
                  className="p-1.5 bg-red-50 hover:bg-red-500 hover:text-white text-red-600 border border-red-200 rounded-lg text-xs transition cursor-pointer"
                  title="ล้างรายการทั้งหมด"
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* 3. กล่องกรอกหัวเรื่องเอกสาร (Collapsible Header Input) */}
            {showHeaderInput && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex items-center gap-2.5 shadow-sm animate-fadeIn">
                <span className="text-base shrink-0">🏷️</span>
                <div className="flex-1">
                  <input
                    type="text"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    placeholder="พิมพ์ชื่อหัวเรื่องเอกสาร (จะแสดงที่ด้านบนของทุกหน้ากระดาษ เช่น รายงานการตรวจรับหน้างาน)..."
                    className="w-full text-xs px-3 py-1.5 bg-white border border-amber-300 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none placeholder:text-gray-400"
                    autoFocus
                  />
                </div>
                {headerText && (
                  <button
                    type="button"
                    onClick={() => setHeaderText('')}
                    className="text-xs text-gray-400 hover:text-red-500 px-1 cursor-pointer"
                    title="ล้างข้อความหัวเรื่อง"
                  >
                    ✕
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowHeaderInput(false)}
                  className="text-xs text-amber-800 hover:bg-amber-200/70 px-2.5 py-1 rounded-md font-medium cursor-pointer"
                >
                  เสร็จสิ้น
                </button>
              </div>
            )}

            {/* 4. ตารางคิวรูปภาพ & หน้าว่าง (Interactive Grid with Drag & Drop) */}
            <div
              onDragOver={handleGridDragOver}
              onDragLeave={handleGridDragLeave}
              onDrop={handleGridDrop}
              className={`border rounded-xl p-5 space-y-4 shadow-sm transition relative overflow-hidden ${
                dragOverGrid ? 'border-indigo-400 bg-indigo-50/50 scale-[1.01]' : 'bg-white border-gray-200'
              }`}
            >
              {/* Drag Overlay */}
              {dragOverGrid && (
                <div className="absolute inset-0 bg-indigo-600/10 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none z-30 border-2 border-dashed border-indigo-500 rounded-xl animate-fadeIn">
                  <div className="bg-white px-6 py-4 rounded-xl shadow-lg border border-indigo-100 flex flex-col items-center gap-2">
                    <span className="text-3xl animate-bounce">📥</span>
                    <span className="text-xs font-bold text-indigo-900">วางไฟล์ที่นี่เพื่อรวมรูปภาพเพิ่ม</span>
                    <span className="text-[10px] text-gray-500">รองรับไฟล์รูปภาพ JPG, PNG เท่านั้น</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {items.map((item, i) => (
                  <div
                    key={item.id}
                    className={`border rounded-xl p-2.5 flex flex-col justify-between hover:shadow-md transition relative select-none ${
                      item.type === 'blank' ? 'bg-amber-50/30 border-amber-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* Thumbnail View */}
                    {item.type === 'image' && item.url ? (
                      <div className="flex flex-col items-center">
                        <div className="w-full aspect-[3/4] overflow-hidden flex items-center justify-center bg-white border border-gray-100 rounded-lg relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.url}
                            alt={item.file?.name ?? 'image'}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <p
                          className="font-semibold text-xs text-gray-700 mt-2 truncate w-full text-center"
                          title={item.file?.name}
                        >
                          {i + 1}. {item.file?.name}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-full aspect-[3/4] overflow-hidden flex flex-col items-center justify-center bg-white border border-dashed border-amber-300 rounded-lg p-2 text-center">
                          <span className="text-2xl text-amber-500 mb-1">📄</span>
                          <span className="text-[11px] font-bold text-gray-700">หน้าว่าง A4</span>
                          <span className="text-[9px] text-gray-400">Blank Page</span>
                        </div>
                        <p className="font-semibold text-xs text-gray-700 mt-2 truncate w-full text-center">
                          {i + 1}. หน้ากระดาษเปล่า
                        </p>
                      </div>
                    )}

                    {/* Compact Caption Badge (คลิกเพื่อเปิดแก้) */}
                    {item.caption && !item.isEditingCaption && (
                      <div
                        onClick={() => toggleEditCaption(i)}
                        className="mt-2 bg-blue-50 hover:bg-blue-100/90 border border-blue-200 rounded-md px-2 py-1 flex items-center justify-between gap-1 text-[11px] text-blue-800 cursor-pointer transition"
                        title="คลิกเพื่อแก้ไขคำบรรยายภาพ"
                      >
                        <span className="truncate">💬 {item.caption}</span>
                        <span className="text-[10px] text-blue-500 font-bold shrink-0">✏️</span>
                      </div>
                    )}

                    {/* Inline Caption Input Box (คลี่ออกมาเมื่อกดไอคอน 💬) */}
                    {item.isEditingCaption && (
                      <div className="mt-2 space-y-1 animate-fadeIn">
                        <input
                          type="text"
                          value={item.caption || ''}
                          onChange={(e) => updateCaption(i, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') toggleEditCaption(i);
                          }}
                          placeholder={item.type === 'blank' ? 'บันทึกบนหน้าว่าง...' : 'ใส่คำบรรยายภาพ...'}
                          className="w-full text-[11px] px-2 py-1 bg-white border border-blue-400 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                          autoFocus
                        />
                        <div className="flex justify-between items-center text-[10px]">
                          {item.caption ? (
                            <button
                              type="button"
                              onClick={() => {
                                updateCaption(i, '');
                                toggleEditCaption(i);
                              }}
                              className="text-gray-400 hover:text-red-500 cursor-pointer"
                            >
                              ล้าง
                            </button>
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            onClick={() => toggleEditCaption(i)}
                            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium cursor-pointer"
                          >
                            ตกลง
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Card Actions Toolbar */}
                    <div className="flex items-center justify-between gap-1 mt-2.5 pt-2 border-t border-gray-200/60">
                      {/* Left: Move buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          className="p-1 rounded bg-white border border-gray-200 text-xs hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                          title="ย้ายไปก่อนหน้า"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === items.length - 1}
                          className="p-1 rounded bg-white border border-gray-200 text-xs hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                          title="ย้ายไปถัดไป"
                        >
                          ▶
                        </button>
                      </div>

                      {/* Right: Caption Icon Button + Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleEditCaption(i)}
                          className={`p-1 rounded text-xs transition cursor-pointer flex items-center gap-0.5 ${
                            item.caption
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                          title={item.caption ? 'แก้ไขคำบรรยายภาพ' : 'ใส่คำบรรยายภาพ'}
                        >
                          💬
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(i)}
                          className="p-1 rounded bg-red-50 border border-red-100 text-xs text-red-600 hover:bg-red-500 hover:text-white transition cursor-pointer"
                          title="นำออก"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ผลลัพธ์เมื่อแปลงสำเร็จ */}
        {done && resultItemId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
            <span className="text-4xl block">🎉</span>
            <h3 className="font-bold text-emerald-800 text-sm">สร้างเอกสาร PDF จากรูปภาพสำเร็จแล้ว!</h3>
            <p className="text-xs text-emerald-600">
              ตรวจสอบความถูกต้องผ่านพรีวิวก่อนเปิดดาวน์โหลดลงเครื่องได้ทันที
            </p>

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const item = queue.find((q) => q.id === resultItemId);
                  if (item) setPreviewItem(item);
                }}
                className="px-4 py-2 border border-blue-200 bg-white hover:bg-blue-50 text-blue-600 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                👁️ พรีวิวไฟล์ผลลัพธ์
              </button>
              <button
                type="button"
                onClick={() => downloadItem(resultItemId)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                📥 ดาวน์โหลดไฟล์ทันที
              </button>
            </div>
          </div>
        )}

        <ActionButton onClick={convert} disabled={items.length === 0 || busy} busy={busy}>
          🖼️ เริ่มประมวลผลจัดหน้าและสร้าง PDF
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
