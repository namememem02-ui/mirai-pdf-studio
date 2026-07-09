'use client';

import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { downloadBlob, parsePageRanges, baseName } from '@/lib/pdf';

export default function SplitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [ranges, setRanges] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const pick = async (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('กรุณาเลือกไฟล์ PDF'); return; }
    setError(null);
    setDone(false);
    setFile(f);
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      setPageCount(doc.getPageCount());
      setRanges(`1-${doc.getPageCount()}`);
    } catch {
      setError('เปิดไฟล์ไม่ได้ ไฟล์อาจเสียหายหรือถูกล็อก');
      setFile(null);
    }
  };

  const split = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const indices = parsePageRanges(ranges, pageCount);
      if (indices.length === 0) {
        setError(`รูปแบบหน้าไม่ถูกต้อง — ใช้แบบ 1-3,5 (มีทั้งหมด ${pageCount} หน้า)`);
        return;
      }
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, indices);
      pages.forEach((p) => out.addPage(p));
      downloadBlob(await out.save(), `${baseName(file.name)}_selected.pdf`);
      setDone(true);
    } catch (e) {
      setError('แยกหน้าไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader icon="✂️" title="แยกหน้า PDF" description="เลือกเฉพาะหน้าที่ต้องการออกมาเป็นไฟล์ใหม่" />

      <div className="space-y-4">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} (${pageCount} หน้า) — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวาง หรือคลิกเลือก'}
          onFiles={pick}
        />

        {file && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              หน้าที่ต้องการ (ทั้งหมด {pageCount} หน้า)
            </label>
            <input
              type="text"
              value={ranges}
              onChange={(e) => { setRanges(e.target.value); setDone(false); }}
              placeholder="เช่น 1-3,5,8-10"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            />
            <p className="text-xs text-gray-400 mt-1">ใช้เครื่องหมาย - สำหรับช่วง และ , คั่นแต่ละส่วน</p>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {done && <p className="text-green-600 text-sm">✅ แยกหน้าสำเร็จ — ดาวน์โหลดแล้ว</p>}

        <ActionButton onClick={split} disabled={!file} busy={busy}>
          ✂️ แยกหน้าที่เลือก
        </ActionButton>
      </div>
    </main>
  );
}
