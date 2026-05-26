import type { ButtonHTMLAttributes, ElementType, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Search } from "lucide-react";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const baseFocus = "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50";

export function Card({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl border border-border bg-card/90 shadow-sm backdrop-blur-sm", className)} {...props}>
      {children}
    </div>
  );
}

export function Button({
  children,
  className = "",
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = {
    primary: "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/15 hover:opacity-95",
    secondary: "border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground",
    ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
    danger: "border-red-400/20 bg-red-400/10 text-red-400 hover:bg-red-400 hover:text-white",
  };

  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-95",
        className,
      )}
      {...props}
    />
  );
}

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full rounded-xl border border-border bg-muted/80 px-3 py-2.5 font-mono text-xs text-foreground transition-all placeholder:text-muted-foreground/50",
        baseFocus,
        className,
      )}
      {...props}
    />
  );
}

export function Select({ children, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "w-full appearance-none rounded-xl border border-border bg-muted/80 px-3 py-2.5 font-mono text-xs text-foreground transition-all",
        baseFocus,
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function SearchInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cx("relative min-w-0 flex-1", className)}>
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" {...props} />
    </div>
  );
}

export function FilterTabs<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-1 rounded-2xl border border-border bg-muted/70 p-1", className)}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cx(
              "rounded-xl px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest transition-all duration-200",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function PageIntro({
  icon: Icon,
  title,
  description,
  action,
  tone = "primary",
}: {
  icon: ElementType;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  tone?: "primary" | "warning" | "success";
}) {
  const tones = {
    primary: "border-primary/20 bg-primary/[0.07] text-primary",
    warning: "border-amber-400/25 bg-amber-400/[0.07] text-amber-400",
    success: "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-400",
  };

  return (
    <div className={cx("page-enter flex flex-col gap-4 rounded-3xl border p-4 sm:flex-row sm:items-center", tones[tone])}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card/80 shadow-sm">
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">{description}</div>
      </div>
      {action && <div className="shrink-0 sm:ml-auto">{action}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
        {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
