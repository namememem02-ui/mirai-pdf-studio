// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MeeARaiBrand from './MeeARaiBrand';
import HeaderNav from './HeaderNav';
import { DownloadQueueProvider } from '@/context/DownloadQueueContext';

describe('MeeARaiBrand', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderBrand = () => render(<MeeARaiBrand appName="PDF Studio" accentColor="#22d3ee" />);

  it('starts compact and expands only when the M trigger receives mouse or pen hover', () => {
    renderBrand();
    const brand = screen.getByTestId('mee-arai-brand');
    const trigger = screen.getByRole('button', { name: /mee-a-rai brand/i });

    expect(brand).toHaveAttribute('data-expanded', 'false');
    expect(brand).toHaveTextContent(/^M\s*\|\s*PDF Studio$/);

    fireEvent.pointerEnter(screen.getByTestId('mee-arai-app-name'), { pointerType: 'mouse' });
    expect(brand).toHaveAttribute('data-expanded', 'false');

    fireEvent.pointerEnter(trigger, { pointerType: 'pen' });
    expect(brand).toHaveAttribute('data-expanded', 'true');
    expect(brand).toHaveTextContent(/^Mee-a-rai\s*\|\s*PDF Studio$/);

    fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
    expect(brand).toHaveAttribute('data-expanded', 'false');
  });

  it('opens for focus and closes for Escape, blur, and an outside pointer', () => {
    renderBrand();
    const brand = screen.getByTestId('mee-arai-brand');
    const trigger = screen.getByRole('button', { name: /mee-a-rai brand/i });

    fireEvent.focus(trigger);
    expect(brand).toHaveAttribute('data-expanded', 'true');

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(brand).toHaveAttribute('data-expanded', 'false');

    fireEvent.focus(trigger);
    fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
    expect(brand).toHaveAttribute('data-expanded', 'false');

    fireEvent.focus(trigger);
    fireEvent.blur(trigger);
    expect(brand).toHaveAttribute('data-expanded', 'false');
  });

  it('keeps the first touch tap open through its pointerleave and closes on the second tap', () => {
    renderBrand();
    const brand = screen.getByTestId('mee-arai-brand');
    const trigger = screen.getByRole('button', { name: /mee-a-rai brand/i });

    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    fireEvent.pointerLeave(trigger, { pointerType: 'touch' });
    expect(brand).toHaveAttribute('data-expanded', 'true');

    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    expect(brand).toHaveAttribute('data-expanded', 'false');
  });

  it('keeps a fixed M safe area while allowing the app label to truncate first', () => {
    renderBrand();
    const brand = screen.getByTestId('mee-arai-brand');
    const trigger = screen.getByRole('button', { name: /mee-a-rai brand/i });
    const appName = screen.getByTestId('mee-arai-app-name');

    expect(brand).toHaveStyle({ '--mee-arai-idle-width': '39px', '--mee-arai-expanded-width': '166px' });
    expect(trigger).toHaveStyle({ minWidth: '35px' });
    expect(appName).toHaveClass('mee-arai-brand__app-name');
    expect(brand).not.toHaveTextContent('มีอะไร');
  });

  it('integrates one Mee-a-rai brand without duplicating it in the header', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    render(<DownloadQueueProvider><HeaderNav /></DownloadQueueProvider>);

    const trigger = screen.getByRole('button', { name: /mee-a-rai brand/i });
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });

    expect(screen.getAllByText('Mee-a-rai')).toHaveLength(1);
    expect(screen.getByTestId('mee-arai-brand')).toHaveTextContent(/^Mee-a-rai\s*\|\s*PDF Studio$/);
  });
});
