// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  formatUsageCount,
  getCachedUsage,
  setCachedUsage,
  USAGE_CACHE_KEY,
} from './usage';

describe('usage stats helper', () => {
  describe('formatUsageCount', () => {
    it('formats 0 or negative or invalid numbers to "0"', () => {
      expect(formatUsageCount(0)).toBe('0');
      expect(formatUsageCount(-5)).toBe('0');
      expect(formatUsageCount(undefined)).toBe('0');
      expect(formatUsageCount(null)).toBe('0');
      expect(formatUsageCount(Number.NaN)).toBe('0');
    });

    it('formats normal counts under 10,000 with th-TH formatting', () => {
      expect(formatUsageCount(42)).toBe('42');
      expect(formatUsageCount(999)).toBe('999');
      expect(formatUsageCount(1250)).toBe('1,250');
      expect(formatUsageCount(9999)).toBe('9,999');
    });

    it('formats counts 10,000 and above with k suffix', () => {
      expect(formatUsageCount(10000)).toBe('10k');
      expect(formatUsageCount(15400)).toBe('15.4k');
      expect(formatUsageCount(99900)).toBe('99.9k');
    });

    it('formats counts 1,000,000 and above with M suffix', () => {
      expect(formatUsageCount(1000000)).toBe('1M');
      expect(formatUsageCount(2500000)).toBe('2.5M');
    });
  });

  describe('cache and optimistic record', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('reads empty default when cache is empty', () => {
      const cached = getCachedUsage();
      expect(cached.tools).toEqual({});
      expect(cached.total).toBe(0);
    });

    it('persists and reads cached usage data', () => {
      setCachedUsage({
        tools: { merge: 10, split: 5 },
        total: 15,
        updatedAt: 123456,
      });

      const cached = getCachedUsage();
      expect(cached.tools.merge).toBe(10);
      expect(cached.tools.split).toBe(5);
      expect(cached.total).toBe(15);
    });
  });
});
