'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { getPdfjs, baseName } from '@/lib/pdf';
import { useDownloadQueue } from '@/context/DownloadQueueContext';

import { reconstructGrid, RawTextItem } from '@/lib/pdf-to-excel';

interface RawPageData {
  pageNumber: number;
  items: RawTextItem[];
}

export default function PdfToExcelPage() {
  const { addToQueue, downloadItem } = useDownloadQueue();
  
  // File and document data states
  const [file, setFile] = useState<File | null>(null);
  const [rawPages, setRawPages] = useState<RawPageData[]>([]);
  const [pagesGrid, setPagesGrid] = useState<string[][][]>([]);
  const [activePreviewPage, setActivePreviewPage] = useState<number>(0);

  // Settings
  const [rowTolerance, setRowTolerance] = useState<number>(5.0);
  const [colTolerance, setColTolerance] = useState<number>(15.0);
  const [wordSpacingThreshold, setWordSpacingThreshold] = useState<number>(8.0);
  const [combineMode, setCombineMode] = useState<'single-sheet' | 'multiple-sheets'>('single-sheet');

  // App UI states
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resultItemId, setResultItemId] = useState<string | null>(null);

  // Pick PDF file
  const pick = async (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('กรุณาเลือกไฟล์ PDF เท่านั้น');
      return;
    }
    setError(null);
    setDone(false);
    setResultItemId(null);
    setFile(f);
    setRawPages([]);
    setPagesGrid([]);

    setBusy(true);
    setProgress('กำลังโหลดโปรแกรมอ่าน PDF และสแกนตำแหน่งข้อความ...');
    try {
      const pdfjs = await getPdfjs();
      const arrayBuffer = await f.arrayBuffer();
      const doc = await pdfjs.getDocument({
        cMapUrl: '/cmaps/',
        cMapPacked: true,
        data: arrayBuffer,
      }).promise;

      const loadedPages: RawPageData[] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        setProgress(`กำลังวิเคราะห์พิกัดข้อความหน้าที่ ${p} จากทั้งหมด ${doc.numPages} หน้า...`);
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        
        const items: RawTextItem[] = [];
        for (const item of content.items) {
          if ('str' in item && 'transform' in item) {
            items.push({
              str: item.str,
              x: item.transform[4],
              y: item.transform[5],
              width: item.width || 0,
              height: item.height || 0,
            });
          }
        }
        loadedPages.push({ pageNumber: p, items });
      }

      setRawPages(loadedPages);
      setActivePreviewPage(0);
    } catch (e) {
      setError('อ่านไฟล์ PDF ล้มเหลว: ' + (e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'));
      setFile(null);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  // Reconstruct Grid when raw data or parameters change
  useEffect(() => {
    if (rawPages.length === 0) return;

    const grids = rawPages.map((page) =>
      reconstructGrid(page.items, rowTolerance, colTolerance, wordSpacingThreshold)
    );
    setPagesGrid(grids);
  }, [rawPages, rowTolerance, colTolerance, wordSpacingThreshold]);



  // Export processed grid into Excel Workbook
  const handleExport = async () => {
    if (!file || pagesGrid.length === 0) return;
    setBusy(true);
    setProgress('กำลังแปลงตารางตารางข้อมูลและจัดทำไฟล์ Excel...');
    
    try {
      const wb = XLSX.utils.book_new();

      if (combineMode === 'single-sheet') {
        // Compile all page grids into one sheet separated by visual boundary indicators
        const combinedRows: string[][] = [];
        for (let p = 0; p < pagesGrid.length; p++) {
          if (p > 0) {
            combinedRows.push([]); // Empty row space
          }
          if (pagesGrid.length > 1) {
            combinedRows.push([`--- หน้าที่ ${p + 1} ---`]);
          }
          combinedRows.push(...pagesGrid[p]);
        }
        const ws = XLSX.utils.aoa_to_sheet(combinedRows);
        XLSX.utils.book_append_sheet(wb, ws, 'ตารางรวม');
      } else {
        // Write each page to a separate worksheet sheet
        for (let p = 0; p < pagesGrid.length; p++) {
          const ws = XLSX.utils.aoa_to_sheet(pagesGrid[p]);
          XLSX.utils.book_append_sheet(wb, ws, `หน้า ${p + 1}`);
        }
      }

      const outName = `${baseName(file.name)}.xlsx`;
      const excelBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const excelBlob = new Blob([excelBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const id = addToQueue(outName, excelBlob);
      setResultItemId(id);
      setDone(true);
    } catch (e) {
      setError('เกิดข้อผิดพลาดระหว่างส่งออกตาราง Excel: ' + (e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const previewGrid = pagesGrid[activePreviewPage] || [];

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader
        icon="📊"
        title="แปลง PDF เป็น Excel (PDF to Excel)"
        description="ถอดข้อมูลและวิเคราะห์พิกัดโครงสร้างตารางของไฟล์ PDF แปลงออกมาเป็นตาราง Excel ในเครื่องทันที ปรับระยะให้พอดีได้"
      />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวางที่นี่ หรือคลิกเพื่ออัปโหลดไฟล์ที่จะดึงตาราง'}
          onFiles={pick}
        />

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}

        {progress && (
          <div className="text-emerald-600 text-sm flex items-center gap-2 font-medium bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 shadow-sm animate-pulse">
            <span className="animate-spin text-lg">⏳</span>
            {progress}
          </div>
        )}

        {file && pagesGrid.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
            
            {/* Control Settings Panel */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-5 h-fit">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  🛠️ ปรับแต่งความละเอียดตาราง
                </span>
                <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  โหมดละเอียด
                </span>
              </div>

              {/* Slider: Row tolerance */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <label className="text-gray-600">📏 ระยะเยื้องแถว (Row Tolerance)</label>
                  <span className="text-blue-600 font-bold">{rowTolerance.toFixed(1)} px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={rowTolerance}
                  onChange={(e) => setRowTolerance(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-gray-400">
                  *ค่ามากจะมองตัวหนังสือเยื้องสูงต่ำกันให้อยู่แถวเดียวกัน ค่าน้อยจะแยกแถวถี่ยิบ
                </p>
              </div>

              {/* Slider: Column tolerance */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <label className="text-gray-600">📐 ระยะห่างคอลัมน์ (Column Tolerance)</label>
                  <span className="text-blue-600 font-bold">{colTolerance.toFixed(1)} px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="40"
                  step="1"
                  value={colTolerance}
                  onChange={(e) => setColTolerance(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-gray-400">
                  *ระยะวิเคราะห์เพื่อแยกออกเป็นคนละช่อง (คอลัมน์) ยิ่งค่ามากช่องข้อมูลจะยิ่งรวมชิดกัน
                </p>
              </div>

              {/* Slider: Word Spacing */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <label className="text-gray-600">🔗 ระยะรวมกลุ่มคำ (Word Merging)</label>
                  <span className="text-blue-600 font-bold">{wordSpacingThreshold.toFixed(1)} px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={wordSpacingThreshold}
                  onChange={(e) => setWordSpacingThreshold(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-[10px] text-gray-400">
                  *ระยะตรวจจับตัวหนังสือเพื่อต่อข้อความเป็นประโยคเดียวกัน หากค่าน้อยตัวอักษรจะกระจัดกระจายคนละช่อง
                </p>
              </div>

              {/* Radio: Combine pages option */}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-600">📂 รูปแบบการบันทึกแผ่นงาน (Export Mode)</label>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-gray-150 hover:bg-gray-50 transition">
                    <input
                      type="radio"
                      name="combineMode"
                      checked={combineMode === 'single-sheet'}
                      onChange={() => setCombineMode('single-sheet')}
                      className="w-4 h-4 text-emerald-600 cursor-pointer accent-emerald-600"
                    />
                    <div>
                      <span className="font-bold text-gray-700 block">รวมไฟล์เป็นแผ่นงานเดียว</span>
                      <span className="text-[10px] text-gray-400">ข้อมูลทุกหน้าวางต่อเรียงกันใน 1 ชีต</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-gray-150 hover:bg-gray-50 transition">
                    <input
                      type="radio"
                      name="combineMode"
                      checked={combineMode === 'multiple-sheets'}
                      onChange={() => setCombineMode('multiple-sheets')}
                      className="w-4 h-4 text-emerald-600 cursor-pointer accent-emerald-600"
                    />
                    <div>
                      <span className="font-bold text-gray-700 block">แยกหน้าละหนึ่งแผ่นงาน</span>
                      <span className="text-[10px] text-gray-400">สร้างชีตแยกกัน (Page 1, Page 2, ...)</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Interactive Grid Table Preview */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  👁️ ตารางพรีวิวก่อนแปลงออก (Interactive Preview)
                </span>
                
                {/* Pagination Controls */}
                {pagesGrid.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActivePreviewPage((prev) => Math.max(0, prev - 1))}
                      disabled={activePreviewPage === 0}
                      className="p-1 px-2.5 rounded-lg border border-gray-200 text-xs font-bold bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      ◀
                    </button>
                    <span className="text-xs font-semibold text-gray-500">
                      หน้า {activePreviewPage + 1} จาก {pagesGrid.length}
                    </span>
                    <button
                      onClick={() => setActivePreviewPage((prev) => Math.min(pagesGrid.length - 1, prev + 1))}
                      disabled={activePreviewPage === pagesGrid.length - 1}
                      className="p-1 px-2.5 rounded-lg border border-gray-200 text-xs font-bold bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      ▶
                    </button>
                  </div>
                )}
              </div>

              {/* Grid Preview Container */}
              {previewGrid.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-400 font-medium">
                  📭 ไม่พบตารางข้อมูลข้อความบนหน้านี้
                </div>
              ) : (
                <div className="overflow-auto max-h-[360px] border border-gray-200 rounded-xl bg-gray-50/50">
                  <table className="w-full text-[10px] text-gray-600 font-sans border-collapse">
                    <thead>
                      <tr className="bg-slate-100 sticky top-0 border-b border-slate-200 shadow-sm">
                        <th className="p-2 border-r border-slate-200 text-center font-bold text-slate-500 w-10 select-none">#</th>
                        {previewGrid[0].map((_, cIdx) => (
                          <th key={cIdx} className="p-2 border-r border-slate-200 text-left font-bold text-slate-600 min-w-[70px]">
                            {String.fromCharCode(65 + cIdx)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewGrid.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-gray-100 hover:bg-slate-50 transition bg-white odd:bg-slate-50/30">
                          <td className="p-2 border-r border-gray-200 text-center bg-slate-50 text-gray-400 font-bold select-none">
                            {rIdx + 1}
                          </td>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-2 border-r border-gray-150 max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">
                              {cell || <span className="text-gray-300 font-light italic">(ว่าง)</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <ActionButton onClick={handleExport} disabled={!file || busy} busy={busy}>
          📊 ดึงตารางข้อมูลและแปลงเป็น Excel ทันที
        </ActionButton>

        {done && resultItemId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
            <span className="text-4xl block">🎉</span>
            <h3 className="font-bold text-emerald-800 text-sm">ถอดข้อมูลตารางและสร้าง Excel สำเร็จแล้ว!</h3>
            <p className="text-xs text-emerald-600">คุณสามารถตรวจสอบคิวไฟล์ดาวน์โหลด หรือคลิกดาวน์โหลดเอกสารลงดิสก์ได้เลย</p>
            
            <div className="flex justify-center gap-3">
              <button
                onClick={() => downloadItem(resultItemId)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                📥 ดาวน์โหลดไฟล์ Excel (.xlsx)
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
