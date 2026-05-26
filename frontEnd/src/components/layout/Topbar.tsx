import { Bell, Menu, Moon, Sun } from "lucide-react";
import type { NavItem } from "../../config/navigation";

interface TopbarProps {
  currentNav: NavItem;
  dark: boolean;
  onOpenSidebar: () => void;
  onToggleTheme: () => void;
}

export function Topbar({ currentNav, dark, onOpenSidebar, onToggleTheme }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl lg:px-6">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3">
        <button
          className="rounded-xl border border-border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:text-foreground lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Ouvrir le menu"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{currentNav.label}</h1>
            <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-primary sm:inline-flex">
              Live
            </span>
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground sm:text-[11px]">
            {currentNav.description}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[10px] font-semibold text-emerald-400">MIKROTIK OK</span>
          </div>

          <button
            onClick={onToggleTheme}
            title={dark ? "Mode clair" : "Mode sombre"}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground">
            <Bell size={16} />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-400 ring-2 ring-card" />
          </button>
        </div>
      </div>
    </header>
  );
}
