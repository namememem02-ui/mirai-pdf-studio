import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { splitSelectedPages, splitIntoGroups } from './split-pages';

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

describe('splitIntoGroups', () => {
  it('groups multiple pages into separate PDFs with custom filenames', async () => {
    const source = await PDFDocument.create();
    source.addPage(); // page 1 (index 0)
    source.addPage(); // page 2 (index 1)
    source.addPage(); // page 3 (index 2)
    source.addPage(); // page 4 (index 3)

    const sourceBytes = await source.save();

    const groups = [
      { id: 'g1', name: 'สัญญาจ้าง', pageIndices: [0, 1] }, // pages 1 and 2
      { id: 'g2', name: 'เอกสารแนบ.pdf', pageIndices: [2, 3] }, // pages 3 and 4
    ];

    const outputs = await splitIntoGroups(sourceBytes, groups);

    expect(outputs).toHaveLength(2);
    expect(outputs[0].filename).toBe('สัญญาจ้าง.pdf');
    expect(outputs[0].pageCount).toBe(2);
    expect(outputs[1].filename).toBe('เอกสารแนบ.pdf');
    expect(outputs[1].pageCount).toBe(2);

    const doc1 = await PDFDocument.load(await outputs[0].blob.arrayBuffer());
    expect(doc1.getPageCount()).toBe(2);

    const doc2 = await PDFDocument.load(await outputs[1].blob.arrayBuffer());
    expect(doc2.getPageCount()).toBe(2);
  });

  it('skips empty groups and preserves page ordering', async () => {
    const source = await PDFDocument.create();
    source.addPage();
    source.addPage();
    const sourceBytes = await source.save();

    const groups = [
      { id: 'empty', name: 'ว่าง', pageIndices: [] },
      { id: 'valid', name: 'เดี่ยว.pdf', pageIndices: [1] },
    ];

    const outputs = await splitIntoGroups(sourceBytes, groups);
    expect(outputs).toHaveLength(1);
    expect(outputs[0].filename).toBe('เดี่ยว.pdf');
    expect(outputs[0].pageCount).toBe(1);
  });
});
