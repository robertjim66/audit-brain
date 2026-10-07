'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconClose, IconTrendDown, IconTrendUp, type IconProps } from './icons';

// ============ Button ============
export function Button({
  children, variant = 'primary', size = 'md', className = '', disabled, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent' | 'link';
  size?: 'sm' | 'md' | 'lg';
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 ease-smooth select-none disabled:opacity-45 disabled:cursor-not-allowed active:translate-y-px';
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-[7px] text-sm', lg: 'px-4 py-2.5 text-base' };
  const variants = {
    primary: 'bg-primary text-primary-fg hover:bg-primary-hover shadow-sm',
    accent: 'bg-accent text-accent-fg hover:opacity-90 shadow-sm',
    secondary: 'bg-card text-text border border-border hover:bg-surface2 hover:border-border-strong',
    danger: 'bg-danger text-white hover:opacity-90 shadow-sm',
    ghost: 'text-text-secondary hover:bg-surface2 hover:text-text',
    link: 'text-primary hover:text-primary-hover underline-offset-4 hover:underline px-0',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled} {...props}>
      {children}
    </button>
  );
}

// ============ Card ============
export function Card({
  children, className = '', hoverable, ...props
}: React.HTMLAttributes<HTMLDivElement> & { hoverable?: boolean }) {
  return (
    <div
      className={`bg-card border border-border rounded-xl shadow-card ${
        hoverable ? 'transition-shadow duration-150 ease-smooth hover:shadow-card-hover' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// ============ Badge ============
/**
 * 徽章：方形小圆角 + 极细同色描边，比纯色块的圆角 pill 更接近"印章/标签"的语义，
 * 契合审计场景对状态标记的可信感要求。
 */
export function Badge({
  children, color = 'primary', dot, className = '',
}: {
  children: React.ReactNode;
  color?: 'primary' | 'success' | 'danger' | 'warning' | 'muted' | 'accent';
  dot?: boolean;
  className?: string;
}) {
  const colors = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    muted: 'bg-text-muted/10 text-text-secondary border-text-muted/20',
    accent: 'bg-accent/10 text-accent border-accent/20',
  };
  const dots = {
    primary: 'bg-primary', success: 'bg-success', danger: 'bg-danger',
    warning: 'bg-warning', muted: 'bg-text-muted', accent: 'bg-accent',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-[1px] text-xs font-medium leading-5 ${colors[color]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dots[color]}`} />}
      {children}
    </span>
  );
}

// ============ StatCard ============
/**
 * 指标卡：数字不染色（染色数字是仪表盘廉价感的来源），语义色只体现在左侧细条与趋势上。
 * 金额 / 数量一律走 tabular-nums，保证能竖着扫。
 */
export function StatCard({
  label, value, hint, color = 'primary', icon: Icon, trend,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  color?: 'primary' | 'success' | 'danger' | 'warning' | 'accent' | 'muted';
  icon?: React.ComponentType<IconProps>;
  trend?: { text: string; dir: 'up' | 'down' | 'flat' };
}) {
  const bar = {
    primary: 'bg-primary', success: 'bg-success', danger: 'bg-danger',
    warning: 'bg-warning', accent: 'bg-accent', muted: 'bg-text-muted',
  }[color];
  const TrendIcon = trend?.dir === 'down' ? IconTrendDown : IconTrendUp;
  return (
    <div className="relative bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <span className={`absolute left-0 top-0 h-full w-[3px] ${bar}`} />
      <div className="pl-4 pr-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow truncate">{label}</span>
          {Icon && <Icon size={15} className="text-text-muted shrink-0" />}
        </div>
        <div className="num mt-1.5 text-[26px] font-semibold leading-none tracking-tight text-text">{value}</div>
        {(hint || trend) && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
            {trend && (
              <span
                className={`inline-flex items-center gap-0.5 font-medium ${
                  trend.dir === 'up' ? 'text-danger' : trend.dir === 'down' ? 'text-success' : 'text-text-muted'
                }`}
              >
                {trend.dir !== 'flat' && <TrendIcon size={12} />}
                {trend.text}
              </span>
            )}
            {hint && <span className="truncate">{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Spinner ============
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-[1.5px] border-border border-t-primary"
      style={{ width: size, height: size }}
    />
  );
}

// ============ Modal ============
export function Modal({
  open, title, description, onClose, children, footer, width = 'max-w-lg',
}: {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // portal 到 body：顶栏带 backdrop-blur，backdrop-filter 会让其内部所有
  // fixed 元素改为相对顶栏定位（弹窗会被"居中"到 56px 高的顶栏上、上半截飞出屏幕），
  // 挂到 body 才能真正相对视口定位。mounted 门闩避免 SSR hydration 不匹配。
  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative bg-card border border-border rounded-xl shadow-pop w-full ${width} max-h-[88vh] overflow-hidden flex flex-col animate-fade-in-up`}
      >
        {(title || description) && (
          <div className="px-5 pt-4 pb-3 border-b border-border flex items-start justify-between gap-4">
            <div className="min-w-0">
              {title && <h3 className="text-[15px] font-semibold text-text leading-snug">{title}</h3>}
              {description && <p className="mt-0.5 text-xs text-text-muted leading-relaxed">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="-mr-1 -mt-0.5 p-1 rounded-md text-text-muted hover:text-text hover:bg-surface2 transition-colors"
              aria-label="关闭"
            >
              <IconClose size={16} />
            </button>
          </div>
        )}
        {/* flex-1 + min-h-0：内容区收缩并内部滚动，footer 永远可见（否则长内容会把 footer 挤出面板被裁掉） */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-border bg-surface2/60 flex justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ============ Confirm ============
export function useConfirm() {
  const [state, setState] = useState<{ open: boolean; message: string; resolve?: (v: boolean) => void }>({
    open: false, message: '',
  });
  const confirm = (message: string) => new Promise<boolean>((resolve) => setState({ open: true, message, resolve }));
  const close = (v: boolean) => { setState((s) => ({ ...s, open: false })); state.resolve?.(v); };
  const node = (
    <Modal
      open={state.open}
      title="确认操作"
      onClose={() => close(false)}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>取消</Button>
          <Button variant="danger" onClick={() => close(true)}>确定</Button>
        </>
      }
    >
      <p className="text-sm text-text-secondary leading-relaxed">{state.message}</p>
    </Modal>
  );
  return { confirm, ConfirmNode: node };
}

// ============ Table ============
export function Table({
  headers, children, className = '', sticky, striped = true, maxH, align,
}: {
  headers: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
  /** 表头吸顶（配合 maxH 使用） */
  sticky?: boolean;
  /** 斑马纹：长表格逐行扫读必需 */
  striped?: boolean;
  maxH?: string;
  /** 逐列对齐，金额列建议 'right' */
  align?: ('left' | 'right' | 'center')[];
}) {
  return (
    <div
      className={`overflow-auto rounded-xl border border-border bg-card ${className}`}
      style={maxH ? { maxHeight: maxH } : undefined}
    >
      <table className="w-full text-sm border-collapse">
        <thead className={sticky ? 'sticky top-0 z-[1]' : ''}>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={`bg-surface2 text-text-secondary text-xs font-medium px-3.5 py-2.5 whitespace-nowrap border-b border-border ${
                  align?.[i] === 'right' ? 'text-right' : align?.[i] === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={striped ? '[&>tr:nth-child(even)]:bg-surface2/40' : ''}>
          {children}
        </tbody>
      </table>
    </div>
  );
}

/** 表格行：统一 hover / 选中 / 分割线 */
export function Tr({
  children, active, onClick, className = '',
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-border/70 transition-colors duration-100 ${
        onClick ? 'cursor-pointer' : ''
      } ${active ? 'bg-primary/[0.07]' : 'hover:bg-surface2/70'} ${className}`}
    >
      {children}
    </tr>
  );
}

export function Td({
  children, className = '', align,
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <td
      className={`px-3.5 py-2.5 text-text align-top ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  );
}

// ============ 表单 ============
const fieldBase =
  'w-full rounded-lg border border-border bg-card px-3 py-[7px] text-sm text-text placeholder:text-text-muted transition-colors duration-150 outline-none hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50 disabled:cursor-not-allowed';

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldBase} ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldBase} leading-relaxed ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${fieldBase} pr-8 appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237A8794' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

/** 表单字段容器：标签在上、控件在下，带可选说明 */
export function Field({
  label, required, hint, children, className = '',
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="eyebrow mb-1.5 block text-text-secondary">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-muted leading-relaxed">{hint}</span>}
    </label>
  );
}

// ============ Segmented（筛选切换） ============
export function Segmented<T extends string>({
  options, value, onChange, size = 'md', className = '', full = false,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  /** 选项等分填满容器（登录/注册切换这类需要对齐的场景） */
  full?: boolean;
}) {
  return (
    <div
      className={`${full ? 'flex w-full' : 'inline-flex'} items-center gap-0.5 rounded-lg border border-border bg-surface2 p-0.5 ${className}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md font-medium transition-colors duration-150 ${
            size === 'sm' ? 'px-2.5 py-[3px] text-xs' : 'px-3 py-1 text-sm'
          } ${full ? 'flex-1 text-center' : ''} ${
            value === o.value
              ? 'bg-card text-text shadow-card border border-border'
              : 'text-text-secondary hover:text-text border border-transparent'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ============ PageHeader / Section / EmptyState ============
export function PageHeader({
  title, description, actions, className = '',
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-text leading-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-3xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Section({
  title, description, actions, children, className = '', bodyClassName = '',
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`bg-card border border-border rounded-xl shadow-card ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold text-text leading-snug">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon, title, hint, action, className = '',
}: {
  icon?: React.ComponentType<IconProps>;
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {Icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface2 text-text-muted">
          <Icon size={20} />
        </div>
      )}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {hint && <p className="mt-1 text-xs text-text-muted max-w-sm leading-relaxed">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Divider({ className = '' }: { className?: string }) {
  return <div className={`h-px bg-border ${className}`} />;
}
