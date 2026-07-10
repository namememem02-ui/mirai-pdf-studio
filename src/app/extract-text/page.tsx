'use client';

import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, downloadBlob, baseName } from '@/lib/pdf';

export default function ExtractTextPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [useOcr, setUseOcr] = useState(false);
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pick = (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('กรุณาเลือกไฟล์ PDF');
      return;
    }
    setError(null);
    setText('');
    setFile(f);
  };

  const extract = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setText('');
    setProgress('กำลังโหลดโปรแกรมอ่าน PDF...');

    let worker: any = null;

    try {
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({
        cMapUrl: '/cmaps/',
        cMapPacked: true,
        data: await file.arrayBuffer(),
      }).promise;

      const parts: string[] = [];

      if (useOcr) {
        setProgress('กำลังโหลดโมเดลภาษาไทยและภาษาอังกฤษจากฐานข้อมูลภายในเครื่อง (Local OCR)...');
        worker = await createWorker('tha+eng', 1, {
          workerPath: '/tesseract/worker.min.js',
          langPath: '/tesseract',
          corePath: '/tesseract' // directory: let tesseract.js pick the faster SIMD core when supported
        });
      }

      for (let p = 1; p <= doc.numPages; p++) {
        let pageText = '';

        if (useOcr) {
          setProgress(`กำลังใช้ดินสอแสงสแกนถอดอักษรหน้าที่ ${p} จากทั้งหมด ${doc.numPages} หน้า...`);
          
          const page = await doc.getPage(p);
          const viewport = page.getViewport({ scale: 1.5 }); // High-scale render for OCR accuracy
          
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport }).promise;

          // OCR processing
          const { data: { text: ocrResult } } = await worker.recognize(canvas);
          pageText = ocrResult.trim();
        } else {
          setProgress(`กำลังอ่านสกัดข้อความหน้าส่วนตัวที่ ${p} จากทั้งหมด ${doc.numPages} หน้า...`);
          
          const page = await doc.getPage(p);
          const content = await page.getTextContent();
          pageText = content.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        }

        parts.push(`--- หน้า ${p} ---\n${pageText || '(ไม่พบข้อความ)'}`);
      }

      const result = parts.join('\n\n');
      setText(result);

      // Validation
      const rawContent = result
        .replace(/---.*---/g, '')
        .replace(/\(ไม่พบข้อความ\)/g, '')
        .trim();

      if (!rawContent) {
        if (useOcr) {
          setError('ไม่พบข้อความหรือตัวอักษรใด ๆ จากการถอดรหัสรูปภาพสแกนนี้');
        } else {
          setError('ไม่พบข้อความตัวหนังสือดิจิทัล — ไฟล์นี้อาจเป็นภาพถ่าย/ไฟล์สแกน กรุณากดเลือกใช้โหมด OCR ถอดอักษรจากภาพด้านล่าง');
        }
      }
    } catch (e) {
      setError('การดึงข้อความเอกสารไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      if (worker) {
        await worker.terminate();
      }
      setBusy(false);
      setProgress('');
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <PageHeader
        icon="📝"
        title="ดึงข้อความจาก PDF (OCR)"
        description="คัดลอกถอดข้อความภาษาไทยและภาษาอังกฤษจากเอกสาร PDF หรือภาพสแกน/รูปถ่าย ด้วยเทคโนโลยี OCR ประมวลผลบนเครื่อง"
      />

      <div className="space-y-5">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวางที่นี่ หรือคลิกเพื่ออัปโหลดไฟล์ที่จะดึงข้อความ'}
          onFiles={pick}
        />

        {/* OCR Switch Toggle */}
        {file && (
          <div className="flex items-center gap-3 bg-yellow-50/50 border border-yellow-100 rounded-xl p-3.5 shadow-sm">
            <input
              type="checkbox"
              id="useOcr"
              checked={useOcr}
              onChange={(e) => setUseOcr(e.target.checked)}
              className="w-4 h-4 rounded text-yellow-600 focus:ring-yellow-500 cursor-pointer accent-yellow-650"
            />
            <label htmlFor="useOcr" className="text-xs font-semibold text-yellow-800 cursor-pointer leading-relaxed flex-1 select-none">
              💡 เปิดใช้โหมดสแกนข้อความจากรูปภาพ / เอกสารสแกน (OCR ภาษาไทยและภาษาอังกฤษ)
              <span className="block text-[10px] text-yellow-600 font-normal mt-0.5">
                *เลือกช่องนี้หากไฟล์ PDF ของคุณเป็นงานสแกนเอกสารหรือรูปภาพ (จะใช้ระยะเวลาในการอ่านวิเคราะห์ข้อความช้ากว่าปกติเล็กน้อย)
              </span>
            </label>
          </div>
        )}

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
        
        {progress && (
          <div className="text-blue-600 text-sm flex items-center gap-2 font-medium bg-blue-50 p-3.5 rounded-xl border border-blue-100 shadow-sm animate-pulse">
            <span className="animate-spin text-lg">⏳</span>
            {progress}
          </div>
        )}

        <ActionButton onClick={extract} disabled={!file || busy} busy={busy}>
          📝 เริ่มดึงข้อความเอกสาร
        </ActionButton>

        {text && (
          <div className="space-y-2.5 animate-fadeIn">
            <div className="flex gap-2 justify-end">
              <button
                onClick={copy}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold transition cursor-pointer shadow-sm"
              >
                {copied ? '✅ คัดลอกเรียบร้อย' : '📋 คัดลอกทั้งหมด'}
              </button>
              <button
                onClick={() => downloadBlob(text, `${baseName(file!.name)}.txt`, 'text/plain;charset=utf-8')}
                className="px-4 py-2 rounded-lg bg-gray-850 hover:bg-gray-700 text-white text-xs font-bold transition cursor-pointer shadow-sm"
              >
                💾 บันทึกเป็นไฟล์ .txt
              </button>
            </div>
            <textarea
              readOnly
              value={text}
              className="w-full h-80 bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-700 focus:outline-none focus:border-pink-500 resize-y shadow-sm font-sans"
            />
          </div>
        )}
      </div>
    </main>
  );
}
