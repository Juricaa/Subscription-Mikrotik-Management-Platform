import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, Pause, TrendingUp } from "lucide-react";
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
import { Badge, Card, SectionHeader, StatCard } from "../components/ui";
import { fetchLogsFromDatabase } from "../services/mikrotikApi";
import { fmtBytes } from "../types";
import type { LogEntry, Subscription } from "../types";

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
}

export default function DashboardView({ subs }: DashboardViewProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

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

  const usageData = useMemo(() => {
    return [...subs]
      .sort((a, b) => b.bytesIn + b.bytesOut - (a.bytesIn + a.bytesOut))
      .slice(0, 8)
      .map((sub) => ({
        client: sub.clientName.length > 12 ? `${sub.clientName.slice(0, 12)}…` : sub.clientName,
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

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Abonnés actifs" value={active} sub={`sur ${subs.length} total`} icon={CheckCircle} color="bg-emerald-400/10 text-emerald-400" delay={0} />
        <StatCard label="Suspendus" value={suspended} sub="depuis MySQL" icon={Pause} color="bg-amber-400/10 text-amber-400" delay={40} />
        <StatCard label="Expirés" value={expired} sub="à renouveler" icon={AlertTriangle} color="bg-red-400/10 text-red-400" delay={80} />
        <StatCard label="Trafic réel total ↓" value={fmtBytes(totalIn)} sub={`↑ ${fmtBytes(totalOut)}`} icon={TrendingUp} color="bg-primary/10 text-primary" delay={120} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="hover-lift xl:col-span-2">
          <SectionHeader
            title="Consommation réelle par client"
            subtitle="Compteurs synchronisés depuis les Simple Queues / sessions RouterOS."
            action={<span className="font-mono text-[10px] text-muted-foreground">{new Date().toLocaleDateString("fr-FR")}</span>}
          />
          <div className="p-4">
            {usageData.length === 0 ? (
              <div className="rounded-2xl border border-border bg-muted/35 px-4 py-12 text-center font-mono text-xs text-muted-foreground">Aucune consommation réelle synchronisée.</div>
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
                  <Area type="monotone" dataKey="download" name="↓ Download" stroke="#00d4aa" strokeWidth={2} fill="url(#gradIn)" />
                  <Area type="monotone" dataKey="upload" name="↑ Upload" stroke="#3b9eff" strokeWidth={2} fill="url(#gradOut)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-[#00d4aa]" /><span className="font-mono text-[10px] text-muted-foreground">Download réel</span></div>
              <div className="flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-[#3b9eff]" /><span className="font-mono text-[10px] text-muted-foreground">Upload réel</span></div>
            </div>
          </div>
        </Card>

        <Card className="hover-lift">
          <SectionHeader title="Répartition plans" subtitle="Nombre réel d’abonnements par débit." />
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
        <SectionHeader title="Activité récente réelle" subtitle="Dernières opérations enregistrées par Django/MySQL." />
        <div className="divide-y divide-border">
          {logs.length === 0 && <div className="px-4 py-12 text-center font-mono text-xs text-muted-foreground">Aucun log réel enregistré.</div>}
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
