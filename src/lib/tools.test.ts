import { describe, expect, it } from 'vitest';
import { TOOLS } from './tools';

describe('tool registry', () => {
  it('keeps /split but labels it as cut PDF', () => {
    expect(TOOLS.find((tool) => tool.id === 'split')?.name).toBe('ตัดหน้า PDF');
  });

  it('registers a separate split-pages tool', () => {
    expect(TOOLS.find((tool) => tool.id === 'split-pages')?.name).toBe('แยกหน้า PDF');
  });
});
