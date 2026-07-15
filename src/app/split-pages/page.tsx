'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { baseName, getPdfjs } from '@/lib/pdf';
import { splitSelectedPages } from '@/lib/split-pages';
import { useDownloadQueue } from '@/context/DownloadQueueContext';

interface Thumbnail { index: number; url: string }
interface Result { id: string; filename: string; page: number }

export default function SplitPagesPage() {
  const { addToQueue, downloadItem, downloadItems } = useDownloadQueue();
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Thumbnail[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pick = async (files: File[]) => {
    const nextFile = files[0];
    if (!nextFile?.name.toLowerCase().endsWith('.pdf')) { setError('กรุณาเลือกไฟล์ PDF'); return; }
    setFile(nextFile); setPages([]); setResults([]); setError(null); setBusy(true);
    try {
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ cMapUrl: '/cmaps/', cMapPacked: true, data: await nextFile.arrayBuffer() }).promise;
      const thumbnails: Thumbnail[] = [];
      for (let index = 0; index < doc.numPages; index += 1) {
        setProgress(`กำลังสร้างภาพตัวอย่างหน้า ${index + 1} จาก ${doc.numPages}...`);
        const page = await doc.getPage(index + 1);
        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        thumbnails.push({ index, url: canvas.toDataURL() });
      }
      setPages(thumbnails);
      setSelected(thumbnails.map(({ index }) => index));
    } catch {
      setError('เปิดไฟล์ไม่ได้ ไฟล์อาจเสียหายหรือถูกล็อก'); setFile(null);
    } finally { setBusy(false); setProgress(''); }
  };

  const toggle = (index: number) => {
    setResults([]);
    setSelected((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index].sort((a, b) => a - b));
  };

  const createFiles = async () => {
    if (!file || selected.length === 0) return;
    setBusy(true); setError(null); setResults([]);
    try {
      setProgress(`กำลังแยก ${selected.length} หน้าเป็นไฟล์ PDF...`);
      const outputs = await splitSelectedPages(await file.arrayBuffer(), file.name, selected);
      setResults(outputs.map((output, index) => ({ id: addToQueue(output.filename, output.blob), filename: output.filename, page: selected[index] + 1 })));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'แยกหน้า PDF ไม่สำเร็จ');
    } finally { setBusy(false); setProgress(''); }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader icon="📑" title="แยกหน้า PDF" description="แยกทุกหน้าเป็นไฟล์ PDF หน้าเดียว เลือกดาวน์โหลดทีละไฟล์หรือรวมเป็น ZIP" />
      <div className="space-y-6">
        <FileDropzone accept="application/pdf,.pdf" label={file ? `📄 ${file.name} (${pages.length} หน้า) — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวาง หรือคลิกเลือก'} onFiles={pick} />
        {error && <p className="text-sm font-semibold text-red-500">{error}</p>}
        {progress && <p className="rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-600">⏳ {progress}</p>}
        {pages.length > 0 && (
          <section className="space-y-4 rounded-xl border bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-gray-700">เลือกแล้ว {selected.length} จาก {pages.length} หน้า</p>
              <div className="flex gap-2">
                <button onClick={() => { setSelected(pages.map(({ index }) => index)); setResults([]); }} className="rounded-lg border px-3 py-1.5 text-xs font-bold">☑️ เลือกทั้งหมด</button>
                <button onClick={() => { setSelected([]); setResults([]); }} className="rounded-lg border px-3 py-1.5 text-xs font-bold">⬜ ล้างค่าเลือก</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {pages.map((page) => {
                const active = selected.includes(page.index);
                return <button key={page.index} onClick={() => toggle(page.index)} className={`relative rounded-xl border p-3 transition ${active ? 'border-lime-500 bg-lime-50 ring-2 ring-lime-200' : 'opacity-50'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={page.url} alt={`หน้า ${page.index + 1}`} className="aspect-[3/4] w-full object-contain" />
                  <span className="mt-2 block text-xs font-bold">{active ? '✓ ' : ''}หน้า {page.index + 1}</span>
                </button>;
              })}
            </div>
          </section>
        )}
        <ActionButton onClick={createFiles} disabled={!file || selected.length === 0 || busy} busy={busy}>📑 สร้างไฟล์แยก ({selected.length} ไฟล์)</ActionButton>
        {results.length > 0 && (
          <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-emerald-800">สร้างสำเร็จ {results.length} ไฟล์</p>
              <button onClick={() => downloadItems(results.map(({ id }) => id), `${baseName(file!.name)}_แยกหน้า.zip`)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white">📦 ดาวน์โหลดไฟล์ที่เลือกเป็น ZIP</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {results.map((result) => <button key={result.id} onClick={() => downloadItem(result.id)} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-xs font-semibold"><span className="truncate">{result.filename}</span><span>📥 โหลด</span></button>)}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
