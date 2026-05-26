import { CheckCircle, LogOut, Wifi } from "lucide-react";
import { NAV_ITEMS } from "../../config/navigation";
import type { View } from "../../types";

interface SidebarProps {
  activeView: View;
  open: boolean;
  subscriptionsCount: number;
  activeCount: number;
  onNavigate: (view: View) => void;
}

export function Sidebar({ activeView, open, subscriptionsCount, activeCount, onNavigate }: SidebarProps) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-[18rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar/95 shadow-2xl shadow-black/10 backdrop-blur-xl transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:translate-x-0 lg:shadow-none ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
          <Wifi size={18} className="text-primary" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-sidebar bg-emerald-400" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight text-sidebar-foreground">NetAdmin</div>
          <div className="font-mono text-[10px] text-muted-foreground">Gestion MikroTik ISP</div>
        </div>
      </div>

      <nav className="thin-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`group flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  isActive ? "bg-white/15" : "bg-muted/70 group-hover:bg-background/80"
                }`}
              >
                <Icon size={17} />
              </span>
              <span className="flex-1 truncate font-medium">{label}</span>
              {id === "subscriptions" && (
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                    isActive ? "bg-white/15 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {subscriptionsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-4 pb-4">
        <div className="rounded-2xl border border-border bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[10px] text-muted-foreground">Routeur synchronisé</span>
            <CheckCircle size={12} className="ml-auto text-emerald-400" />
          </div>
          <div className="mt-2 text-sm font-semibold text-foreground">{activeCount} actif(s)</div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-sidebar-border px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <span className="font-mono text-xs font-bold">AD</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-sidebar-foreground">Admin</div>
          <div className="truncate font-mono text-[10px] text-muted-foreground">admin@monreseau.bf</div>
        </div>
        <button className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Déconnexion">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
