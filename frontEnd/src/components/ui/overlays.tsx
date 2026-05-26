import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "./primitives";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, wide = false }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cx(
          "modal-enter relative w-full overflow-hidden rounded-3xl border border-border bg-card shadow-2xl",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-primary">{title}</span>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <div className="thin-scrollbar max-h-[80vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
