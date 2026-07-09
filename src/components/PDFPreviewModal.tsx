'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getPdfjs } from '@/lib/pdf';
import { DownloadItem } from '@/context/DownloadQueueContext';

interface PDFPreviewModalProps {
  item: DownloadItem;
  onClose: () => void;
  onDownload: () => void;
}

function PreviewPage({
  pageNumber,
  pdfDoc,
  scale,
}: {
  pageNumber: number;
  pdfDoc: any;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const renderPage = async () => {
      setLoading(true);
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        if (!active) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        setLoading(false);
      } catch (err) {
        console.error('Error rendering preview page:', err);
      }
    };
    renderPage();

    return () => {
      active = false;
    };
  }, [pdfDoc, pageNumber, scale]);

  return (
    <div className="bg-white p-2 border border-gray-200 shadow rounded flex flex-col items-center">
      <span className="text-[10px] text-gray-400 font-semibold mb-1">หน้า {pageNumber}</span>
      <div className="relative border border-gray-150 bg-gray-50 flex items-center justify-center">
        <canvas ref={canvasRef} />
        {loading && (
          <div className="absolute inset-0 bg-gray-50/50 flex items-center justify-center text-xs text-gray-500">
            ⏳ กำลังโหลด...
          </div>
        )}
      </div>
    </div>
  );
}

export default function PDFPreviewModal({ item, onClose, onDownload }: PDFPreviewModalProps) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(0.85); // Default zoom level for preview
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const pdfjs = await getPdfjs();
        const buffer = await item.blob.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buffer }).promise;
        if (!active) return;
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setLoading(false);
      } catch (err) {
        console.error('Error loading PDF for preview:', err);
        if (active) {
          setError('ไม่สามารถเปิดไฟล์ PDF พรีวิวได้ ไฟล์อาจเสียหายหรือถูกล็อกเข้ารหัสลับ');
          setLoading(false);
        }
      }
    };
    loadPdf();

    return () => {
      active = false;
    };
  }, [item]);

  const handleZoom = (direction: 'in' | 'out') => {
    setScale((prev) => {
      if (direction === 'in') return Math.min(1.5, prev + 0.15);
      return Math.max(0.4, prev - 0.15);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📄</span>
            <div className="min-w-0">
              <p className="font-bold text-sm text-gray-800 truncate" title={item.filename}>
                {item.filename}
              </p>
              <p className="text-xs text-gray-400">
                {(item.size / 1024 / 1024).toFixed(2)} MB · ทั้งหมด {pageCount} หน้า
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Zoom Controls */}
            {!loading && !error && (
              <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden divide-x divide-gray-150">
                <button
                  onClick={() => handleZoom('out')}
                  className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 active:bg-gray-100 cursor-pointer font-bold"
                  title="ซูมออก"
                >
                  ➖
                </button>
                <span className="px-2 text-[10px] text-gray-500 font-semibold select-none w-14 text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => handleZoom('in')}
                  className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 active:bg-gray-100 cursor-pointer font-bold"
                  title="ซูมเข้า"
                >
                  ➕
                </button>
              </div>
            )}

            <button
              onClick={onDownload}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer border-none"
            >
              📥 ดาวน์โหลด
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer border-none bg-transparent"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col items-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-sm gap-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>กำลังดึงภาพตัวอย่างหน้าเอกสาร PDF...</span>
            </div>
          ) : error ? (
            <div className="text-center py-20 text-red-500 text-sm font-semibold">{error}</div>
          ) : (
            <div className="space-y-6 w-full flex flex-col items-center">
              {Array.from({ length: pageCount }, (_, i) => (
                <PreviewPage key={i} pageNumber={i + 1} pdfDoc={pdfDoc} scale={scale} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
