'use client';

import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, parsePageRanges, pageIndicesToRangeString, baseName } from '@/lib/pdf';

interface PageThumbnail {
  index: number;
  url: string;
}

export default function SplitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<PageThumbnail[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]); // 0-indexed indices of selected pages
  const [ranges, setRanges] = useState('');
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
    setPages([]);
    setSelectedPages([]);
    setRanges('');
    setBusy(true);
    setProgress('กำลังโหลดไฟล์ PDF...');

    try {
      const buffer = await f.arrayBuffer();
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ data: buffer }).promise;
      const count = doc.numPages;
      setPageCount(count);

      // Default: select all pages initially
      const initialIndices = Array.from({ length: count }, (_, i) => i);
      setSelectedPages(initialIndices);
      setRanges(`1-${count}`);

      const thumbnails: PageThumbnail[] = [];
      for (let i = 0; i < count; i++) {
        setProgress(`กำลังสร้างรูปตัวอย่างหน้า ${i + 1} จาก ${count}...`);
        const page = await doc.getPage(i + 1);
        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        thumbnails.push({
          index: i,
          url: canvas.toDataURL(),
        });
      }

      setPages(thumbnails);
    } catch (err) {
      setError('เปิดไฟล์ไม่ได้ ไฟล์อาจเสียหายหรือถูกล็อก');
      setFile(null);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  // When manually typing range input
  const handleRangeChange = (text: string) => {
    setRanges(text);
    setDone(false);
    const indices = parsePageRanges(text, pageCount);
    setSelectedPages(indices);
  };

  // When clicking a page thumbnail
  const togglePageSelection = (index: number) => {
    setDone(false);
    let next: number[];
    if (selectedPages.includes(index)) {
      next = selectedPages.filter((i) => i !== index);
    } else {
      next = [...selectedPages, index].sort((a, b) => a - b);
    }
    setSelectedPages(next);
    setRanges(pageIndicesToRangeString(next));
  };

  const selectAll = () => {
    setDone(false);
    const next = Array.from({ length: pageCount }, (_, i) => i);
    setSelectedPages(next);
    setRanges(pageIndicesToRangeString(next));
  };

  const selectNone = () => {
    setDone(false);
    setSelectedPages([]);
    setRanges('');
  };

  const splitPdf = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (selectedPages.length === 0) {
        setError('กรุณาเลือกอย่างน้อย 1 หน้าเพื่อทำการแยก');
        return;
      }
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const pagesToCopy = await out.copyPages(src, selectedPages);
      pagesToCopy.forEach((p) => out.addPage(p));
      downloadBlob(await out.save(), `${baseName(file.name)}_selected.pdf`);
      setDone(true);
    } catch (e) {
      setError('แยกหน้าไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader icon="✂️" title="แยกหน้า PDF" description="เลือกเฉพาะหน้าที่ต้องการโดยการคลิกที่รูปภาพพรีวิว หรือระบุช่วงหน้าเอง" />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} (${pageCount} หน้า) — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวาง หรือคลิกเลือก'}
          onFiles={pick}
        />

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
        {progress && (
          <div className="text-blue-600 text-sm flex items-center gap-2 font-medium bg-blue-50 p-3 rounded-lg">
            <span className="animate-spin text-lg">⏳</span>
            {progress}
          </div>
        )}

        {file && pages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            {/* Options bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div className="flex-1 max-w-md">
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">
                  ระบุหน้าที่จะดึงออกมา:
                </label>
                <input
                  type="text"
                  value={ranges}
                  onChange={(e) => handleRangeChange(e.target.value)}
                  placeholder="เช่น 1-3,5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  พิมพ์ระบุเป็นตัวเลข ช่วงหน้าคั่นด้วย - และคั่นแต่ละส่วนด้วยเครื่องหมายลูกน้ำ ,
                </p>
              </div>

              <div className="flex gap-2 self-end">
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  ☑️ เลือกทั้งหมด
                </button>
                <button
                  onClick={selectNone}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  ⬜ ล้างค่าเลือก
                </button>
              </div>
            </div>

            {/* Thumbnail Selection Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pages.map((p) => {
                const isSelected = selectedPages.includes(p.index);
                return (
                  <div
                    key={p.index}
                    onClick={() => togglePageSelection(p.index)}
                    className={`border rounded-xl p-3 flex flex-col items-center relative cursor-pointer select-none transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/30 shadow-md ring-2 ring-blue-500/20'
                        : 'border-gray-200 bg-gray-50 opacity-60 hover:opacity-90'
                    }`}
                  >
                    <div className="w-full aspect-[3/4] overflow-hidden flex items-center justify-center bg-white border border-gray-100 rounded-lg relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={`หน้า ${p.index + 1}`} className="max-w-full max-h-full object-contain" />
                      
                      {/* Visual indicator checkbox */}
                      <div
                        className={`absolute top-2 right-2 w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold transition ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white/80 border-gray-300 text-transparent'
                        }`}
                      >
                        ✓
                      </div>
                    </div>
                    <span className={`text-xs mt-2 font-bold ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                      หน้า {p.index + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {done && <p className="text-green-600 text-sm font-semibold">✅ แยกหน้าสำเร็จ — ดาวน์โหลดไฟล์เรียบร้อยแล้ว!</p>}

        <ActionButton onClick={splitPdf} disabled={!file || selectedPages.length === 0 || busy} busy={busy}>
          ✂️ ดาวน์โหลดหน้าที่เลือก ({selectedPages.length} หน้า)
        </ActionButton>
      </div>
    </main>
  );
}
