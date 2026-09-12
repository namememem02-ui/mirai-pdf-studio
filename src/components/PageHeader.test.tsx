// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
  const originalLocation = window.location;
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reloadMock = vi.fn();
    delete (window as any).location;
    window.location = { ...originalLocation, reload: reloadMock } as any;
  });

  afterEach(() => {
    cleanup();
    window.location = originalLocation as any;
    vi.restoreAllMocks();
  });

  it('renders title, icon, description, back link, and refresh button', () => {
    render(
      <PageHeader
        icon="🖼️"
        title="รูปภาพ → PDF"
        description="แปลงรูปภาพ JPG / PNG หลายรูปเป็น PDF"
      />
    );

    expect(screen.getByText('รูปภาพ → PDF')).toBeInTheDocument();
    expect(screen.getByText('🖼️')).toBeInTheDocument();
    expect(screen.getByText('แปลงรูปภาพ JPG / PNG หลายรูปเป็น PDF')).toBeInTheDocument();
    expect(screen.getByText('← เครื่องมือทั้งหมด')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /รีเฟรช/i })).toBeInTheDocument();
  });

  it('calls onReset callback when refresh button is clicked', () => {
    const onResetMock = vi.fn();
    render(
      <PageHeader
        icon="✂️"
        title="ตัดหน้า PDF"
        description="เลือกหน้าที่ต้องการตัดออก"
        onReset={onResetMock}
      />
    );

    const refreshBtn = screen.getByRole('button', { name: /รีเฟรช/i });
    fireEvent.click(refreshBtn);

    expect(onResetMock).toHaveBeenCalledTimes(1);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('calls window.location.reload when no onReset is provided', () => {
    render(
      <PageHeader
        icon="🗂️"
        title="รวม PDF"
        description="รวม PDF หลายไฟล์"
      />
    );

    const refreshBtn = screen.getByRole('button', { name: /รีเฟรช/i });
    fireEvent.click(refreshBtn);

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
