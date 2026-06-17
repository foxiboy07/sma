import React, { useState, useRef, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, ChevronDown, Check } from 'lucide-react';
import { Toast } from '../../types';

// ---- Button ----
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({ variant = 'secondary', size = 'default', loading, children, className = '', disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]';
  const variants = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-[#1A1C24] border border-[#2A2E42] text-[#F0F2FF] hover:bg-[#222530]',
    ghost: 'text-[#8B90A7] hover:bg-[#1A1C24] hover:text-[#F0F2FF]',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20',
  };
  const sizes = {
    sm: 'h-7 px-3 text-xs',
    default: 'h-8 px-4 text-sm',
    lg: 'h-10 px-5 text-base',
    icon: 'h-8 w-8 p-0',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {children}
        </>
      ) : children}
    </button>
  );
}

// ---- Badge ----
interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'platform';
  platform?: 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', platform, children, className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-[#1A1C24] text-[#8B90A7] border border-[#2A2E42]',
    success: 'bg-green-500/15 text-green-400 border border-green-500/20',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    danger: 'bg-red-500/15 text-red-400 border border-red-500/20',
    info: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
    platform: platform === 'INSTAGRAM' ? 'bg-pink-500/15 text-pink-400 border border-pink-500/20'
      : platform === 'FACEBOOK' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
      : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

// ---- StatusDot ----
export function StatusDot({ status }: { status: 'HEALTHY' | 'EXPIRING' | 'BROKEN' | 'active' | 'inactive' }) {
  const colors = {
    HEALTHY: 'bg-green-400',
    active: 'bg-green-400',
    EXPIRING: 'bg-amber-400',
    BROKEN: 'bg-red-400',
    inactive: 'bg-gray-500',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-gray-500'}`} />;
}

// ---- Input ----
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export function Input({ label, error, leftIcon, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[#8B90A7]">{label}</label>}
      <div className="relative">
        {leftIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5068]">{leftIcon}</span>}
        <input
          className={`h-9 w-full rounded-lg bg-[#1A1C24] border ${error ? 'border-red-500' : 'border-[#2A2E42]'} text-[#F0F2FF] placeholder:text-[#4B5068] px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${leftIcon ? 'pl-9' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ---- Textarea ----
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[#8B90A7]">{label}</label>}
      <textarea
        className={`w-full rounded-lg bg-[#1A1C24] border ${error ? 'border-red-500' : 'border-[#2A2E42]'} text-[#F0F2FF] placeholder:text-[#4B5068] px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-y min-h-[80px] ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ---- Select ----
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className = '', ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-[#8B90A7]">{label}</label>}
      <div className="relative">
        <select
          className={`h-9 w-full appearance-none rounded-lg bg-[#1A1C24] border ${error ? 'border-red-500' : 'border-[#2A2E42]'} text-[#F0F2FF] px-3 pr-8 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer ${className}`}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-[#1A1C24]">{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4B5068] pointer-events-none" />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ---- Toggle ----
interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  size?: 'sm' | 'default';
}

export function Toggle({ checked, onChange, label, size = 'default' }: ToggleProps) {
  const s = size === 'sm';
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        className={`relative rounded-full transition-colors duration-200 ${s ? 'w-8 h-4' : 'w-10 h-5'} ${checked ? 'bg-blue-500' : 'bg-[#2A2E42]'}`}
        onClick={() => onChange(!checked)}
      >
        <div className={`absolute top-0.5 rounded-full bg-white transition-transform duration-200 ${s ? 'w-3 h-3' : 'w-4 h-4'} ${checked ? (s ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0.5'}`} />
      </div>
      {label && <span className="text-sm text-[#8B90A7]">{label}</span>}
    </label>
  );
}

// ---- Card ----
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className = '', onClick, hover }: CardProps) {
  return (
    <div
      className={`bg-[#1A1C24] border border-[#2A2E42] rounded-xl p-4 ${hover ? 'cursor-pointer hover:border-blue-500/30 transition-all duration-150' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ---- Modal ----
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg', footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative w-full ${maxWidth} bg-[#1A1C24] border border-[#2A2E42] rounded-2xl shadow-2xl modal-enter`}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2130]">
            <h2 className="text-base font-semibold text-[#F0F2FF]">{title}</h2>
            <button onClick={onClose} className="p-1 rounded-lg text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#222530] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-[#1E2130] flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Dropdown ----
interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export function Dropdown({ trigger, items, align = 'right' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen(p => !p)} className="cursor-pointer">{trigger}</div>
      {open && (
        <div className={`absolute z-50 mt-1 w-48 bg-[#1A1C24] border border-[#2A2E42] rounded-xl shadow-2xl py-1 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.map((item, i) => item.divider ? (
            <div key={i} className="my-1 border-t border-[#1E2130]" />
          ) : (
            <button
              key={i}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-[#8B90A7] hover:bg-[#222530] hover:text-[#F0F2FF]'}`}
              onClick={() => { item.onClick?.(); setOpen(false); }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Skeleton ----
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

// ---- Progress ----
export function Progress({ value, max = 100, color = 'bg-blue-500', className = '' }: { value: number; max?: number; color?: string; className?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`h-1.5 bg-[#2A2E42] rounded-full overflow-hidden ${className}`}>
      <div className={`h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---- Toasts ----
export function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  const icons = {
    success: <CheckCircle className="w-4 h-4 text-green-400" />,
    error: <AlertCircle className="w-4 h-4 text-red-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    info: <Info className="w-4 h-4 text-blue-400" />,
  };
  const borders = {
    success: 'border-l-green-400',
    error: 'border-l-red-400',
    warning: 'border-l-amber-400',
    info: 'border-l-blue-400',
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(t => (
        <div key={t.id} className={`toast-enter flex items-start gap-3 bg-[#1A1C24] border border-[#2A2E42] border-l-4 ${borders[t.type]} rounded-xl p-4 shadow-2xl`}>
          {icons[t.type]}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#F0F2FF]">{t.title}</p>
            {t.description && <p className="text-xs text-[#8B90A7] mt-0.5">{t.description}</p>}
            {t.action && (
              <button onClick={t.action.onClick} className="text-xs text-blue-400 hover:text-blue-300 mt-1 font-medium">{t.action.label}</button>
            )}
          </div>
          <button onClick={() => onRemove(t.id)} className="text-[#4B5068] hover:text-[#F0F2FF]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---- Empty State ----
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1A1C24] border border-[#2A2E42] flex items-center justify-center mb-4 text-[#4B5068]">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-[#F0F2FF] mb-1">{title}</h3>
      {description && <p className="text-xs text-[#8B90A7] max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ---- Tabs ----
interface TabsProps {
  tabs: { id: string; label: string; badge?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex gap-1 p-1 bg-[#111318] rounded-lg border border-[#1E2130] ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${active === tab.id ? 'bg-[#1A1C24] text-[#F0F2FF] shadow-sm' : 'text-[#8B90A7] hover:text-[#F0F2FF]'}`}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="bg-blue-500 text-white text-[10px] rounded-full px-1.5 py-0 font-bold">{tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---- Checkbox ----
interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

export function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${checked ? 'bg-blue-500 border-blue-500' : 'border-[#2A2E42] bg-[#1A1C24]'}`}
        onClick={() => onChange(!checked)}
      >
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>
      {label && <span className="text-sm text-[#8B90A7]">{label}</span>}
    </label>
  );
}

// ---- Metric Card ----
interface MetricCardProps {
  label: string;
  value: string | number;
  change?: { value: string; positive: boolean };
  icon?: React.ReactNode;
  iconColor?: string;
  subtitle?: string;
}

export function MetricCard({ label, value, change, icon, iconColor = 'text-blue-400', subtitle }: MetricCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-[#8B90A7] font-medium uppercase tracking-wider">{label}</p>
        {icon && <div className={`${iconColor}`}>{icon}</div>}
      </div>
      <p className="text-2xl font-bold text-[#F0F2FF] mb-1">{value}</p>
      {subtitle && <p className="text-xs text-[#8B90A7]">{subtitle}</p>}
      {change && (
        <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${change.positive ? 'text-green-400' : 'text-red-400'}`}>
          <span>{change.positive ? '↑' : '↓'}</span>
          <span>{change.value}</span>
        </div>
      )}
    </Card>
  );
}

// ---- Platform Icon ----
export function PlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  const style = { width: size, height: size };
  if (platform === 'INSTAGRAM') return (
    <svg style={style} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#E1306C" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="17.5" cy="6.5" r="1" fill="white" />
    </svg>
  );
  if (platform === 'FACEBOOK') return (
    <svg style={style} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#1877F2" />
      <path d="M13 21V13h2.5l.5-3H13V8c0-.83.33-1 1-1h2V4s-1-.5-3-.5C10 3.5 9 6 9 8v2H7v3h2v8h4z" fill="white" />
    </svg>
  );
  if (platform === 'TIKTOK') return (
    <svg style={style} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="5" fill="#010101" />
      <path d="M16 4s.5 3 3 3v3s-2 0-3-1v5.5c0 2.5-2 4.5-4.5 4.5S7 17 7 14.5 9 10 11.5 10v3s-1.5 0-1.5 1.5 1 1.5 1.5 1.5S13 15.5 13 14.5V4h3z" fill="#69C9D0" />
    </svg>
  );
  return null;
}

// ---- Loyalty Badge ----
export function LoyaltyBadge({ tier }: { tier: string }) {
  const config = {
    NEWBIE: { color: 'text-gray-400 bg-gray-400/10 border-gray-400/20', label: 'Newbie' },
    FAN: { color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', label: 'Fan' },
    ADVOCATE: { color: 'text-green-400 bg-green-400/10 border-green-400/20', label: 'Advocate' },
  };
  const c = config[tier as keyof typeof config] || config.NEWBIE;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.color}`}>
      {c.label}
    </span>
  );
}

// ---- Tooltip ----
export function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg bg-[#222530] border border-[#2A2E42] text-xs text-[#F0F2FF] whitespace-nowrap shadow-lg pointer-events-none">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#222530]" />
        </div>
      )}
    </div>
  );
}

// ---- CircuitBadge ----
export function CircuitBadge({ state }: { state: string }) {
  const config = {
    CLOSED: { color: 'text-green-400 bg-green-400/10 border-green-400/20', label: 'Closed' },
    OPEN: { color: 'text-red-400 bg-red-400/10 border-red-400/20', label: 'Open' },
    HALF_OPEN: { color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', label: 'Half-Open' },
  };
  const c = config[state as keyof typeof config] || config.CLOSED;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${c.color}`}>
      {c.label}
    </span>
  );
}
