import { describe, expect, it } from 'vitest';
import { pagePdfFilename, sanitizeStem, splitFilename, uniqueFilename } from './download';

describe('download names', () => {
  it('preserves extension separately', () => {
    expect(splitFilename('งาน.final.pdf')).toEqual({ stem: 'งาน.final', extension: '.pdf' });
  });

  it('sanitizes Windows-invalid characters', () => {
    expect(sanitizeStem('  a/b:c*  ')).toBe('a_b_c_');
  });

  it('formats page numbers with three digits', () => {
    expect(pagePdfFilename('งาน.pdf', 2)).toBe('งาน_หน้า_002.pdf');
  });

  it('deduplicates names', () => {
    expect(uniqueFilename('a.pdf', new Set(['a.pdf']))).toBe('a (2).pdf');
  });
});
