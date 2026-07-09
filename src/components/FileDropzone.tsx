'use client';

import React, { useRef, useState } from 'react';

export default function FileDropzone({
  accept,
  multiple = false,
  label,
  hint,
  onFiles,
}: {
  accept: string;           // e.g. "application/pdf,.pdf"
  multiple?: boolean;
  label: string;
  hint?: string;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handle = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handle(e.dataTransfer.files); }}
      className={`bg-white border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
        dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => { handle(e.target.files); e.target.value = ''; }}
      />
      <div className="text-4xl mb-2">📥</div>
      <p className="font-semibold text-gray-700">{label}</p>
      {hint && <p className="text-sm text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
