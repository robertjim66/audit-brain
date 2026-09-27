'use client';

import React, { useState, useEffect } from 'react';

// ============ Button ============
export function Button({
  children, variant = 'primary', size = 'md', className = '', disabled, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };
  const variants = {
    primary: 'bg-primary text-primary-fg hover:opacity-90',
    secondary: 'bg-card text-text border border-border hover:bg-bg',
    danger: 'bg-danger text-white hover:opacity-90',
    ghost: 'text-text-secondary hover:bg-bg',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled} {...props}>
      {children}
    </button>
  );
}

// ============ Card ============
export function Card({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-card border border-border rounded-xl shadow-card ${className}`} {...props}>
      {children}
    </div>
  );
}

// ============ Badge ============
export function Badge({ children, color = 'primary', className = '' }: { children: React.ReactNode; color?: 'primary' | 'success' | 'danger' | 'warning' | 'muted'; className?: string }) {
  const colors = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    danger: 'bg-danger/10 text-danger',
    warning: 'bg-warning/10 text-warning',
    muted: 'bg-text-muted/10 text-text-muted',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]} ${className}`}>{children}</span>;
}

// ============ StatCard ============
export function StatCard({ label, value, hint, color = 'primary' }: { label: string; value: React.ReactNode; hint?: string; color?: 'primary' | 'success' | 'danger' | 'warning' }) {
  const ring = { primary: 'text-primary', success: 'text-success', danger: 'text-danger', warning: 'text-warning' }[color];
  return (
    <Card className="p-4">
      <div className="text-sm text-text-secondary">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${ring}`}>{value}</div>
      {hint && <div className="text-xs text-text-muted mt-1">{hint}</div>}
    </Card>
  );
}

// ============ Spinner ============
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-border border-t-primary"
      style={{ width: size, height: size }}
    />
  );
}

// ============ Modal ============
export function Modal({ open, title, onClose, children, footer, width = 'max-w-lg' }: {
  open: boolean; title?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-card border border-border rounded-xl shadow-xl w-full ${width} max-h-[90vh] overflow-hidden flex flex-col`}>
        {title && (
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-text">{title}</h3>
            <button onClick={onClose} className="text-text-muted hover:text-text text-xl leading-none">×</button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-border flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// ============ Confirm ============
export function useConfirm() {
  const [state, setState] = useState<{ open: boolean; message: string; resolve?: (v: boolean) => void }>({ open: false, message: '' });
  const confirm = (message: string) => new Promise<boolean>((resolve) => setState({ open: true, message, resolve }));
  const close = (v: boolean) => { setState((s) => ({ ...s, open: false })); state.resolve?.(v); };
  const node = (
    <Modal open={state.open} title="确认操作" onClose={() => close(false)}
      footer={<>
        <Button variant="secondary" onClick={() => close(false)}>取消</Button>
        <Button variant="danger" onClick={() => close(true)}>确定</Button>
      </>}>
      <p className="text-text-secondary">{state.message}</p>
    </Modal>
  );
  return { confirm, ConfirmNode: node };
}

// ============ Table 基础封装 ============
export function Table({ headers, children, className = '' }: { headers: string[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto border border-border rounded-xl bg-card ${className}`}>
      <table className="w-full text-sm">
        <thead className="bg-bg text-text-secondary">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`w-full px-3 py-2 rounded-lg border border-border bg-bg text-text outline-none focus:border-primary ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`w-full px-3 py-2 rounded-lg border border-border bg-bg text-text outline-none focus:border-primary ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`w-full px-3 py-2 rounded-lg border border-border bg-bg text-text outline-none focus:border-primary ${className}`} {...props}>{children}</select>;
}
