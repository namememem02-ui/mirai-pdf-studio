import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { splitSelectedPages } from './split-pages';

describe('splitSelectedPages', () => {
  it('creates one-page PDFs for selected source pages', async () => {
    const source = await PDFDocument.create();
    source.addPage(); source.addPage(); source.addPage();
    const outputs = await splitSelectedPages(await source.save(), 'งาน.pdf', [0, 2]);

    expect(outputs.map((item) => item.filename)).toEqual(['งาน_หน้า_001.pdf', 'งาน_หน้า_003.pdf']);
    for (const output of outputs) {
      expect((await PDFDocument.load(await output.blob.arrayBuffer())).getPageCount()).toBe(1);
    }
  });
});
