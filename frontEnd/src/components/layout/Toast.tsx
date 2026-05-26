import { CheckCircle, XCircle } from "lucide-react";

export function Toast({ msg, type }: { msg: string; type: "ok" | "err" }) {
  const Icon = type === "ok" ? CheckCircle : XCircle;

  return (
    <div
      className={`toast-enter fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 font-mono text-xs shadow-2xl backdrop-blur-xl sm:left-auto sm:right-5 sm:mx-0 ${
        type === "ok"
          ? "border-emerald-400/25 bg-card/95 text-emerald-400"
          : "border-red-400/25 bg-card/95 text-red-400"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon size={15} />
      </span>
      <span className="leading-relaxed">{msg}</span>
    </div>
  );
}
