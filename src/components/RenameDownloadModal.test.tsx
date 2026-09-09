// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RenameDownloadModal from './RenameDownloadModal';

describe('RenameDownloadModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('requires a name and confirms with the original extension', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<RenameDownloadModal filename="งาน.pdf" onCancel={() => {}} onConfirm={onConfirm} />);

    const input = screen.getByRole('textbox', { name: 'ชื่อไฟล์' });
    await user.clear(input);
    expect(screen.getByRole('button', { name: 'ดาวน์โหลด' })).toBeDisabled();
    await user.type(input, 'ฉบับใหม่{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('ฉบับใหม่.pdf');
  });

  it('does not close when clicking the backdrop, but closes on cancel button or close button', async () => {
    const onCancel = vi.fn();
    const { container } = render(
      <RenameDownloadModal filename="test.pdf" onCancel={onCancel} onConfirm={() => {}} />
    );

    // Clicking backdrop should NOT call onCancel
    const backdrop = container.firstElementChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onCancel).not.toHaveBeenCalled();

    // Clicking "ยกเลิก" should call onCancel
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Clicking "✕" (aria-label="ปิด") should call onCancel
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('strips redundant extension when pasting a full filename', async () => {
    render(<RenameDownloadModal filename="output.pdf" onCancel={() => {}} onConfirm={() => {}} />);

    const input = screen.getByRole('textbox', { name: 'ชื่อไฟล์' }) as HTMLInputElement;
    fireEvent.paste(input, {
      clipboardData: {
        getData: (type: string) => (type === 'text' ? 'my_document.pdf' : ''),
      },
    });

    expect(input.value).toBe('my_document');
  });
});
