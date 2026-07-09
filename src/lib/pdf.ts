'use client';

// Shared helpers for all tools — everything runs in the browser only.

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export function downloadBlob(
  data: Blob | Uint8Array | ArrayBuffer | string,
  filename: string,
  type = 'application/pdf'
) {
  const part: BlobPart =
    data instanceof Uint8Array
      ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
      : data;
  const blob = data instanceof Blob ? data : new Blob([part], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// "1-3,5,7-8" -> [0,1,2,4,6,7] (0-indexed, ตัดเลขเกินช่วงทิ้ง)
export function parsePageRanges(input: string, pageCount: number): number[] {
  const result = new Set<number>();
  for (const part of input.split(',')) {
    const seg = part.trim();
    if (!seg) continue;
    const m = seg.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const from = parseInt(m[1], 10);
      const to = parseInt(m[2], 10);
      for (let p = Math.min(from, to); p <= Math.max(from, to); p++) {
        if (p >= 1 && p <= pageCount) result.add(p - 1);
      }
    } else if (/^\d+$/.test(seg)) {
      const p = parseInt(seg, 10);
      if (p >= 1 && p <= pageCount) result.add(p - 1);
    }
  }
  return [...result].sort((a, b) => a - b);
}

export function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}
