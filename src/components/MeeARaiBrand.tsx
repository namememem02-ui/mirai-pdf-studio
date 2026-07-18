'use client';

import React, { useEffect, useRef, useState } from 'react';

interface MeeARaiBrandProps {
  appName: string;
  accentColor?: string;
  className?: string;
}

export default function MeeARaiBrand({
  appName,
  accentColor = '#22d3ee',
  className = '',
}: MeeARaiBrandProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);
  const lastPointerType = useRef<string | null>(null);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (brandRef.current && !brandRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, []);

  const pointerType = (event: React.PointerEvent<HTMLButtonElement>) => event.pointerType;
  const isHoverPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const type = pointerType(event);
    return type === 'mouse' || type === 'pen';
  };

  return (
    <div
      ref={brandRef}
      className={`mee-arai-brand ${isExpanded ? 'mee-arai-brand--expanded' : ''} ${className}`.trim()}
      data-expanded={isExpanded}
      data-testid="mee-arai-brand"
      style={
        {
          '--mee-arai-accent': accentColor,
          '--mee-arai-idle-width': '39px',
          '--mee-arai-expanded-width': '166px',
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        className="mee-arai-brand__trigger"
        aria-label="Toggle Mee-a-rai brand"
        aria-expanded={isExpanded}
        style={{ minWidth: '35px' }}
        onPointerEnter={(event) => {
          if (isHoverPointer(event)) setIsExpanded(true);
        }}
        onPointerLeave={(event) => {
          if (isHoverPointer(event)) setIsExpanded(false);
        }}
        onPointerDown={(event) => {
          lastPointerType.current = pointerType(event);
          if (lastPointerType.current !== 'touch') return;
          setIsExpanded((expanded) => !expanded);
        }}
        onFocus={() => {
          if (lastPointerType.current !== 'touch') setIsExpanded(true);
        }}
        onBlur={() => {
          lastPointerType.current = null;
          setIsExpanded(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsExpanded(false);
            event.currentTarget.blur();
          }
        }}
      >
        <span aria-hidden="true">{isExpanded ? 'Mee-a-rai' : 'M'}</span>
      </button>
      <span className="mee-arai-brand__separator" aria-hidden="true">|</span>
      <span className="mee-arai-brand__app-name" data-testid="mee-arai-app-name" title={appName}>
        {appName}
      </span>
    </div>
  );
}
