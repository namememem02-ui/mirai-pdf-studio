// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ToolCard from './ToolCard';
import { ToolInfo } from '@/lib/tools';

const mockTool: ToolInfo = {
  id: 'merge',
  name: 'รวม PDF',
  description: 'รวม PDF หลายไฟล์เป็นไฟล์เดียว',
  icon: '🗂️',
  color: 'bg-red-100',
};

describe('ToolCard', () => {
  it('renders tool information and default 0 count badge', () => {
    render(<ToolCard tool={mockTool} />);

    expect(screen.getByText('รวม PDF')).toBeInTheDocument();
    expect(screen.getByText('รวม PDF หลายไฟล์เป็นไฟล์เดียว')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('ครั้ง')).toBeInTheDocument();
  });

  it('renders custom usage count when provided', () => {
    render(<ToolCard tool={mockTool} usageCount={1250} />);

    expect(screen.getByText('1,250')).toBeInTheDocument();
  });
});
