import { describe, expect, it } from 'vitest';
import { calculateStitchedDimensions } from './image-stitch';

describe('image-stitch helper', () => {
  it('returns zeroes when dimensions list is empty', () => {
    const layout = calculateStitchedDimensions([]);
    expect(layout.targetWidth).toBe(0);
    expect(layout.totalHeight).toBe(0);
    expect(layout.pages).toHaveLength(0);
  });

  it('calculates vertical stacking for uniform pages without scaling', () => {
    const pages = [
      { width: 1000, height: 1400 },
      { width: 1000, height: 1400 },
      { width: 1000, height: 1400 },
    ];

    const layout = calculateStitchedDimensions(pages, 16000);
    expect(layout.targetWidth).toBe(1000);
    expect(layout.totalHeight).toBe(4200);
    expect(layout.scale).toBe(1);
    expect(layout.pages).toHaveLength(3);
    expect(layout.pages[0]).toEqual({ y: 0, width: 1000, height: 1400 });
    expect(layout.pages[1]).toEqual({ y: 1400, width: 1000, height: 1400 });
    expect(layout.pages[2]).toEqual({ y: 2800, width: 1000, height: 1400 });
  });

  it('normalizes varying page widths to the maximum width', () => {
    const pages = [
      { width: 500, height: 500 }, // Aspect ratio 1:1 -> scaled to 1000x1000
      { width: 1000, height: 1500 }, // Max width 1000
    ];

    const layout = calculateStitchedDimensions(pages, 16000);
    expect(layout.targetWidth).toBe(1000);
    expect(layout.totalHeight).toBe(2500);
    expect(layout.pages[0]).toEqual({ y: 0, width: 1000, height: 1000 });
    expect(layout.pages[1]).toEqual({ y: 1000, width: 1000, height: 1500 });
  });

  it('downscales proportionally when total height exceeds canvas height cap', () => {
    const pages = [
      { width: 1000, height: 10000 },
      { width: 1000, height: 10000 }, // Total raw height = 20000
    ];

    // Cap at 10000
    const layout = calculateStitchedDimensions(pages, 10000);
    expect(layout.scale).toBe(0.5);
    expect(layout.targetWidth).toBe(500);
    expect(layout.totalHeight).toBe(10000);
    expect(layout.pages[0]).toEqual({ y: 0, width: 500, height: 5000 });
    expect(layout.pages[1]).toEqual({ y: 5000, width: 500, height: 5000 });
  });
});
