// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RenameDownloadModal from './RenameDownloadModal';

describe('RenameDownloadModal', () => {
  it('requires a name and confirms with the original extension', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<RenameDownloadModal filename="งาน.pdf" onCancel={() => {}} onConfirm={onConfirm} />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    expect(screen.getByRole('button', { name: 'ดาวน์โหลด' })).toBeDisabled();
    await user.type(input, 'ฉบับใหม่{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('ฉบับใหม่.pdf');
  });
});
