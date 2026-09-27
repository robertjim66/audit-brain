'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastCtx {
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
  success: (m: string) => void;
  error: (m: string) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const success = useCallback((m: string) => toast(m, 'success'), [toast]);
  const error = useCallback((m: string) => toast(m, 'error'), [toast]);

  const colorMap = {
    success: 'border-success text-success',
    error: 'border-danger text-danger',
    info: 'border-primary text-primary',
  };

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={`bg-card border-l-4 ${colorMap[t.type]} px-4 py-2.5 rounded-lg shadow-card text-sm min-w-[200px]`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用');
  return ctx;
}
