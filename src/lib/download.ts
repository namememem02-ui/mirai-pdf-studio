import JSZip from 'jszip';

export interface DownloadFile {
  filename: string;
  blob: Blob;
}

export function splitFilename(filename: string) {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return { stem: filename, extension: '' };
  return { stem: filename.slice(0, dot), extension: filename.slice(dot) };
}

export function sanitizeStem(stem: string) {
  return stem.trim().replace(/[\\/:*?"<>|]/g, '_');
}

export function pagePdfFilename(sourceName: string, pageNumber: number) {
  const { stem } = splitFilename(sourceName);
  return `${sanitizeStem(stem)}_หน้า_${String(pageNumber).padStart(3, '0')}.pdf`;
}

export function uniqueFilename(filename: string, used: Set<string>) {
  if (!used.has(filename)) return filename;
  const { stem, extension } = splitFilename(filename);
  let number = 2;
  while (used.has(`${stem} (${number})${extension}`)) number += 1;
  return `${stem} (${number})${extension}`;
}

export async function createZipBlob(items: DownloadFile[]) {
  if (items.length === 0) throw new Error('ไม่มีไฟล์สำหรับสร้าง ZIP');
  const zip = new JSZip();
  const used = new Set<string>();
  for (const item of items) {
    const filename = uniqueFilename(item.filename, used);
    used.add(filename);
    zip.file(filename, item.blob);
  }
  return zip.generateAsync({ type: 'blob' });
}
