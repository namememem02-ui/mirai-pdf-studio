import { describe, expect, it } from 'vitest';
import { reconstructGrid, RawTextItem } from './pdf-to-excel';

describe('reconstructGrid', () => {
  it('returns an empty array when items are empty', () => {
    const result = reconstructGrid([], 5, 15, 8);
    expect(result).toEqual([]);
  });

  it('groups items into rows using rowTolerance (Y coordinate similarity)', () => {
    const items: RawTextItem[] = [
      { str: 'Row1-Col1', x: 10, y: 100, width: 50, height: 10 },
      { str: 'Row1-Col2', x: 70, y: 101, width: 50, height: 10 }, // slightly different Y but within 5px
      { str: 'Row2-Col1', x: 10, y: 80, width: 50, height: 10 },  // separate Y
    ];

    // Using rowTolerance = 5
    const result = reconstructGrid(items, 5, 15, 8);
    
    // Expecting 2 rows: first row has 2 columns, second row has 1 column
    expect(result.length).toBe(2);
    // Let's verify cell contents (empty cells filled with '')
    // Column centroids will be at ~10 and ~70
    expect(result[0]).toEqual(['Row1-Col1', 'Row1-Col2']);
    expect(result[1]).toEqual(['Row2-Col1', '']);
  });

  it('merges words that are close horizontally (within wordSpacingThreshold)', () => {
    const items: RawTextItem[] = [
      { str: 'Hello', x: 10, y: 100, width: 30, height: 10 },
      { str: 'World', x: 44, y: 100, width: 30, height: 10 }, // gap is 44 - (10 + 30) = 4px < 8px -> merges
      { str: 'NextCol', x: 100, y: 100, width: 40, height: 10 }, // gap is 100 - (44 + 30) = 26px >= 8px -> separate
    ];

    const result = reconstructGrid(items, 5, 15, 8);

    // Grid should cluster into two main columns (Column 1: ~10, Column 2: ~100)
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(['Hello World', 'NextCol']);
  });

  it('correctly maps items to the closest column centroid in aligned tables', () => {
    // A 2x3 table where Col 2 is slightly misaligned but should resolve to the same column
    const items: RawTextItem[] = [
      // Row 1
      { str: 'A1', x: 10, y: 100, width: 10, height: 10 },
      { str: 'B1', x: 50, y: 100, width: 10, height: 10 },
      { str: 'C1', x: 90, y: 100, width: 10, height: 10 },
      // Row 2 (slightly shifted X values)
      { str: 'A2', x: 11, y: 80, width: 10, height: 10 },
      { str: 'B2', x: 49, y: 80, width: 10, height: 10 },
      { str: 'C2', x: 92, y: 80, width: 10, height: 10 },
    ];

    const result = reconstructGrid(items, 5, 15, 8);

    expect(result.length).toBe(2);
    expect(result[0]).toEqual(['A1', 'B1', 'C1']);
    expect(result[1]).toEqual(['A2', 'B2', 'C2']);
  });
});
