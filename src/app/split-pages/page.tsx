'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import FileDropzone from '@/components/FileDropzone';
import ActionButton from '@/components/ActionButton';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { baseName, getPdfjs, parsePageRanges, pageIndicesToRangeString } from '@/lib/pdf';
import { splitSelectedPages, splitIntoGroups } from '@/lib/split-pages';
import { useDownloadQueue, DownloadItem } from '@/context/DownloadQueueContext';
import { recordToolUsage } from '@/lib/usage';

interface Thumbnail {
  index: number;
  url: string;
}

interface PageGroup {
  id: string;
  name: string;
  rangeInput: string;
  pageIndices: number[];
  colorIndex: number;
}

interface ResultItem {
  id: string;
  filename: string;
  pageCount: number;
  pagesDescription: string;
}

const GROUP_COLORS = [
  {
    name: 'ฟ้า',
    border: 'border-blue-500',
    bg: 'bg-blue-50',
    activeBg: 'bg-blue-100/70',
    badgeBg: 'bg-blue-600',
    badgeText: 'text-white',
    ring: 'ring-blue-400',
    accentText: 'text-blue-700',
    borderLight: 'border-blue-200',
    tagBg: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    name: 'เขียว',
    border: 'border-emerald-500',
    bg: 'bg-emerald-50',
    activeBg: 'bg-emerald-100/70',
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    ring: 'ring-emerald-400',
    accentText: 'text-emerald-700',
    borderLight: 'border-emerald-200',
    tagBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    name: 'ส้ม',
    border: 'border-amber-500',
    bg: 'bg-amber-50',
    activeBg: 'bg-amber-100/70',
    badgeBg: 'bg-amber-600',
    badgeText: 'text-white',
    ring: 'ring-amber-400',
    accentText: 'text-amber-700',
    borderLight: 'border-amber-200',
    tagBg: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    name: 'ม่วง',
    border: 'border-purple-500',
    bg: 'bg-purple-50',
    activeBg: 'bg-purple-100/70',
    badgeBg: 'bg-purple-600',
    badgeText: 'text-white',
    ring: 'ring-purple-400',
    accentText: 'text-purple-700',
    borderLight: 'border-purple-200',
    tagBg: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    name: 'ชมพู',
    border: 'border-pink-500',
    bg: 'bg-pink-50',
    activeBg: 'bg-pink-100/70',
    badgeBg: 'bg-pink-600',
    badgeText: 'text-white',
    ring: 'ring-pink-400',
    accentText: 'text-pink-700',
    borderLight: 'border-pink-200',
    tagBg: 'bg-pink-100 text-pink-800 border-pink-200',
  },
  {
    name: 'คราม',
    border: 'border-indigo-500',
    bg: 'bg-indigo-50',
    activeBg: 'bg-indigo-100/70',
    badgeBg: 'bg-indigo-600',
    badgeText: 'text-white',
    ring: 'ring-indigo-400',
    accentText: 'text-indigo-700',
    borderLight: 'border-indigo-200',
    tagBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
];

export default function SplitPagesPage() {
  const { addToQueue, downloadItem, downloadItems, queue } = useDownloadQueue();

  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Thumbnail[]>([]);

  // Split mode: 'custom-groups' vs 'extract-all'
  const [splitMode, setSplitMode] = useState<'custom-groups' | 'extract-all'>('custom-groups');

  // Mode 1: Custom Groups
  const [groups, setGroups] = useState<PageGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Mode 2: Extract All single pages
  const [selectedIndividual, setSelectedIndividual] = useState<number[]>([]);

  // Results and UI State
  const [results, setResults] = useState<ResultItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [singleSavingId, setSingleSavingId] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DownloadItem | null>(null);

  const pick = async (files: File[]) => {
    const nextFile = files[0];
    if (!nextFile?.name.toLowerCase().endsWith('.pdf')) {
      setError('กรุณาเลือกไฟล์ PDF');
      return;
    }

    setFile(nextFile);
    setPages([]);
    setResults([]);
    setError(null);
    setBusy(true);

    try {
      const pdfjs = await getPdfjs();
      const buffer = await nextFile.arrayBuffer();
      const doc = await pdfjs.getDocument({
        cMapUrl: '/cmaps/',
        cMapPacked: true,
        data: buffer,
      }).promise;

      const thumbnails: Thumbnail[] = [];
      for (let index = 0; index < doc.numPages; index += 1) {
        setProgress(`กำลังสร้างภาพตัวอย่างหน้า ${index + 1} จาก ${doc.numPages}...`);
        const page = await doc.getPage(index + 1);
        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        thumbnails.push({ index, url: canvas.toDataURL() });
      }

      setPages(thumbnails);
      setSelectedIndividual(thumbnails.map(({ index }) => index));

      // Initial Group Setup:
      // If 4 or more pages, suggest 2 default groups (1-2, 3-4)
      // Otherwise, 1 default group
      const stem = baseName(nextFile.name);
      const count = thumbnails.length;
      let initialGroups: PageGroup[] = [];

      if (count >= 4) {
        initialGroups = [
          {
            id: `g-${Date.now()}-1`,
            name: `${stem}_หน้า_1-2.pdf`,
            rangeInput: '1-2',
            pageIndices: [0, 1],
            colorIndex: 0,
          },
          {
            id: `g-${Date.now()}-2`,
            name: `${stem}_หน้า_3-4.pdf`,
            rangeInput: '3-4',
            pageIndices: [2, 3],
            colorIndex: 1,
          },
        ];
      } else if (count > 1) {
        initialGroups = [
          {
            id: `g-${Date.now()}-1`,
            name: `${stem}_หน้า_1.pdf`,
            rangeInput: '1',
            pageIndices: [0],
            colorIndex: 0,
          },
          {
            id: `g-${Date.now()}-2`,
            name: `${stem}_หน้า_2-${count}.pdf`,
            rangeInput: `2-${count}`,
            pageIndices: Array.from({ length: count - 1 }, (_, i) => i + 1),
            colorIndex: 1,
          },
        ];
      } else {
        initialGroups = [
          {
            id: `g-${Date.now()}-1`,
            name: `${stem}_หน้า_1.pdf`,
            rangeInput: '1',
            pageIndices: [0],
            colorIndex: 0,
          },
        ];
      }

      setGroups(initialGroups);
      setActiveGroupId(initialGroups[0].id);
    } catch {
      setError('เปิดไฟล์ไม่ได้ ไฟล์อาจเสียหายหรือถูกล็อก');
      setFile(null);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  // Group Management Functions
  const handleAddGroup = () => {
    if (!file) return;
    const stem = baseName(file.name);
    const colorIndex = groups.length % GROUP_COLORS.length;

    // Find first unassigned page if available
    const assigned = new Set(groups.flatMap((g) => g.pageIndices));
    let nextUnassigned = -1;
    for (let i = 0; i < pages.length; i++) {
      if (!assigned.has(i)) {
        nextUnassigned = i;
        break;
      }
    }

    const defaultIndex = nextUnassigned >= 0 ? nextUnassigned : 0;
    const defaultRange = `${defaultIndex + 1}`;
    const newGroup: PageGroup = {
      id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${stem}_กลุ่ม_${groups.length + 1}.pdf`,
      rangeInput: defaultRange,
      pageIndices: [defaultIndex],
      colorIndex,
    };

    setGroups((prev) => [...prev, newGroup]);
    setActiveGroupId(newGroup.id);
    setResults([]);
  };

  const handleRemoveGroup = (groupId: string) => {
    setGroups((prev) => {
      const filtered = prev.filter((g) => g.id !== groupId);
      if (activeGroupId === groupId && filtered.length > 0) {
        setActiveGroupId(filtered[0].id);
      }
      return filtered;
    });
    setResults([]);
  };

  const handleUpdateGroupName = (groupId: string, name: string) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name } : g)));
  };

  const handleUpdateGroupRange = (groupId: string, rangeText: string) => {
    const indices = parsePageRanges(rangeText, pages.length);
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              rangeInput: rangeText,
              pageIndices: indices,
            }
          : g
      )
    );
    setResults([]);
  };

  // Toggle page in the active group when clicking thumbnail
  const handleThumbnailClick = (pageIndex: number) => {
    if (splitMode === 'extract-all') {
      setResults([]);
      setSelectedIndividual((current) =>
        current.includes(pageIndex)
          ? current.filter((item) => item !== pageIndex)
          : [...current, pageIndex].sort((a, b) => a - b)
      );
      return;
    }

    // In custom-groups mode:
    if (!activeGroupId) return;

    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== activeGroupId) {
          // If page was in another group, remove it to reassign cleanly to the active group
          if (g.pageIndices.includes(pageIndex)) {
            const nextIndices = g.pageIndices.filter((idx) => idx !== pageIndex);
            return {
              ...g,
              pageIndices: nextIndices,
              rangeInput: pageIndicesToRangeString(nextIndices),
            };
          }
          return g;
        }

        // Toggle in active group
        const exists = g.pageIndices.includes(pageIndex);
        const nextIndices = exists
          ? g.pageIndices.filter((idx) => idx !== pageIndex)
          : [...g.pageIndices, pageIndex].sort((a, b) => a - b);

        return {
          ...g,
          pageIndices: nextIndices,
          rangeInput: pageIndicesToRangeString(nextIndices),
        };
      })
    );
    setResults([]);
  };

  // Save / Download Single Group directly
  const handleDownloadSingleGroup = async (group: PageGroup) => {
    if (!file || group.pageIndices.length === 0) return;
    setSingleSavingId(group.id);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      let filename = group.name.trim();
      if (!filename.toLowerCase().endsWith('.pdf')) {
        filename += '.pdf';
      }

      const outputs = await splitIntoGroups(buffer, [
        {
          id: group.id,
          name: filename,
          pageIndices: group.pageIndices,
        },
      ]);

      if (outputs.length > 0) {
        const id = addToQueue(outputs[0].filename, outputs[0].blob);
        downloadItem(id);
        recordToolUsage('split-pages');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'สร้างไฟล์ไม่สำเร็จ');
    } finally {
      setSingleSavingId(null);
    }
  };

  // Batch Export All Groups or All Selected Pages
  const handleBatchCreateFiles = async () => {
    if (!file) return;

    if (splitMode === 'custom-groups') {
      const validGroups = groups.filter((g) => g.pageIndices.length > 0);
      if (validGroups.length === 0) {
        setError('กรุณาระบุหน้าในกลุ่มอย่างน้อย 1 กลุ่มก่อนสร้างไฟล์');
        return;
      }

      setBusy(true);
      setError(null);
      setResults([]);

      try {
        setProgress(`กำลังสร้างไฟล์ PDF ตามกลุ่มที่เลือก ${validGroups.length} รายการ...`);
        const buffer = await file.arrayBuffer();
        const outputs = await splitIntoGroups(
          buffer,
          validGroups.map((g) => ({
            id: g.id,
            name: g.name.trim() || `${baseName(file.name)}_กลุ่ม.pdf`,
            pageIndices: g.pageIndices,
          }))
        );

        const newResults: ResultItem[] = outputs.map((out, idx) => {
          const group = validGroups[idx];
          const desc = group ? `หน้า ${group.pageIndices.map((i) => i + 1).join(', ')}` : '';
          const qId = addToQueue(out.filename, out.blob);
          return {
            id: qId,
            filename: out.filename,
            pageCount: out.pageCount,
            pagesDescription: desc,
          };
        });

        setResults(newResults);
        recordToolUsage('split-pages');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'แยกหน้า PDF ไม่สำเร็จ');
      } finally {
        setBusy(false);
        setProgress('');
      }
    } else {
      // Extract all single pages
      if (selectedIndividual.length === 0) {
        setError('กรุณาเลือกหน้าที่ต้องการแยกอย่างน้อย 1 หน้า');
        return;
      }

      setBusy(true);
      setError(null);
      setResults([]);

      try {
        setProgress(`กำลังแยก ${selectedIndividual.length} หน้าเป็นไฟล์ PDF...`);
        const outputs = await splitSelectedPages(
          await file.arrayBuffer(),
          file.name,
          selectedIndividual
        );

        const newResults: ResultItem[] = outputs.map((out, idx) => {
          const pageNum = selectedIndividual[idx] + 1;
          const qId = addToQueue(out.filename, out.blob);
          return {
            id: qId,
            filename: out.filename,
            pageCount: 1,
            pagesDescription: `หน้า ${pageNum}`,
          };
        });

        setResults(newResults);
        recordToolUsage('split-pages');
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'แยกหน้า PDF ไม่สำเร็จ');
      } finally {
        setBusy(false);
        setProgress('');
      }
    }
  };

  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const activeColor = activeGroup ? GROUP_COLORS[activeGroup.colorIndex] : GROUP_COLORS[0];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        icon="📑"
        title="แยกหน้า PDF"
        description="จัดกลุ่มหน้าที่ต้องการรวมไว้ด้วยกัน (เช่น หน้า 1-2 ไว้ด้วยกัน, หน้า 3-4 ไว้ด้วยกัน) ตั้งชื่อไฟล์แต่ละกลุ่มได้อย่างอิสระ หรือแยกทุกหน้าเป็นไฟล์เดี่ยว"
      />

      <div className="space-y-6">
        <FileDropzone
          accept="application/pdf,.pdf"
          label={
            file
              ? `📄 ${file.name} (${pages.length} หน้า) — คลิกเพื่อเปลี่ยนไฟล์`
              : 'ลากไฟล์ PDF มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'
          }
          onFiles={pick}
        />

        {error && <p className="text-sm font-semibold text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
        {progress && (
          <p className="rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-600 flex items-center gap-2">
            <span className="animate-spin">⏳</span> {progress}
          </p>
        )}

        {pages.length > 0 && (
          <div className="space-y-6">
            {/* Mode Switcher Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setSplitMode('custom-groups');
                  setResults([]);
                }}
                className={`py-3 px-5 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  splitMode === 'custom-groups'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>📑</span> จัดกลุ่มแยกหน้าและตั้งชื่อเอง ({groups.length} กลุ่ม)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSplitMode('extract-all');
                  setResults([]);
                }}
                className={`py-3 px-5 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  splitMode === 'extract-all'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>📄</span> แยกทุกหน้าเดี่ยวๆ (1 หน้า = 1 ไฟล์)
              </button>
            </div>

            {/* Custom Groups Mode Interface */}
            {splitMode === 'custom-groups' && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                      <span>🏷️</span> รายการกลุ่มแยกหน้า ({groups.length} รายการ)
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      คลิกการ์ดกลุ่มเพื่อเลือกจัดหน้า พิมพ์ช่วงหน้า หรือคลิกที่ภาพหน้ากระดาษด้านล่างเพื่อเลือกหน้าเข้ากลุ่ม
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddGroup}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>➕</span> เพิ่มกลุ่มแยกหน้าใหม่
                  </button>
                </div>

                {/* Group Cards List */}
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                  {groups.map((group, idx) => {
                    const c = GROUP_COLORS[group.colorIndex];
                    const isActive = group.id === activeGroupId;
                    const isSaving = singleSavingId === group.id;

                    return (
                      <div
                        key={group.id}
                        onClick={() => setActiveGroupId(group.id)}
                        className={`rounded-xl border p-4 transition-all cursor-pointer relative shadow-xs ${
                          isActive
                            ? `${c.border} ${c.activeBg} ring-2 ${c.ring} shadow-md`
                            : `border-gray-200 bg-white hover:border-gray-300`
                        }`}
                      >
                        {/* Group Header */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.badgeBg} ${c.badgeText}`}
                            >
                              กลุ่มที่ {idx + 1}
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md animate-pulse">
                                👉 กำลังเลือกหน้าเข้ากลุ่มนี้
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {groups.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveGroup(group.id);
                                }}
                                className="text-gray-400 hover:text-red-500 font-bold p-1 text-xs transition cursor-pointer"
                                title="ลบกลุ่มนี้"
                              >
                                ✕ ลบ
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Group Inputs: Filename & Ranges */}
                        <div className="space-y-2.5">
                          <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1">
                              ✏️ ชื่อไฟล์ผลลัพธ์:
                            </label>
                            <input
                              type="text"
                              value={group.name}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleUpdateGroupName(group.id, e.target.value)}
                              placeholder="เช่น สัญญาจ้าง.pdf"
                              className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 shadow-xs"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="text-[11px] font-bold text-gray-600 block mb-1">
                                📄 ช่วงหน้าที่เลือก (พิมพ์หรือคลิกรูป):
                              </label>
                              <input
                                type="text"
                                value={group.rangeInput}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleUpdateGroupRange(group.id, e.target.value)}
                                placeholder="เช่น 1-2 หรือ 3,4"
                                className="w-full text-xs font-mono font-bold px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 shadow-xs"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadSingleGroup(group);
                              }}
                              disabled={group.pageIndices.length === 0 || busy || isSaving}
                              className="mt-5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 hover:text-blue-600 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                              title="บันทึกและดาวน์โหลดเฉพาะกลุ่มนี้ทันที"
                            >
                              {isSaving ? <span>⏳ กำลังบันทึก...</span> : <span>📥 บันทึกไฟล์นี้</span>}
                            </button>
                          </div>
                        </div>

                        {/* Page Preview Tags */}
                        <div className="mt-3 pt-2.5 border-t border-gray-200/70 flex items-center justify-between text-[11px] text-gray-500">
                          <span>
                            รวม <strong>{group.pageIndices.length}</strong> หน้า{' '}
                            {group.pageIndices.length > 0 &&
                              `(${group.pageIndices.map((i) => i + 1).join(', ')})`}
                          </span>
                          {group.pageIndices.length === 0 && (
                            <span className="text-amber-600 font-medium">ยังไม่มีหน้าที่เลือก</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Thumbnail Selection Grid */}
            <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <p className="text-sm font-bold text-gray-700">
                    {splitMode === 'custom-groups' ? (
                      <span>
                        📑 คลิกที่รูปเพื่อเพิ่ม/ลดหน้าเข้า{' '}
                        <strong className={activeColor.accentText}>
                          &quot;กลุ่มที่ {groups.findIndex((g) => g.id === activeGroupId) + 1}&quot;
                        </strong>
                      </span>
                    ) : (
                      <span>เลือกแล้ว {selectedIndividual.length} จาก {pages.length} หน้า</span>
                    )}
                  </p>
                </div>

                {splitMode === 'extract-all' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIndividual(pages.map(({ index }) => index));
                        setResults([]);
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold hover:bg-gray-50 cursor-pointer"
                    >
                      ☑️ เลือกทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIndividual([]);
                        setResults([]);
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold hover:bg-gray-50 cursor-pointer"
                    >
                      ⬜ ล้างค่าเลือก
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {pages.map((page) => {
                  if (splitMode === 'custom-groups') {
                    // Find which group contains this page
                    const parentGroup = groups.find((g) => g.pageIndices.includes(page.index));
                    const isCurrentActiveGroup = activeGroup?.pageIndices.includes(page.index);
                    const color = parentGroup ? GROUP_COLORS[parentGroup.colorIndex] : null;

                    return (
                      <button
                        key={page.index}
                        type="button"
                        onClick={() => handleThumbnailClick(page.index)}
                        className={`relative rounded-xl border-2 p-2.5 transition text-left cursor-pointer flex flex-col items-center group ${
                          isCurrentActiveGroup
                            ? `${activeColor.border} ${activeColor.bg} ring-2 ${activeColor.ring} shadow-md`
                            : parentGroup
                            ? `${color?.border} ${color?.bg} opacity-90`
                            : 'border-gray-200 hover:border-gray-400 bg-gray-50/50 opacity-60 hover:opacity-100'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={page.url}
                          alt={`หน้า ${page.index + 1}`}
                          className="aspect-[3/4] w-full object-contain bg-white rounded border border-gray-100 shadow-2xs"
                        />

                        {/* Page number badge */}
                        <div className="w-full mt-2 flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-700">
                            หน้า {page.index + 1}
                          </span>

                          {parentGroup ? (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${color?.badgeBg} ${color?.badgeText}`}
                            >
                              กลุ่ม {groups.findIndex((g) => g.id === parentGroup.id) + 1}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-medium">ว่าง</span>
                          )}
                        </div>
                      </button>
                    );
                  }

                  // Extract all mode
                  const active = selectedIndividual.includes(page.index);
                  return (
                    <button
                      key={page.index}
                      type="button"
                      onClick={() => handleThumbnailClick(page.index)}
                      className={`relative rounded-xl border p-3 transition text-left cursor-pointer ${
                        active
                          ? 'border-lime-500 bg-lime-50 ring-2 ring-lime-200 shadow-xs'
                          : 'border-gray-200 opacity-40 hover:opacity-80'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={page.url}
                        alt={`หน้า ${page.index + 1}`}
                        className="aspect-[3/4] w-full object-contain bg-white rounded border border-gray-100"
                      />
                      <span className="mt-2 block text-xs font-bold">
                        {active ? '✓ ' : ''}หน้า {page.index + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Main Action Button */}
            <ActionButton
              onClick={handleBatchCreateFiles}
              disabled={
                !file ||
                busy ||
                (splitMode === 'custom-groups'
                  ? groups.filter((g) => g.pageIndices.length > 0).length === 0
                  : selectedIndividual.length === 0)
              }
              busy={busy}
            >
              {splitMode === 'custom-groups'
                ? `📑 แยกและสร้างไฟล์ทั้งหมด (${groups.filter((g) => g.pageIndices.length > 0).length} ไฟล์)`
                : `📑 สร้างไฟล์แยก (${selectedIndividual.length} ไฟล์)`}
            </ActionButton>

            {/* Results Section */}
            {results.length > 0 && (
              <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm animate-fadeIn">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                      <span>🎉</span> แยกไฟล์สำเร็จเรียบร้อย ({results.length} ไฟล์)
                    </h3>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      สามารถเปิดพรีวิวดูเนื้อหา ดาวน์โหลดแยกทีละไฟล์ หรือดาวน์โหลดทั้งหมดเป็น ZIP ได้ทันที
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      downloadItems(
                        results.map(({ id }) => id),
                        `${baseName(file!.name)}_แยกหน้า.zip`
                      )
                    }
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>📦</span> ดาวน์โหลดทั้งหมดเป็น ZIP
                  </button>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-1 md:grid-cols-2">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white p-3 shadow-2xs hover:shadow-xs transition"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate text-xs font-bold text-gray-800" title={result.filename}>
                          📄 {result.filename}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {result.pagesDescription} ({result.pageCount} หน้า)
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const found = queue.find((q) => q.id === result.id);
                            if (found) setPreviewItem(found);
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-md transition cursor-pointer"
                          title="พรีวิวไฟล์"
                        >
                          👁️ ดู
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadItem(result.id)}
                          className="px-2.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition shadow-2xs cursor-pointer flex items-center gap-1"
                        >
                          <span>📥</span> โหลด
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      {previewItem && (
        <PDFPreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onDownload={() => {
            downloadItem(previewItem.id);
            setPreviewItem(null);
          }}
        />
      )}
    </main>
  );
}
