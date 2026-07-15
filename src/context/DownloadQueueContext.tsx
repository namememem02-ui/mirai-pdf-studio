'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { downloadBlob } from '@/lib/pdf';
import { createZipBlob } from '@/lib/download';
import RenameDownloadModal from '@/components/RenameDownloadModal';

export interface DownloadItem {
  id: string;
  filename: string;
  blob: Blob;
  size: number;
  fileExt: string;
  createdAt: number;
}

interface DownloadQueueContextType {
  queue: DownloadItem[];
  addToQueue: (filename: string, blob: Blob) => string;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  downloadItem: (id: string) => void;
  downloadAll: () => void;
  requestBlobDownload: (filename: string, blob: Blob) => void;
  downloadItems: (ids: string[], zipName?: string) => Promise<void>;
}

const DownloadQueueContext = createContext<DownloadQueueContextType | undefined>(undefined);

export function DownloadQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<DownloadItem[]>([]);
  const [pending, setPending] = useState<{ filename: string; blob: Blob } | null>(null);

  const addToQueue = (filename: string, blob: Blob) => {
    const fileExt = filename.split('.').pop()?.toLowerCase() || '';
    const id = `dl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newItem: DownloadItem = {
      id,
      filename,
      blob,
      size: blob.size,
      fileExt,
      createdAt: Date.now(),
    };
    setQueue((prev) => [newItem, ...prev]);
    return id;
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearQueue = () => {
    setQueue([]);
  };

  const downloadItem = (id: string) => {
    const item = queue.find((i) => i.id === id);
    if (item) setPending({ filename: item.filename, blob: item.blob });
  };

  const downloadAll = async () => {
    if (queue.length === 0) return;
    if (queue.length === 1) return downloadItem(queue[0].id);
    const blob = await createZipBlob(queue.map(({ filename, blob }) => ({ filename, blob })));
    setPending({ filename: 'mirai-pdf-files.zip', blob });
  };

  const requestBlobDownload = (filename: string, blob: Blob) => setPending({ filename, blob });

  const downloadItems = async (ids: string[], zipName = 'selected-files.zip') => {
    const items = queue.filter((item) => ids.includes(item.id));
    if (items.length === 0) return;
    if (items.length === 1) return downloadItem(items[0].id);
    const blob = await createZipBlob(items.map(({ filename, blob }) => ({ filename, blob })));
    setPending({ filename: zipName, blob });
  };

  return (
    <DownloadQueueContext.Provider
      value={{
        queue,
        addToQueue,
        removeFromQueue,
        clearQueue,
        downloadItem,
        downloadAll,
        requestBlobDownload,
        downloadItems,
      }}
    >
      {children}
      {pending && (
        <RenameDownloadModal
          filename={pending.filename}
          onCancel={() => setPending(null)}
          onConfirm={(filename) => {
            downloadBlob(pending.blob, filename, pending.blob.type);
            setPending(null);
          }}
        />
      )}
    </DownloadQueueContext.Provider>
  );
}

export function useDownloadQueue() {
  const context = useContext(DownloadQueueContext);
  if (!context) {
    throw new Error('useDownloadQueue must be used within a DownloadQueueProvider');
  }
  return context;
}
