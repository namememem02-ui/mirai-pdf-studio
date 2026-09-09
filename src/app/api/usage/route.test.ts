import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

describe('Usage API Route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles GET and returns tools and total', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/_total')) {
        return new Response(JSON.stringify({ value: 10 }));
      }
      return new Response(JSON.stringify({ value: 1 }));
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('tools');
    expect(json).toHaveProperty('total');
    expect(json.tools).toHaveProperty('merge');
    mockFetch.mockRestore();
  });

  it('handles POST and rejects invalid tool id', async () => {
    const req = new NextRequest('http://localhost:4200/api/usage', {
      method: 'POST',
      body: JSON.stringify({ toolId: 'non-existent-tool' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid tool id');
  });

  it('handles POST with valid tool id and increments', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ value: 5 }));
    });

    const req = new NextRequest('http://localhost:4200/api/usage', {
      method: 'POST',
      body: JSON.stringify({ toolId: 'merge' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.toolId).toBe('merge');
    expect(json.toolCount).toBe(5);
    mockFetch.mockRestore();
  });
});
