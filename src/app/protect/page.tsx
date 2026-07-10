'use client';

import React, { useState } from 'react';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import { downloadBlob, baseName } from '@/lib/pdf';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import PDFPreviewModal from '@/components/PDFPreviewModal';

export default function ProtectPage() {
  const { addToQueue, queue, downloadItem } = useDownloadQueue();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Settings
  const [userPassword, setUserPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [algorithm, setAlgorithm] = useState<'AES-256' | 'RC4'>('AES-256');

  // Permission settings
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(true);
  const [allowModifying, setAllowModifying] = useState(true);
  const [allowAnnotating, setAllowAnnotating] = useState(true);

  // Password visibility triggers
  const [showUserPass, setShowUserPass] = useState(false);
  const [showOwnerPass, setShowOwnerPass] = useState(false);

  // Result details
  const [resultItemId, setResultItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  const pick = (files: File[]) => {
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('กรุณาเลือกไฟล์ PDF');
      return;
    }
    setError(null);
    setDone(false);
    setFile(f);
    setResultItemId(null);
  };

  const handleProtect = async () => {
    if (!file) return;
    if (!userPassword.trim() && !ownerPassword.trim()) {
      setError('กรุณาระบุรหัสผ่านเข้าเปิดไฟล์ หรือรหัสผ่านควบคุมสิทธิ์อย่างน้อย 1 ช่องทาง');
      return;
    }

    setBusy(true);
    setError(null);
    setDone(false);
    setProgress('กำลังคำนวณคีย์เข้ารหัสและล็อกสิทธิ์เอกสาร...');

    try {
      const buffer = await file.arrayBuffer();

      const options = {
        ownerPassword: ownerPassword.trim() || undefined,
        algorithm,
        allowPrinting,
        allowCopying,
        allowModifying,
        allowAnnotating,
      };

      // Encrypt PDF bytes using Web Crypto API
      const encryptedBytes = await encryptPDF(
        new Uint8Array(buffer),
        userPassword.trim(),
        options
      );

      const outName = `${baseName(file.name)}_protected.pdf`;
      const blob = new Blob([encryptedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const id = addToQueue(outName, blob);
      setResultItemId(id);
      setDone(true);
    } catch (e) {
      setError('การเข้ารหัสล็อกไฟล์ PDF ล้มเหลว: ' + (e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <PageHeader
        icon="🔒"
        title="ตั้งรหัสผ่าน PDF (Protect PDF)"
        description="ล็อกเอกสาร PDF ด้วยรหัสผ่านเปิดไฟล์ และตั้งค่าจำกัดสิทธิ์การสั่งพิมพ์ แก้ไข หรือคัดลอกตัวอักษร"
      />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={file ? `📄 ${file.name} — คลิกเพื่อเปลี่ยนไฟล์` : 'ลากไฟล์ PDF มาวางที่นี่ หรือคลิกเพื่ออัปโหลดไฟล์ที่จะล็อกรหัสผ่าน'}
          onFiles={pick}
        />

        {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
        
        {progress && (
          <div className="text-blue-600 text-sm flex items-center gap-2 font-medium bg-blue-50 p-3.5 rounded-xl border border-blue-100 shadow-sm animate-pulse">
            <span className="animate-spin text-lg">⏳</span>
            {progress}
          </div>
        )}

        {file && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-5 animate-fadeIn">
            <span className="text-xs font-bold text-gray-700 block border-b border-gray-100 pb-2">
              🛡️ ตั้งค่าการรักษาความปลอดภัย
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* User open password */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-600">
                  🔑 รหัสผ่านเพื่อเปิดอ่านเอกสาร (User Password)
                </label>
                <div className="relative">
                  <input
                    type={showUserPass ? 'text' : 'password'}
                    placeholder="ปล่อยว่างหากต้องการให้เปิดได้ปกติ..."
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-3 pr-10 py-1.5 text-xs focus:outline-none focus:border-pink-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPass(!showUserPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[10px] font-bold"
                  >
                    {showUserPass ? '👁️ ปิด' : '👁️ แสดง'}
                  </button>
                </div>
                <span className="text-[9px] text-gray-400 block">
                  *ผู้รับปลายทางต้องกรอกรหัสผ่านนี้เพื่อที่จะเปิดดูเนื้อหาในเอกสาร
                </span>
              </div>

              {/* Owner password */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-600">
                  ⚙️ รหัสผ่านผู้ดูแลเพื่อควบคุมสิทธิ์ (Owner Password)
                </label>
                <div className="relative">
                  <input
                    type={showOwnerPass ? 'text' : 'password'}
                    placeholder="ระบุรหัสผ่านป้องกันการแก้สิทธิ์..."
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-3 pr-10 py-1.5 text-xs focus:outline-none focus:border-pink-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOwnerPass(!showOwnerPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[10px] font-bold"
                  >
                    {showOwnerPass ? '👁️ ปิด' : '👁️ แสดง'}
                  </button>
                </div>
                <span className="text-[9px] text-gray-400 block">
                  *ใช้สำหรับปลดล็อกหากต้องการสั่งพิมพ์หรือแก้ไขข้อความที่ถูกจำกัดสิทธิ์ไว้ด้านล่าง
                </span>
              </div>
            </div>

            {/* Algorithm select */}
            <div className="space-y-1 pt-3 border-t border-gray-100">
              <label className="block text-xs font-semibold text-gray-600">
                🔒 รูปแบบเทคโนโลยีเข้ารหัส (Encryption Standards)
              </label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as any)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-pink-500 bg-white"
              >
                <option value="AES-256">AES 256-bit (มาตรฐานความปลอดภัยสูงสุด - แนะนำ)</option>
                <option value="RC4">RC4 128-bit (รองรับโปรแกรมเปิด PDF เก่าโบราณ)</option>
              </select>
            </div>

            {/* Permissions settings */}
            <div className="space-y-2.5 pt-4 border-t border-gray-100">
              <span className="block text-xs font-bold text-gray-700">🔒 กำหนดขอบเขตสิทธิ์การใช้งาน (Permissions Allowed)</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={allowPrinting}
                    onChange={(e) => setAllowPrinting(e.target.checked)}
                    className="w-4 h-4 text-pink-600 rounded cursor-pointer"
                  />
                  <span>🖨️ อนุญาตให้สั่งพิมพ์กระดาษ (Allow Printing)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={allowCopying}
                    onChange={(e) => setAllowCopying(e.target.checked)}
                    className="w-4 h-4 text-pink-600 rounded cursor-pointer"
                  />
                  <span>📋 อนุญาตให้ลากคลุมคัดลอกข้อความ (Allow Copying)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={allowModifying}
                    onChange={(e) => setAllowModifying(e.target.checked)}
                    className="w-4 h-4 text-pink-600 rounded cursor-pointer"
                  />
                  <span>📝 อนุญาตให้แก้ไข/หมุน/ดึงหน้ากระดาษ (Allow Modifying)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={allowAnnotating}
                    onChange={(e) => setAllowAnnotating(e.target.checked)}
                    className="w-4 h-4 text-pink-600 rounded cursor-pointer"
                  />
                  <span>✍️ อนุญาตให้เขียนเขียนไฮไลต์คำชี้แนะ (Allow Annotating)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        <ActionButton onClick={handleProtect} disabled={!file || busy} busy={busy}>
          🔐 ตั้งรหัสผ่านและล็อกไฟล์ PDF
        </ActionButton>

        {done && resultItemId && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4 shadow-sm animate-fadeIn">
            <span className="text-4xl block">🎉</span>
            <h3 className="font-bold text-emerald-800 text-sm">ตั้งรหัสผ่านล็อกไฟล์ PDF สำเร็จแล้ว!</h3>
            <p className="text-xs text-emerald-600">ระบบได้ทำการเข้ารหัสตามค่าสิทธิ์ที่คุณกำหนดเรียบร้อยแล้ว</p>
            
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  const item = queue.find((q) => q.id === resultItemId);
                  if (item) setPreviewItem(item);
                }}
                className="px-4 py-2 border border-blue-200 bg-white hover:bg-blue-50 text-blue-600 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                👁️ พรีวิวไฟล์ผลลัพธ์ (อาจต้องพิมพ์รหัสผ่าน)
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
