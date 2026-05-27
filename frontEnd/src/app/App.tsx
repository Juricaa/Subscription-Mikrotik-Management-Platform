import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Sidebar } from "../components/layout/Sidebar";
import { Toast } from "../components/layout/Toast";
import { Topbar } from "../components/layout/Topbar";
import { getNavItem } from "../config/navigation";
import { MOCK_SUBS } from "../data/mockData";
import { applySubscriptionOnRouter, deleteSubscriptionFromDatabase, fetchSubscriptionsFromDatabase, resetSubscriptionQuotaOnRouter, saveSubscriptionToDatabase } from "../services/mikrotikApi";
import { gbToBytes } from "../utils/mikrotikQuota";
import type { Subscription, SubscriptionDraft, SubscriptionRenewalPayload, View } from "../types";

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
    let alive = true;
    fetchSubscriptionsFromDatabase()
      .then((items) => {
        if (alive) {
          setSubs(items.length > 0 ? items : MOCK_SUBS);
        }
      })
      .catch(() => {
        if (alive) setSubs(MOCK_SUBS);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (msg: string, type: "ok" | "err" = "ok") => setToast({ msg, type });

  const buildFallbackSubscription = (data: SubscriptionDraft, id?: string, existing?: Subscription | null): Subscription => ({
    ...(existing || {}),
    id: id || existing?.id || `local-${Date.now()}`,
    clientName: data.clientName ?? existing?.clientName ?? "",
    mac: data.mac ?? existing?.mac ?? "",
    ip: data.ip ?? existing?.ip ?? "",
    rateLimit: data.rateLimit ?? existing?.rateLimit ?? "10M/5M",
    status: data.status ?? existing?.status ?? "active",
    expiresAt: data.expiresAt ?? existing?.expiresAt ?? "",
    comment: data.comment ?? existing?.comment ?? "",
    dataLimitEnabled: data.dataLimitEnabled ?? existing?.dataLimitEnabled ?? false,
    dataLimitGb: data.dataLimitGb ?? existing?.dataLimitGb ?? 0,
    dataLimitBytes: data.dataLimitBytes ?? existing?.dataLimitBytes ?? gbToBytes(data.dataLimitGb ?? existing?.dataLimitGb ?? 0),
    dataLimitCheckInterval: data.dataLimitCheckInterval ?? existing?.dataLimitCheckInterval ?? "5m",
    dataLimitAction: data.dataLimitAction ?? existing?.dataLimitAction ?? "firewall-block",
    dataLimitReached: data.dataLimitReached ?? existing?.dataLimitReached ?? false,
    bytesIn: data.bytesIn ?? existing?.bytesIn ?? 0,
    bytesOut: data.bytesOut ?? existing?.bytesOut ?? 0,
    lastSeen: data.lastSeen ?? existing?.lastSeen ?? "—",
  });

  const handleSaveSub = async (data: SubscriptionDraft, id?: string) => {
    const { applyToRouter = true, ...subscriptionData } = data;

    const existing = id ? subs.find((sub) => sub.id === id) : null;
    if (id && !existing) {
      notify("Abonnement introuvable", "err");
      throw new Error("Abonnement introuvable");
    }

    const fallbackTarget = buildFallbackSubscription(subscriptionData, id, existing);

    try {
      const saved = applyToRouter
        ? (await applySubscriptionOnRouter(id ? fallbackTarget : subscriptionData)).subscription ?? fallbackTarget
        : await saveSubscriptionToDatabase(subscriptionData, id);

      if (id) {
        setSubs((prev) => prev.map((sub) => (sub.id === id ? saved : sub)));
        notify(applyToRouter ? "Abonnement mis à jour dans MySQL + MikroTik" : "Abonnement mis à jour dans MySQL");
        return;
      }

      setSubs((prev) => [...prev, saved]);
      notify(
        applyToRouter
          ? saved.dataLimitEnabled
            ? "Abonnement créé dans MySQL + quota data appliqué sur MikroTik"
            : "Abonnement créé dans MySQL + Simple Queue appliquée sur MikroTik"
          : "Abonnement créé dans MySQL",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erreur backend Django/MikroTik", "err");
      throw error;
    }
  };

  const handleDeleteSub = async (id: string) => {
    try {
      await deleteSubscriptionFromDatabase(id);
      setSubs((prev) => prev.filter((sub) => sub.id !== id));
      notify("Abonnement supprimé de MySQL");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erreur suppression MySQL", "err");
    }
  };

  const handleToggleSub = async (id: string) => {
    const target = subs.find((sub) => sub.id === id);
    if (!target) return;
    const nextStatus = target.status === "active" ? "suspended" : "active";
    const optimistic = { ...target, status: nextStatus };
    setSubs((prev) => prev.map((sub) => (sub.id === id ? optimistic : sub)));

    try {
      const saved = await saveSubscriptionToDatabase({ status: nextStatus }, id);
      setSubs((prev) => prev.map((sub) => (sub.id === id ? saved : sub)));
      notify("Statut modifié dans MySQL");
    } catch (error) {
      setSubs((prev) => prev.map((sub) => (sub.id === id ? target : sub)));
      notify(error instanceof Error ? error.message : "Erreur changement statut", "err");
    }
  };


  const handleResetQuota = async (id: string, renewal: SubscriptionRenewalPayload) => {
    const target = subs.find((sub) => sub.id === id);
    if (!target) {
      notify("Abonnement introuvable", "err");
      return;
    }

    const renewedTarget: Subscription = {
      ...target,
      expiresAt: renewal.expiresAt || target.expiresAt,
      rateLimit: renewal.rateLimit || target.rateLimit,
      dataLimitEnabled: renewal.dataLimitEnabled,
      dataLimitGb: renewal.dataLimitGb,
      dataLimitBytes: renewal.dataLimitBytes,
      dataLimitCheckInterval: renewal.dataLimitCheckInterval || target.dataLimitCheckInterval,
      dataLimitReached: false,
      status: "active",
      bytesIn: 0,
      bytesOut: 0,
    };

    try {
      const response = await resetSubscriptionQuotaOnRouter(renewedTarget);
      setSubs((prev) =>
        prev.map((sub) =>
          sub.id === id
            ? response.subscription ?? {
                ...renewedTarget,
                lastSeen: new Date().toLocaleString("fr-FR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              }
            : sub,
        ),
      );
      notify("Quota remis à zéro, plan/quota renouvelés et MySQL + MikroTik mis à jour");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Erreur reset quota MikroTik", "err");
    }
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
                    onCreateSub={async (data) => {
                      await handleSaveSub(data);
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
                    onResetQuota={handleResetQuota}
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
