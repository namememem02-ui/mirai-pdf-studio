// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GlobalUsageBadge from './GlobalUsageBadge';
import { setCachedUsage } from '@/lib/usage';

describe('GlobalUsageBadge', () => {
  it('renders with cached total', async () => {
    setCachedUsage({
      tools: { merge: 5 },
      total: 88,
      updatedAt: Date.now(),
    });

    render(<GlobalUsageBadge />);

    expect(await screen.findByText('ประมวลผลสะสม:')).toBeInTheDocument();
    expect(screen.getByText('88 ครั้ง')).toBeInTheDocument();
  });
});
