import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, EthernetPort, MonitorSmartphone, Pause, RefreshCw, TrendingUp, Wifi } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge, Button, Card, FilterTabs, SectionHeader, StatCard } from "../components/ui";
import { fetchLogsFromDatabase } from "../services/mikrotikApi";
import { fmtBytes } from "../types";
import type { ConnectedDevice, LogEntry, Subscription } from "../types";
import { getConnectedDeviceAccessKind, getConnectedDeviceAccessLabel, getConnectedDeviceName, getConnectedDeviceTraffic } from "../utils/connectedDevice";

const UsageTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-popover/95 px-3 py-2 font-mono text-[10px] shadow-xl backdrop-blur-xl">
      <div className="mb-1 text-muted-foreground">{label}</div>
      {payload.map((point: any) => (
        <div key={point.dataKey} style={{ color: point.color }}>
          {point.name}: {fmtBytes(Number(point.value || 0))}
        </div>
      ))}
    </div>
  );
};

interface DashboardViewProps {
  subs: Subscription[];
  connectedClients: ConnectedDevice[];
  connectedClientsLoading?: boolean;
  connectedClientsError?: string | null;
  connectedClientsSyncedAt?: string;
  onRefreshClients?: () => void | Promise<void>;
}

export default function DashboardView({
  subs,
  connectedClients,
  connectedClientsLoading = false,
  connectedClientsError = null,
  connectedClientsSyncedAt = "",
  onRefreshClients,
}: DashboardViewProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clientFilter, setClientFilter] = useState<"all" | "wifi" | "ethernet">("all");

  useEffect(() => {
    fetchLogsFromDatabase()
      .then((items) => setLogs(items.slice(0, 6)))
      .catch(() => setLogs([]));
  }, []);

  const active = subs.filter((sub) => sub.status === "active").length;
  const suspended = subs.filter((sub) => sub.status === "suspended").length;
  const expired = subs.filter((sub) => sub.status === "expired").length;
  const totalIn = subs.reduce((sum, sub) => sum + sub.bytesIn, 0);
  const totalOut = subs.reduce((sum, sub) => sum + sub.bytesOut, 0);

  const wifiCount = connectedClients.filter((device) => getConnectedDeviceAccessKind(device) === "wifi").length;
  const ethernetCount = connectedClients.filter((device) => getConnectedDeviceAccessKind(device) === "ethernet").length;
  const unsubscribedConnectedCount = connectedClients.filter((device) => !device.hasSubscription).length;

  const usageData = useMemo(() => {
    return [...subs]
      .sort((a, b) => b.bytesIn + b.bytesOut - (a.bytesIn + a.bytesOut))
      .slice(0, 8)
      .map((sub) => ({
        client: sub.clientName.length > 12 ? `${sub.clientName.slice(0, 12)}...` : sub.clientName,
        download: sub.bytesIn,
        upload: sub.bytesOut,
      }));
  }, [subs]);

  const planData = useMemo(() => {
    const counts = subs.reduce<Record<string, number>>((acc, sub) => {
      acc[sub.rateLimit] = (acc[sub.rateLimit] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([plan, count]) => ({ plan, count }));
  }, [subs]);

  const filteredConnectedClients = useMemo(() => {
    return [...connectedClients]
      .filter((device) => {
        const accessKind = getConnectedDeviceAccessKind(device);
        if (clientFilter === "wifi") return accessKind === "wifi";
        if (clientFilter === "ethernet") return accessKind === "ethernet";
        return true;
      })
      .sort((left, right) => {
        const trafficDiff = getConnectedDeviceTraffic(right) - getConnectedDeviceTraffic(left);
        if (trafficDiff !== 0) return trafficDiff;
        return getConnectedDeviceName(left).localeCompare(getConnectedDeviceName(right), "fr");
      });
  }, [clientFilter, connectedClients]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Abonnes actifs" value={active} sub={`sur ${subs.length} total`} icon={CheckCircle} color="bg-emerald-400/10 text-emerald-400" delay={0} />
        <StatCard label="Suspendus" value={suspended} sub="depuis MySQL" icon={Pause} color="bg-amber-400/10 text-amber-400" delay={40} />
        <StatCard label="Expires" value={expired} sub="a renouveler" icon={AlertTriangle} color="bg-red-400/10 text-red-400" delay={80} />
        <StatCard label="Trafic reel total" value={fmtBytes(totalIn)} sub={`Upload ${fmtBytes(totalOut)}`} icon={TrendingUp} color="bg-primary/10 text-primary" delay={120} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Utilisateurs en ligne" value={connectedClients.length} sub={connectedClientsSyncedAt || "synchro en attente"} icon={MonitorSmartphone} color="bg-sky-400/10 text-sky-400" delay={0} />
        <StatCard label="Connectes en WiFi" value={wifiCount} sub="detection temps reel" icon={Wifi} color="bg-primary/10 text-primary" delay={40} />
        <StatCard label="Connectes en RJ45" value={ethernetCount} sub="ports LAN / ether" icon={EthernetPort} color="bg-amber-400/10 text-amber-400" delay={80} />
        <StatCard label="Sans abonnement" value={unsubscribedConnectedCount} sub="a verifier" icon={AlertTriangle} color="bg-red-400/10 text-red-400" delay={120} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="hover-lift xl:col-span-2">
          <SectionHeader
            title="Consommation reelle par client"
            subtitle="Compteurs synchronises depuis les Simple Queues / sessions RouterOS."
            action={<span className="font-mono text-[10px] text-muted-foreground">{new Date().toLocaleDateString("fr-FR")}</span>}
          />
          <div className="p-4">
            {usageData.length === 0 ? (
              <div className="rounded-2xl border border-border bg-muted/35 px-4 py-12 text-center font-mono text-xs text-muted-foreground">Aucune consommation reelle synchronisee.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={usageData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b9eff" stopOpacity={0.24} />
                      <stop offset="95%" stopColor="#3b9eff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis dataKey="client" tick={{ fill: "#6e7a8a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(value) => fmtBytes(Number(value)).replace(" ", "")} tick={{ fill: "#6e7a8a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<UsageTooltip />} />
                  <Area type="monotone" dataKey="download" name="Download" stroke="#00d4aa" strokeWidth={2} fill="url(#gradIn)" />
                  <Area type="monotone" dataKey="upload" name="Upload" stroke="#3b9eff" strokeWidth={2} fill="url(#gradOut)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="h-1 w-5 rounded-full bg-[#00d4aa]" />
                <span className="font-mono text-[10px] text-muted-foreground">Download reel</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1 w-5 rounded-full bg-[#3b9eff]" />
                <span className="font-mono text-[10px] text-muted-foreground">Upload reel</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="hover-lift">
          <SectionHeader title="Repartition plans" subtitle="Nombre reel d abonnements par debit." />
          <div className="p-4">
            {planData.length === 0 ? (
              <div className="rounded-2xl border border-border bg-muted/35 px-4 py-12 text-center font-mono text-xs text-muted-foreground">Aucun abonnement en base.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={planData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                  <XAxis dataKey="plan" tick={{ fill: "#6e7a8a", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6e7a8a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Clients" fill="#00d4aa" radius={[12, 12, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <SectionHeader
          title="Utilisateurs reels en ligne"
          subtitle={
            <span>
              Liste actuelle des utilisateurs detectes sur MikroTik avec distinction WiFi / RJ45.
              {connectedClientsSyncedAt ? ` Derniere synchro : ${connectedClientsSyncedAt}.` : ""}
            </span>
          }
          action={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <FilterTabs
                value={clientFilter}
                onChange={setClientFilter}
                options={[
                  { value: "all", label: "Tous" },
                  { value: "wifi", label: "WiFi" },
                  { value: "ethernet", label: "RJ45" },
                ]}
              />
              <Button variant="secondary" onClick={() => void onRefreshClients?.()} disabled={connectedClientsLoading}>
                <RefreshCw size={14} className={connectedClientsLoading ? "animate-spin" : ""} /> Actualiser
              </Button>
            </div>
          }
        />

        {connectedClientsError && (
          <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 font-mono text-[11px] text-red-300">
            {connectedClientsError}
          </div>
        )}

        {!connectedClientsError && connectedClientsLoading && connectedClients.length === 0 && (
          <div className="px-4 py-12 text-center font-mono text-xs text-muted-foreground">Lecture des clients connectes en cours...</div>
        )}

        {!connectedClientsLoading && filteredConnectedClients.length === 0 && (
          <div className="px-4 py-12 text-center font-mono text-xs text-muted-foreground">
            Aucun utilisateur reel ne correspond au filtre selectionne.
          </div>
        )}

        {filteredConnectedClients.length > 0 && (
          <div className="thin-scrollbar max-h-[440px] overflow-y-auto divide-y divide-border">
            {filteredConnectedClients.map((device) => {
              const accessKind = getConnectedDeviceAccessKind(device);
              const accessLabel = getConnectedDeviceAccessLabel(device);
              const name = getConnectedDeviceName(device);
              const traffic = getConnectedDeviceTraffic(device);

              return (
                <div
                  key={`${device.mac || "nomac"}-${device.ip || "noip"}`}
                  className="grid grid-cols-[auto_1fr] gap-3 px-4 py-3 transition-colors hover:bg-muted/35 sm:grid-cols-[auto_minmax(0,1fr)_9rem_10rem_auto]"
                >
                  <div
                    className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${
                      accessKind === "wifi" ? "bg-primary/10 text-primary" : accessKind === "ethernet" ? "bg-amber-400/10 text-amber-400" : "bg-muted text-muted-foreground"
                    } sm:mt-0`}
                  >
                    {accessKind === "wifi" ? <Wifi size={18} /> : accessKind === "ethernet" ? <EthernetPort size={18} /> : <MonitorSmartphone size={18} />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{name}</span>
                      <Badge variant={accessKind === "wifi" ? "info" : accessKind === "ethernet" ? "warning" : "default"}>{accessLabel}</Badge>
                      <Badge variant={device.hasSubscription ? "success" : "error"}>{device.hasSubscription ? "Abonne" : "Sans abonnement"}</Badge>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      IP {device.ip || "-"} | MAC {device.mac || "-"}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      Interface {device.interface || "-"} | Presence {device.connectedSince || "-"}
                    </div>
                  </div>

                  <div className="hidden font-mono text-[10px] text-muted-foreground sm:block">
                    <div className="font-semibold text-foreground">{device.source || "routeros"}</div>
                    <div className="mt-1 truncate">{device.sourceDetails || "-"}</div>
                  </div>

                  <div className="font-mono text-[10px] text-muted-foreground">
                    <div className="text-emerald-400">Rx {fmtBytes(device.rxBytes)}</div>
                    <div className="text-blue-400">Tx {fmtBytes(device.txBytes)}</div>
                    <div className="mt-1 text-foreground">Total {fmtBytes(traffic)}</div>
                  </div>

                  <div className="flex items-start justify-end">
                    {device.dataLimitReached ? (
                      <Badge variant="error">Quota atteint</Badge>
                    ) : device.hasSubscription ? (
                      <Badge variant="success">Autorise</Badge>
                    ) : (
                      <Badge variant="warning">A traiter</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <SectionHeader title="Activite recente reelle" subtitle="Dernieres operations enregistrees par Django / MySQL." />
        <div className="divide-y divide-border">
          {logs.length === 0 && <div className="px-4 py-12 text-center font-mono text-xs text-muted-foreground">Aucun log reel enregistre.</div>}
          {logs.map((log, index) => (
            <div
              key={log.id}
              className="animate-soft-in grid grid-cols-[auto_1fr] gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[auto_9rem_7rem_1fr_auto] sm:items-center"
              style={{ animationDelay: `${index * 35}ms` }}
            >
              <span className={`mt-1.5 h-2 w-2 rounded-full sm:mt-0 ${log.result === "success" ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">{log.timestamp}</span>
              <span className="font-mono text-[10px] font-semibold text-primary">{log.action}</span>
              <span className="min-w-0 truncate font-mono text-[10px] text-foreground">{log.detail}</span>
              <Badge variant={log.result === "success" ? "success" : "error"}>{log.result === "success" ? "OK" : "ERREUR"}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
