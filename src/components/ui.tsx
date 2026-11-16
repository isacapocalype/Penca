import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, CheckCircle2, ChevronDown, Info, Loader2, Search, X } from 'lucide-react';
import type { OrderStatus, StoreStatus, TaxStatus } from '../lib/constants';
import { ORDER_STATUS_LABELS, STORE_STATUS_LABELS, TAX_STATUS_LABELS } from '../lib/constants';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export type Tone = 'neutral' | 'primary' | 'success' | 'danger' | 'info' | 'warning';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-secondary border-outline',
  primary: 'bg-primary-soft text-primary-text border-primary/30',
  success: 'bg-success-soft text-success border-success/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  info: 'bg-info-soft text-info border-info/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: LucideIcon;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon: Icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-primary text-on-surface shadow-soft hover:bg-primary-strong active:scale-[0.99]',
    secondary: 'bg-surface border border-outline-strong text-on-surface hover:bg-surface-muted',
    ghost: 'bg-transparent text-secondary hover:bg-surface-muted',
    danger: 'bg-danger text-white hover:bg-danger/90',
    soft: 'bg-primary-soft text-primary-text border border-primary/25 hover:bg-primary/20',
  };
  const sizes = {
    sm: 'min-h-9 rounded-xl px-3 text-xs gap-1.5',
    md: 'min-h-11 rounded-2xl px-4 text-sm gap-2',
    lg: 'min-h-12 rounded-2xl px-5 text-sm gap-2',
  };

  return (
    <button
      type={props.type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  icon: Icon,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl text-secondary transition hover:bg-surface-muted disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return <Tag className={cn('card', className)}>{children}</Tag>;
}

export function SectionTitle({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-2 flex items-end justify-between gap-3 px-1', className)}>
      <div>
        <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-secondary">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">{children}</p>;
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-xs font-medium text-secondary">
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </label>
      ) : null}
      <div className="contents" data-field-id={id}>
        {children}
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-[0.7rem] text-muted">{hint}</p> : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...props }, ref) {
    return <input ref={ref} className={cn('input-base', className)} {...props} />;
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn('input-base min-h-24 resize-y', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={cn('input-base appearance-none pr-9', className)} {...props}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>
    );
  },
);

export function SearchInput({
  value,
  onChange,
  placeholder = 'Cari…',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input-base pl-9"
      />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-on-surface">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-secondary">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-primary' : 'bg-outline-strong',
          disabled && 'opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
            checked ? 'left-[1.4rem]' : 'left-0.5',
          )}
        />
      </button>
    </label>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold leading-5',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const orderTones: Record<OrderStatus, Tone> = {
  pending: 'neutral',
  processing: 'info',
  shipped: 'info',
  delivered: 'success',
  completed: 'success',
  cancelled: 'danger',
  returned: 'warning',
  refunded: 'danger',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={orderTones[status]}>{ORDER_STATUS_LABELS[status] ?? status}</Badge>;
}

export function StoreStatusBadge({ status }: { status: StoreStatus }) {
  const tones: Record<StoreStatus, Tone> = { active: 'success', inactive: 'neutral', archived: 'warning' };

  return <Badge tone={tones[status]}>{STORE_STATUS_LABELS[status] ?? status}</Badge>;
}

export function TaxStatusBadge({ status }: { status: TaxStatus }) {
  const tones: Record<TaxStatus, Tone> = { draft: 'neutral', reported: 'info', paid: 'success' };

  return <Badge tone={tones[status]}>{TAX_STATUS_LABELS[status] ?? status}</Badge>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  return (
    <div className={cn('rounded-2xl border p-3.5', toneClasses[tone])}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.7rem] font-medium opacity-80">{label}</p>
        {Icon ? <Icon className="h-4 w-4 opacity-70" aria-hidden /> : null}
      </div>
      <p className="mt-1.5 font-heading text-lg font-bold leading-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-[0.65rem] opacity-75">{hint}</p> : null}
    </div>
  );
}

export function MetricRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'danger' | 'success' | 'muted';
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={cn('text-xs', strong ? 'font-semibold text-on-surface' : 'text-secondary')}>{label}</span>
      <span
        className={cn(
          'text-sm tabular-nums',
          strong ? 'font-heading font-bold text-on-surface' : 'font-medium text-on-surface',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success',
          tone === 'muted' && 'text-muted',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-outline-strong bg-surface/60 px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-3 font-heading text-sm font-bold text-on-surface">{title}</p>
      {description ? <p className="mt-1 max-w-xs text-xs leading-relaxed text-secondary">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Feedback({
  notice,
  error,
  onDismiss,
  className,
}: {
  notice?: string | null;
  error?: string | null;
  onDismiss?: () => void;
  className?: string;
}) {
  if (!notice && !error) {
    return null;
  }

  const tone = error ? 'danger' : 'success';
  const Icon = error ? AlertCircle : CheckCircle2;

  return (
    <div
      role={error ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-xs leading-relaxed',
        toneClasses[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">{error ?? notice}</p>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="rounded-full p-0.5 opacity-70 hover:opacity-100" aria-label="Tutup pesan">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function InfoNote({ children, tone = 'info' }: { children: ReactNode; tone?: Tone }) {
  const Icon = tone === 'danger' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;

  return (
    <div className={cn('flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[0.7rem] leading-relaxed', toneClasses[tone])}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-xs text-secondary">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function LoadingCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card animate-pulse space-y-3 p-4">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-3 rounded-full bg-surface-muted" style={{ width: `${90 - index * 14}%` }} />
      ))}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handler);

    return () => window.removeEventListener('keydown', handler);
  }, [open, busy, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-on-surface/30 p-4 backdrop-blur-sm sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm animate-fade-up rounded-3xl border border-outline bg-surface p-5 shadow-float"
      >
        <h2 id="confirm-title" className="font-heading text-base font-bold text-on-surface">
          {title}
        </h2>
        {description ? <p className="mt-1.5 text-xs leading-relaxed text-secondary">{description}</p> : null}
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" fullWidth onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} fullWidth onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ToastState {
  id: number;
  message: string;
  tone: 'success' | 'danger' | 'info';
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastState['tone']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastState['tone'] = 'success') => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-2 rounded-2xl border px-4 py-3 text-xs font-medium shadow-float',
              toneClasses[toast.tone],
            )}
          >
            {toast.tone === 'danger' ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="flex-1">{toast.message}</span>
            <button type="button" aria-label="Tutup notifikasi" onClick={() => dismiss(toast.id)} className="opacity-70">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  return context ?? { showToast: () => undefined };
}
