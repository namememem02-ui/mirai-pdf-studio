// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MeeARaiBrand from './MeeARaiBrand';
import HeaderNav from './HeaderNav';
import { DownloadQueueProvider } from '@/context/DownloadQueueContext';

const expandedTriggerSelector = '.mee-arai-brand--expanded .mee-arai-brand__trigger';
const expandedWidth = 'var(--mee-arai-expanded-width)';

function mediaBlocks(css: string) {
  const blocks: string[] = [];
  let cursor = 0;

  while (true) {
    const mediaStart = css.indexOf('@media', cursor);
    if (mediaStart === -1) return blocks;

    const openingBrace = css.indexOf('{', mediaStart);
    let depth = 1;
    let index = openingBrace + 1;

    while (index < css.length && depth > 0) {
      if (css[index] === '{') depth += 1;
      if (css[index] === '}') depth -= 1;
      index += 1;
    }

    blocks.push(css.slice(openingBrace + 1, index - 1));
    cursor = index;
  }
}

function invalidExpandedTriggerMediaOverrides(css: string) {
  return mediaBlocks(css).flatMap((block) =>
    [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selectors, declarations]) => {
      if (!selectors.includes(expandedTriggerSelector)) return [];

      return [...declarations.matchAll(/\b(width|flex-basis)\s*:\s*([^;]+);?/g)]
        .filter(([, , value]) => value.trim() !== expandedWidth)
        .map(([, property, value]) => `${property}: ${value.trim()}`);
    }),
  );
}

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

  it('keeps the first full touch sequence open and closes on the second even after touch-induced focus', async () => {
    renderBrand();
    const brand = screen.getByTestId('mee-arai-brand');
    const trigger = screen.getByRole('button', { name: /mee-a-rai brand/i });

    fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    await Promise.resolve();
    fireEvent.click(trigger);
    fireEvent.focus(trigger);
    fireEvent.pointerLeave(trigger, { pointerType: 'touch' });
    expect(brand).toHaveAttribute('data-expanded', 'true');

    fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    await Promise.resolve();
    fireEvent.click(trigger);
    fireEvent.focus(trigger);
    fireEvent.pointerLeave(trigger, { pointerType: 'touch' });
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

  it('allows no media-query override of the expanded 166px trigger contract', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
    const alternateMobileWidth = `${css}\n@media (max-width: 480px) { ${expandedTriggerSelector} { width: 120px; flex-basis: 120px; } }`;

    expect(css).toContain('.mee-arai-brand--expanded .mee-arai-brand__trigger { width: var(--mee-arai-expanded-width);');
    expect(invalidExpandedTriggerMediaOverrides(css)).toEqual([]);
    expect(invalidExpandedTriggerMediaOverrides(alternateMobileWidth)).toEqual(['width: 120px', 'flex-basis: 120px']);
  });
});
