import { PDFDocument } from 'pdf-lib';
import { pagePdfFilename } from './download';

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
