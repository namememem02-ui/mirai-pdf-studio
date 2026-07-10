'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { baseName } from '@/lib/pdf';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PDFPreviewModal from '@/components/PDFPreviewModal';

export default function ExcelToPdfPage() {
  const { addToQueue, queue, downloadItem } = useDownloadQueue();
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  
  // Settings
  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'a3'>('a4');
  const [orientation, setOrientation] = useState<'p' | 'l'>('p'); // p = portrait, l = landscape
  const [fitToWidth, setFitToWidth] = useState(true);

  // States
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Results
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  const pick = async (files: File[]) => {
    const f = files[0];
    const ext = f.name.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      setError('กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls)');
      return;
    }
    setError(null);
    setDone(false);
    setFile(f);
    setResultItemId(null);
    setPreviewHtml('');

    try {
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data);
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      
      if (wb.SheetNames.length > 0) {
        loadSheetPreview(wb, wb.SheetNames[0]);
      }
    } catch (e) {
      setError('อ่านไฟล์ Excel ล้มเหลว: ' + (e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'));
    }
  };

  const loadSheetPreview = (wb: XLSX.WorkBook, sheetName: string) => {
    setSelectedSheet(sheetName);
    const ws = wb.Sheets[sheetName];
    if (ws) {
      // Generate clean HTML table preview for UI
      const html = XLSX.utils.sheet_to_html(ws, {
        header: '',
        footer: '',
      });
      setPreviewHtml(html);
    }
  };

  const handleSheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sheetName = e.target.value;
    if (workbook) {
      loadSheetPreview(workbook, sheetName);
    }
  };

  // Convert array buffer to base64 string helper
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const convertExcelToPdf = async () => {
    if (!workbook || !selectedSheet) return;
    setBusy(true);
    setError(null);
    setDone(false);
    setProgress('กำลังโหลดโมเดลฟอนต์ไทยและแปลงโครงสร้างตารางข้อมูล...');

    try {
      const ws = workbook.Sheets[selectedSheet];
      if (!ws) throw new Error('ไม่พบข้อมูลชีตที่เลือก');

      // Convert SheetJS worksheet to 2D array of cells (header: 1)
      const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      if (rawData.length === 0) {
        throw new Error('ไม่พบข้อมูลตารางในชีตนี้');
      }

      // Filter out entirely empty rows to clean up PDF output
      const cleanData = rawData.filter(row => row && row.some(cell => cell !== undefined && cell !== ''));

      if (cleanData.length === 0) {
        throw new Error('ไม่พบแถวข้อมูลที่มีตัวหนังสือหรือตัวเลขเลย');
      }

      // Load local Sarabun-Regular font for full Thai Unicode support in jsPDF
      const fontResponse = await fetch('/fonts/Sarabun-Regular.ttf');
      if (!fontResponse.ok) throw new Error('ไม่สามารถโหลดฟอนต์ไทย Sarabun-Regular ได้');
      const fontBytes = await fontResponse.arrayBuffer();
      const sarabunBase64 = arrayBufferToBase64(fontBytes);

      // Initialize jsPDF document with selected layout page size
      const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: pageSize,
      });

      // Register and set Sarabun font as the default font
      doc.addFileToVFS('Sarabun-Regular.ttf', sarabunBase64);
      doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
      doc.setFont('Sarabun');

      // The first row will be headers, remaining rows are body
      const headers = cleanData[0].map(h => h !== undefined ? String(h) : '');
      const body = cleanData.slice(1).map(row => 
        row.map(cell => cell !== undefined ? String(cell) : '')
      );

      // Generate PDF Vector Table
      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 15,
        margin: { top: 15, right: 10, bottom: 15, left: 10 },
        styles: {
          font: 'Sarabun',          // Support Thai cell fonts
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          font: 'Sarabun',          // Support Thai header fonts
          fillColor: [15, 23, 42],  // Slate-900 corporate theme
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'normal',
        },
        // Auto-scale column widths if fitToWidth is checked
        columnStyles: fitToWidth ? undefined : {
          // If not fitToWidth, let autotable do auto widths based on cell content size
        },
        didParseCell: (data) => {
          // Additional custom styles can go here
        }
      });

      const outName = `${baseName(file!.name)}_${selectedSheet}.pdf`;
      const pdfBlob = doc.output('blob');
      const id = addToQueue(outName, pdfBlob);
      setResultItemId(id);
      setDone(true);
    } catch (e) {
      setError('การแปลงตารางล้มเหลว: ' + (e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader
        icon="📊"
        title="แปลง Excel เป็น PDF (Excel to PDF)"
        description="แปลงตารางข้อมูลจากไฟล์ Excel (.xlsx, .xls) ออกมาเป็นไฟล์ตารางใน PDF พร้อมรองรับฟอนต์อักษรภาษาไทย 100%"
      />

      <div className="space-y-6">
        <FileDropzone
          accept=".xlsx,.xls"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ Excel (.xlsx, .xls) มาวางที่นี่ หรือคลิกเพื่ออัปโหลดไฟล์ตาราง'}
          onFiles={pick}
        />

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}

        {progress && (
          <div className="text-emerald-600 text-sm flex items-center gap-2 font-medium bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 shadow-sm animate-pulse">
            <span className="animate-spin text-lg">⏳</span>
            {progress}
          </div>
        )}

        {file && workbook && sheetNames.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-5 animate-fadeIn">
            <span className="text-xs font-bold text-gray-700 block border-b border-gray-100 pb-2">
              🛠️ เลือกการตั้งค่าและการจัดหน้าตาราง
            </span>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              {/* Select Sheet Tab */}
              <div className="space-y-1">
                <label className="block font-semibold text-gray-600">📊 เลือกแผ่นงาน (Select Sheet)</label>
                <select
                  value={selectedSheet}
                  onChange={handleSheetChange}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-600 bg-white"
                >
                  {sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Page Size */}
              <div className="space-y-1">
                <label className="block font-semibold text-gray-600">📄 ขนาดหน้ากระดาษ (Page Size)</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-600 bg-white"
                >
                  <option value="a4">A4 (มาตรฐานไทย)</option>
                  <option value="letter">Letter (มาตรฐานอเมริกา)</option>
                  <option value="a3">A3 (แผ่นงานขนาดใหญ่พิเศษ)</option>
                </select>
              </div>

              {/* Page Orientation */}
              <div className="space-y-1">
                <label className="block font-semibold text-gray-600">📐 ทิศทางหน้ากระดาษ (Orientation)</label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-600 bg-white"
                >
                  <option value="p">แนวตั้ง (Portrait)</option>
                  <option value="l">แนวนอน (Landscape - แนะนำสำหรับตารางหลายคอลัมน์)</option>
                </select>
              </div>

              {/* Table Fit check */}
              <div className="space-y-1 flex flex-col justify-end pb-1.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fitToWidth}
                    onChange={(e) => setFitToWidth(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
                  <span className="font-semibold text-gray-600">📏 ย่อคอลัมน์ให้พอดีความกว้างหน้ากระดาษ</span>
                </label>
              </div>
            </div>

            {/* Excel HTML Preview Table */}
            {previewHtml && (
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">👁️ ตัวอย่างเนื้อหาตาราง (Active sheet Preview)</span>
                
                <div 
                  className="max-h-60 overflow-auto border border-gray-200 rounded-xl bg-gray-50/50 p-3 text-[10px] text-gray-600"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                  style={{
                    maxWidth: '100%',
                  }}
                />
                
                <style jsx global>{`
                  /* Style the excel preview table for premium spreadsheet look */
                  .max-h-60 table {
                    border-collapse: collapse;
                    width: 100%;
                    background: white;
                  }
                  .max-h-60 th, .max-h-60 td {
                    border: 1px solid #e2e8f0;
                    padding: 6px 8px;
                    text-align: left;
                    white-space: nowrap;
                  }
                  .max-h-60 tr:nth-child(even) {
                    background-color: #f8fafc;
                  }
                `}</style>
              </div>
            )}
          </div>
        )}

        <ActionButton onClick={convertExcelToPdf} disabled={!file || busy} busy={busy}>
          📊 แปลง Excel เป็น PDF ทันที
        </ActionButton>

        {done && resultItemId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
            <span className="text-4xl block">🎉</span>
            <h3 className="font-bold text-emerald-800 text-sm font-bold">แปลงไฟล์ตารางสำเร็จแล้ว!</h3>
            <p className="text-xs text-emerald-600">ตารางข้อมูลจากแผ่นงานของคุณถูกแปลงเป็นโครงสร้างแบบเวกเตอร์ PDF เรียบร้อยแล้ว</p>
            
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  const item = queue.find((q) => q.id === resultItemId);
                  if (item) setPreviewItem(item);
                }}
                className="px-4 py-2 border border-blue-200 bg-white hover:bg-blue-50 text-blue-600 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                👁️ พรีวิวไฟล์ PDF
              </button>
              <button
                onClick={() => downloadItem(resultItemId)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                📥 ดาวน์โหลดไฟล์ทันที
              </button>
            </div>
          </div>
        )}
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
