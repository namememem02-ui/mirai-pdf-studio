'use client';

import React, { useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { downloadBlob, parsePageRanges, baseName } from '@/lib/pdf';

export default function RotatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [angle, setAngle] = useState<90 | 180 | 270>(90);
  const [scope, setScope] = useState<'all' | 'ranges'>('all');
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
    } catch {
      setError('เปิดไฟล์ไม่ได้ ไฟล์อาจเสียหายหรือถูกล็อก');
      setFile(null);
    }
  };

  const rotate = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const targets = scope === 'all'
        ? doc.getPageIndices()
        : parsePageRanges(ranges, pageCount);
      if (targets.length === 0) {
        setError(`รูปแบบหน้าไม่ถูกต้อง — ใช้แบบ 1-3,5 (มีทั้งหมด ${pageCount} หน้า)`);
        return;
      }
      for (const i of targets) {
        const page = doc.getPage(i);
        page.setRotation(degrees((page.getRotation().angle + angle) % 360));
      }
      downloadBlob(await doc.save(), `${baseName(file.name)}_rotated.pdf`);
      setDone(true);
    } catch (e) {
      setError('หมุนหน้าไม่สำเร็จ: ' + (e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader icon="🔄" title="หมุนหน้า PDF" description="หมุนทุกหน้าหรือเฉพาะหน้าที่เลือก" />

      <div className="space-y-4">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} (${pageCount} หน้า) — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวาง หรือคลิกเลือก'}
          onFiles={pick}
        />

        {file && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">มุมหมุน (ตามเข็มนาฬิกา)</label>
              <div className="flex gap-2">
                {([90, 180, 270] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => { setAngle(a); setDone(false); }}
                    className={`flex-1 py-2 rounded-lg border font-semibold transition ${
                      angle === a ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {a}°
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">หน้าที่จะหมุน</label>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setScope('all')}
                  className={`flex-1 py-2 rounded-lg border font-semibold transition ${scope === 'all' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-600'}`}
                >
                  ทุกหน้า
                </button>
                <button
                  onClick={() => setScope('ranges')}
                  className={`flex-1 py-2 rounded-lg border font-semibold transition ${scope === 'ranges' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-600'}`}
                >
                  เลือกหน้า
                </button>
              </div>
              {scope === 'ranges' && (
                <input
                  type="text"
                  value={ranges}
                  onChange={(e) => { setRanges(e.target.value); setDone(false); }}
                  placeholder={`เช่น 1-3,5 (มี ${pageCount} หน้า)`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                />
              )}
            </div>
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {done && <p className="text-green-600 text-sm">✅ หมุนสำเร็จ — ดาวน์โหลดแล้ว</p>}

        <ActionButton onClick={rotate} disabled={!file} busy={busy}>
          🔄 หมุน {angle}°
        </ActionButton>
      </div>
    </main>
  );
}
