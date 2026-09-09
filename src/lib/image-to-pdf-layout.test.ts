import { describe, expect, it } from 'vitest';
import {
  getGridConfig,
  calculateCellBounds,
  fitImageInBox,
  groupItemsIntoPages,
  A4_WIDTH,
  A4_HEIGHT,
} from './image-to-pdf-layout';

describe('image-to-pdf-layout', () => {
  describe('getGridConfig', () => {
    it('returns 1x2 for grid_2', () => {
      expect(getGridConfig('grid_2')).toEqual({ cols: 1, rows: 2, itemsPerPage: 2 });
    });

    it('returns 2x2 for grid_4', () => {
      expect(getGridConfig('grid_4')).toEqual({ cols: 2, rows: 2, itemsPerPage: 4 });
    });

    it('returns 2x3 for grid_6', () => {
      expect(getGridConfig('grid_6')).toEqual({ cols: 2, rows: 3, itemsPerPage: 6 });
    });

    it('returns 1x1 for single_fit, single_orig, and continuous', () => {
      expect(getGridConfig('single_fit')).toEqual({ cols: 1, rows: 1, itemsPerPage: 1 });
      expect(getGridConfig('single_orig')).toEqual({ cols: 1, rows: 1, itemsPerPage: 1 });
      expect(getGridConfig('continuous')).toEqual({ cols: 1, rows: 1, itemsPerPage: 1 });
    });
  });

  describe('calculateCellBounds', () => {
    it('calculates correct dimensions for 2x2 grid with margins', () => {
      const margin = 36;
      const gap = 16;
      const slot0 = calculateCellBounds({
        slotIndex: 0,
        cols: 2,
        rows: 2,
        margin,
        gapX: gap,
        gapY: gap,
      });

      const availableW = A4_WIDTH - 2 * margin; // 523.275
      const availableH = A4_HEIGHT - 2 * margin; // 769.89
      const expectedW = (availableW - gap) / 2;
      const expectedH = (availableH - gap) / 2;

      expect(slot0.x).toBeCloseTo(margin, 2);
      expect(slot0.width).toBeCloseTo(expectedW, 2);
      expect(slot0.height).toBeCloseTo(expectedH, 2);
      expect(slot0.y).toBeCloseTo(A4_HEIGHT - margin - expectedH, 2);

      // Slot 1 (top right)
      const slot1 = calculateCellBounds({
        slotIndex: 1,
        cols: 2,
        rows: 2,
        margin,
        gapX: gap,
        gapY: gap,
      });
      expect(slot1.x).toBeCloseTo(margin + expectedW + gap, 2);
      expect(slot1.y).toBeCloseTo(slot0.y, 2);

      // Slot 2 (bottom left)
      const slot2 = calculateCellBounds({
        slotIndex: 2,
        cols: 2,
        rows: 2,
        margin,
        gapX: gap,
        gapY: gap,
      });
      expect(slot2.x).toBeCloseTo(margin, 2);
      expect(slot2.y).toBeCloseTo(margin, 2);
    });
  });

  describe('fitImageInBox', () => {
    it('scales wide landscape image to fit width', () => {
      const res = fitImageInBox(200, 100, 400, 100);
      expect(res.drawWidth).toBe(200);
      expect(res.drawHeight).toBe(50);
      expect(res.offsetX).toBe(0);
      expect(res.offsetY).toBe(25);
    });

    it('scales tall portrait image to fit height', () => {
      const res = fitImageInBox(200, 100, 100, 200);
      expect(res.drawWidth).toBe(50);
      expect(res.drawHeight).toBe(100);
      expect(res.offsetX).toBe(75);
      expect(res.offsetY).toBe(0);
    });

    it('handles zero or negative sizes safely', () => {
      expect(fitImageInBox(0, 100, 100, 100).drawWidth).toBe(0);
      expect(fitImageInBox(100, 0, 100, 100).drawHeight).toBe(0);
    });
  });

  describe('groupItemsIntoPages', () => {
    it('chunks image items according to itemsPerPage', () => {
      const items = [
        { type: 'image' as const, id: '1' },
        { type: 'image' as const, id: '2' },
        { type: 'image' as const, id: '3' },
        { type: 'image' as const, id: '4' },
        { type: 'image' as const, id: '5' },
      ];

      const pages = groupItemsIntoPages(items, 4);
      expect(pages).toHaveLength(2);
      expect(pages[0].map((it) => it.id)).toEqual(['1', '2', '3', '4']);
      expect(pages[1].map((it) => it.id)).toEqual(['5']);
    });

    it('isolates blank pages into their own single-item page', () => {
      const items = [
        { type: 'image' as const, id: '1' },
        { type: 'image' as const, id: '2' },
        { type: 'blank' as const, id: 'b1' },
        { type: 'image' as const, id: '3' },
        { type: 'image' as const, id: '4' },
      ];

      const pages = groupItemsIntoPages(items, 4);
      expect(pages).toHaveLength(3);
      expect(pages[0].map((it) => it.id)).toEqual(['1', '2']);
      expect(pages[1].map((it) => it.id)).toEqual(['b1']);
      expect(pages[2].map((it) => it.id)).toEqual(['3', '4']);
    });
  });
});
