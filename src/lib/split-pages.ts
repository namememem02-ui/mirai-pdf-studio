import { PDFDocument } from 'pdf-lib';
import { pagePdfFilename } from './download';

export interface SplitGroupItem {
  id?: string;
  name: string;
  pageIndices: number[];
}

export interface SplitGroupOutput {
  id?: string;
  filename: string;
  blob: Blob;
  pageCount: number;
}

export async function splitIntoGroups(
  sourceBytes: ArrayBuffer | Uint8Array,
  groups: SplitGroupItem[],
): Promise<SplitGroupOutput[]> {
  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const outputs: SplitGroupOutput[] = [];

  for (const group of groups) {
    if (group.pageIndices.length === 0) continue;
    try {
      const output = await PDFDocument.create();
      const sortedIndices = [...group.pageIndices].sort((a, b) => a - b);
      const copiedPages = await output.copyPages(source, sortedIndices);
      for (const p of copiedPages) {
        output.addPage(p);
      }
      const bytes = await output.save();
      let filename = group.name.trim();
      if (!filename.toLowerCase().endsWith('.pdf')) {
        filename += '.pdf';
      }
      outputs.push({
        id: group.id,
        filename,
        blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
        pageCount: copiedPages.length,
      });
    } catch {
      throw new Error(`ไม่สามารถสร้างไฟล์สำหรับ "${group.name}" ได้`);
    }
  }

  return outputs;
}

export async function splitSelectedPages(
  sourceBytes: ArrayBuffer | Uint8Array,
  sourceName: string,
  selectedIndices: number[],
) {
  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const outputs: Array<{ filename: string; blob: Blob }> = [];

  for (const index of [...selectedIndices].sort((a, b) => a - b)) {
    try {
      const output = await PDFDocument.create();
      const [page] = await output.copyPages(source, [index]);
      output.addPage(page);
      const bytes = await output.save();
      outputs.push({
        filename: pagePdfFilename(sourceName, index + 1),
        blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
      });
    } catch {
      throw new Error(`ไม่สามารถแยกหน้า ${index + 1} ได้`);
    }
  }

  return outputs;
}
