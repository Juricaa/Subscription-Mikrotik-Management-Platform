import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Sidebar } from "../components/layout/Sidebar";
import { Toast } from "../components/layout/Toast";
import { Topbar } from "../components/layout/Topbar";
import { getNavItem } from "../config/navigation";
import { MOCK_SUBS } from "../data/mockData";
import type { Subscription, View } from "../types";

const DashboardView = lazy(() => import("../pages/DashboardView"));
const SubscriptionsView = lazy(() => import("../pages/SubscriptionsView"));
const ConnectedClientsView = lazy(() => import("../pages/ConnectedClientsView"));
const LogsView = lazy(() => import("../pages/LogsView"));
const RouterView = lazy(() => import("../pages/RouterView"));
const SettingsView = lazy(() => import("../pages/SettingsView"));

function PageLoader() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-border bg-card/70">
      <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
        Chargement de la page…
      </div>
    </div>
  );
}


export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subs, setSubs] = useState<Subscription[]>(MOCK_SUBS);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (msg: string, type: "ok" | "err" = "ok") => setToast({ msg, type });

  const handleSaveSub = (data: Partial<Subscription>, id?: string) => {
    if (id) {
      setSubs((prev) => prev.map((sub) => (sub.id === id ? { ...sub, ...data } : sub)));
      notify("Abonnement mis à jour — MikroTik notifié");
      return;
    }

    const next: Subscription = {
      id: `s${Date.now()}`,
      clientName: data.clientName ?? "",
      mac: data.mac ?? "",
      ip: data.ip ?? "",
      rateLimit: data.rateLimit ?? "10M/5M",
      status: data.status ?? "active",
      expiresAt: data.expiresAt ?? "",
      comment: data.comment ?? "",
      bytesIn: 0,
      bytesOut: 0,
      lastSeen: "—",
    };

    setSubs((prev) => [...prev, next]);
    notify("Bail DHCP créé + Simple Queue ajoutée sur MikroTik");
  };

  const handleDeleteSub = (id: string) => {
    setSubs((prev) => prev.filter((sub) => sub.id !== id));
    notify("Bail DHCP et Queue supprimés du routeur");
  };

  const handleToggleSub = (id: string) => {
    setSubs((prev) =>
      prev.map((sub) =>
        sub.id === id
          ? { ...sub, status: sub.status === "active" ? "suspended" : "active" }
          : sub,
      ),
    );
    notify("Statut modifié — règle MikroTik appliquée");
  };

  const subscribedMacs = useMemo(() => new Set(subs.map((sub) => sub.mac)), [subs]);
  const activeCount = subs.filter((sub) => sub.status === "active").length;
  const currentNav = getNavItem(view);

  const goToView = (nextView: View) => {
    setView(nextView);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased" style={{ fontFamily: "'Inter', sans-serif" }}>
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] lg:hidden"
          aria-label="Fermer le menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-h-screen">
        <Sidebar
          activeView={view}
          open={sidebarOpen}
          subscriptionsCount={subs.length}
          activeCount={activeCount}
          onNavigate={goToView}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            currentNav={currentNav}
            dark={dark}
            onOpenSidebar={() => setSidebarOpen(true)}
            onToggleTheme={() => setDark((value) => !value)}
          />

          <main className="flex-1 overflow-auto px-4 py-4 sm:px-5 lg:px-6 lg:py-6">
            <div key={view} className="page-enter mx-auto w-full max-w-[1440px]">
              <Suspense fallback={<PageLoader />}>
                {view === "dashboard" && <DashboardView subs={subs} />}
                {view === "clients" && (
                  <ConnectedClientsView
                    onCreateSub={(data) => {
                      handleSaveSub(data);
                      setView("subscriptions");
                    }}
                    subscribedMacs={subscribedMacs}
                  />
                )}
                {view === "subscriptions" && (
                  <SubscriptionsView
                    subs={subs}
                    onSave={handleSaveSub}
                    onDelete={handleDeleteSub}
                    onToggle={handleToggleSub}
                  />
                )}
                {view === "router" && <RouterView />}
                {view === "logs" && <LogsView />}
                {view === "settings" && <SettingsView />}
              </Suspense>
            </div>
          </main>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
