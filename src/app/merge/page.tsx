'use client';

import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { downloadBlob } from '@/lib/pdf';

export default function MergePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const addFiles = (incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length < incoming.length) setError('ข้ามไฟล์ที่ไม่ใช่ PDF ให้แล้ว');
    else setError(null);
    setDone(false);
    setFiles((prev) => [...prev, ...pdfs]);
  };

  const move = (i: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const remove = (i: number) => setFiles((prev) => prev.filter((_, k) => k !== i));

  const merge = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await PDFDocument.create();
      for (const file of files) {
        const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      downloadBlob(await out.save(), 'merged.pdf');
      setDone(true);
    } catch (e) {
      setError('รวมไฟล์ไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไฟล์อาจเสียหายหรือถูกล็อก'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader icon="🗂️" title="รวม PDF" description="เลือกหลายไฟล์ จัดลำดับ แล้วรวมเป็นไฟล์เดียว" />

      <div className="space-y-4">
        <FileDropzone
          accept="application/pdf,.pdf"
          multiple
          label="ลากไฟล์ PDF มาวาง หรือคลิกเลือก (เลือกได้หลายไฟล์)"
          hint="ลำดับไฟล์ = ลำดับหน้าในผลลัพธ์"
          onFiles={addFiles}
        />

        {files.length > 0 && (
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <span className="text-gray-400 w-6">{i + 1}.</span>
                <span className="flex-1 truncate text-gray-700">{f.name}</span>
                <span className="text-gray-400 text-xs">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-25">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === files.length - 1} className="px-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-25">↓</button>
                <button onClick={() => remove(i)} className="px-1.5 text-gray-400 hover:text-red-500">✕</button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {done && <p className="text-green-600 text-sm">✅ รวมไฟล์สำเร็จ — ดาวน์โหลดแล้ว (merged.pdf)</p>}

        <ActionButton onClick={merge} disabled={files.length < 2} busy={busy}>
          🗂️ รวม {files.length > 0 ? `${files.length} ไฟล์` : 'PDF'}
        </ActionButton>
        {files.length === 1 && <p className="text-center text-xs text-gray-400">เพิ่มอย่างน้อย 2 ไฟล์เพื่อรวม</p>}
      </div>
    </main>
  );
}
