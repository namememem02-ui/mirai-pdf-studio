'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { downloadBlob } from '@/lib/pdf';

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
}

const DownloadQueueContext = createContext<DownloadQueueContextType | undefined>(undefined);

export function DownloadQueueProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<DownloadItem[]>([]);

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
    if (item) {
      downloadBlob(item.blob, item.filename, item.blob.type);
    }
  };

  const downloadAll = async () => {
    if (queue.length === 0) return;
    
    // For multiple PDFs, we can download them one by one
    for (const item of queue) {
      downloadItem(item.id);
      // Small delay between downloads to prevent browser blocking
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
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
      }}
    >
      {children}
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
