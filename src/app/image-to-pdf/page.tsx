'use client';

import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { downloadBlob } from '@/lib/pdf';

const OK_TYPES = ['image/jpeg', 'image/png'];

export default function ImageToPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const addFiles = (incoming: File[]) => {
    const imgs = incoming.filter((f) => OK_TYPES.includes(f.type));
    if (imgs.length < incoming.length) setError('รองรับเฉพาะ JPG และ PNG — ข้ามไฟล์อื่นให้แล้ว');
    else setError(null);
    setDone(false);
    setFiles((prev) => [...prev, ...imgs]);
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

  const convert = async () => {
    setBusy(true);
    setError(null);
    try {
      const doc = await PDFDocument.create();
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const img = file.type === 'image/png'
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
        const page = doc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      downloadBlob(await doc.save(), 'images.pdf');
      setDone(true);
    } catch (e) {
      setError('แปลงไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไฟล์รูปอาจเสียหาย'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader icon="🖼️" title="รูปภาพ → PDF" description="แปลงรูป JPG / PNG หลายรูปเป็น PDF ไฟล์เดียว (1 รูป = 1 หน้า)" />

      <div className="space-y-4">
        <FileDropzone
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          multiple
          label="ลากรูปภาพมาวาง หรือคลิกเลือก (เลือกได้หลายรูป)"
          hint="ลำดับรูป = ลำดับหน้าในผลลัพธ์"
          onFiles={addFiles}
        />

        {files.length > 0 && (
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <span className="text-gray-400 w-6">{i + 1}.</span>
                <span className="flex-1 truncate text-gray-700">{f.name}</span>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-25">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === files.length - 1} className="px-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-25">↓</button>
                <button onClick={() => remove(i)} className="px-1.5 text-gray-400 hover:text-red-500">✕</button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {done && <p className="text-green-600 text-sm">✅ แปลงสำเร็จ — ดาวน์โหลดแล้ว (images.pdf)</p>}

        <ActionButton onClick={convert} disabled={files.length === 0} busy={busy}>
          🖼️ แปลง {files.length > 0 ? `${files.length} รูป` : ''} เป็น PDF
        </ActionButton>
      </div>
    </main>
  );
}
