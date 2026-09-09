'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function PageHeader({
  icon,
  title,
  description,
  onReset,
}: {
  icon: string;
  title: string;
  description: string;
  onReset?: () => void;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleReset = () => {
    setIsRefreshing(true);
    if (onReset) {
      onReset();
      setTimeout(() => setIsRefreshing(false), 400);
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-600 transition flex items-center gap-1"
        >
          ← เครื่องมือทั้งหมด
        </Link>

        <button
          type="button"
          onClick={handleReset}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:text-blue-600 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg shadow-xs transition cursor-pointer group disabled:opacity-60"
          title="รีเฟรชหน้า / ล้างค่าทั้งหมดเพื่อเริ่มใหม่"
          aria-label="รีเฟรชหน้าหรือล้างค่าเพื่อเริ่มใหม่"
        >
          <span
            className={`text-xs transition-transform duration-500 inline-block ${
              isRefreshing ? 'animate-spin' : 'group-hover:rotate-180'
            }`}
          >
            🔄
          </span>
          <span className="hidden sm:inline">รีเฟรช / ล้างค่า</span>
          <span className="sm:hidden">ล้างค่า</span>
        </button>
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mt-2 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h1>
      <p className="text-gray-500 mt-1">{description}</p>
    </div>
  );
}
