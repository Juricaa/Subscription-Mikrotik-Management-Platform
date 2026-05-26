import type { CSSProperties, ElementType, ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, cx } from "./primitives";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  delay = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ElementType;
  color: string;
  delay?: number;
}) {
  return (
    <Card className="animate-soft-in hover-lift p-4" style={{ animationDelay: `${delay}ms` } as CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", color)}>
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
        {sub && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </Card>
  );
}

export function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}) {
  const styles = {
    default: "bg-muted text-muted-foreground border-border",
    success: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    warning: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    error: "bg-red-400/10 text-red-400 border-red-400/20",
    info: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[9px] font-semibold", styles[variant], className)}>
      {children}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={99} className="px-4 py-14 text-center font-mono text-xs text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

export function SortableTH<T extends string>({
  col,
  sortCol,
  sortAsc,
  onSort,
  children,
}: {
  col: T;
  sortCol: T;
  sortAsc: boolean;
  onSort: (c: T) => void;
  children: ReactNode;
}) {
  return (
    <th
      onClick={() => onSort(col)}
      className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground cursor-pointer select-none transition-colors hover:text-foreground"
    >
      <div className="flex items-center gap-1.5">
        {children}
        {sortCol === col ? sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} /> : null}
      </div>
    </th>
  );
}

export function TableCard({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="thin-scrollbar overflow-x-auto">{children}</div>
      {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </Card>
  );
}
