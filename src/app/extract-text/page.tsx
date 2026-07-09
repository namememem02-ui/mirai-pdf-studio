'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';

export default function ExtractTextPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pick = (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('กรุณาเลือกไฟล์ PDF'); return; }
    setError(null);
    setText('');
    setFile(f);
  };

  const extract = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const parts: string[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
        parts.push(`--- หน้า ${p} ---\n${pageText}`);
      }
      const result = parts.join('\n\n');
      setText(result);
      if (!result.replace(/---.*---/g, '').trim()) {
        setError('ไม่พบข้อความในไฟล์ — ไฟล์นี้อาจเป็นภาพสแกน (ต้องใช้ OCR ซึ่งยังไม่รองรับ)');
      }
    } catch (e) {
      setError('ดึงข้อความไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไฟล์อาจเสียหายหรือถูกล็อก'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <PageHeader icon="📝" title="ดึงข้อความจาก PDF" description="คัดลอกข้อความทั้งหมด หรือบันทึกเป็นไฟล์ .txt" />

      <div className="space-y-4">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวาง หรือคลิกเลือก'}
          onFiles={pick}
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <ActionButton onClick={extract} disabled={!file} busy={busy}>
          📝 ดึงข้อความ
        </ActionButton>

        {text && (
          <div className="space-y-2">
            <div className="flex gap-2 justify-end">
              <button onClick={copy} className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-gray-700">
                {copied ? '✅ คัดลอกแล้ว' : '📋 คัดลอกทั้งหมด'}
              </button>
              <button
                onClick={() => downloadBlob(text, `${baseName(file!.name)}.txt`, 'text/plain;charset=utf-8')}
                className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-gray-700"
              >
                💾 บันทึก .txt
              </button>
            </div>
            <textarea
              readOnly
              value={text}
              className="w-full h-80 bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-700 focus:outline-none resize-y"
            />
          </div>
        )}
      </div>
    </main>
  );
}
