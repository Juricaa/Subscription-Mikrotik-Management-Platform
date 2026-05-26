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
import { Card, SectionHeader, StatCard } from "../components/ui";
import { MOCK_LOGS, PLAN_DATA, TRAFFIC_DATA } from "../data/mockData";
import { fmtBytes } from "../types";
import type { Subscription } from "../types";

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-popover/95 px-3 py-2 font-mono text-[10px] shadow-xl backdrop-blur-xl">
      <div className="mb-1 text-muted-foreground">{label}</div>
      {payload.map((point: any) => (
        <div key={point.dataKey} style={{ color: point.color }}>
          {point.name}: {point.value} Mbps
        </div>
      ))}
    </div>
  );
};

interface DashboardViewProps {
  subs: Subscription[];
}

export default function DashboardView({ subs }: DashboardViewProps) {
  const active = subs.filter((sub) => sub.status === "active").length;
  const suspended = subs.filter((sub) => sub.status === "suspended").length;
  const expired = subs.filter((sub) => sub.status === "expired").length;
  const totalIn = subs.reduce((sum, sub) => sum + sub.bytesIn, 0);
  const totalOut = subs.reduce((sum, sub) => sum + sub.bytesOut, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Abonnés actifs" value={active} sub={`sur ${subs.length} total`} icon={CheckCircle} color="bg-emerald-400/10 text-emerald-400" delay={0} />
        <StatCard label="Suspendus" value={suspended} sub="en attente paiement" icon={Pause} color="bg-amber-400/10 text-amber-400" delay={40} />
        <StatCard label="Expirés" value={expired} sub="à renouveler" icon={AlertTriangle} color="bg-red-400/10 text-red-400" delay={80} />
        <StatCard label="Trafic total ↓" value={fmtBytes(totalIn)} sub={`↑ ${fmtBytes(totalOut)}`} icon={TrendingUp} color="bg-primary/10 text-primary" delay={120} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="hover-lift xl:col-span-2">
          <SectionHeader
            title="Trafic 24h (Mbps)"
            subtitle="Courbes légères, optimisées pour une lecture rapide."
            action={<span className="font-mono text-[10px] text-muted-foreground">{new Date().toLocaleDateString("fr-FR")}</span>}
          />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={TRAFFIC_DATA} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
                <XAxis dataKey="t" tick={{ fill: "#6e7a8a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6e7a8a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="in" name="↓ Download" stroke="#00d4aa" strokeWidth={2} fill="url(#gradIn)" />
                <Area type="monotone" dataKey="out" name="↑ Upload" stroke="#3b9eff" strokeWidth={2} fill="url(#gradOut)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-[#00d4aa]" /><span className="font-mono text-[10px] text-muted-foreground">Download</span></div>
              <div className="flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-[#3b9eff]" /><span className="font-mono text-[10px] text-muted-foreground">Upload</span></div>
            </div>
          </div>
        </Card>

        <Card className="hover-lift">
          <SectionHeader title="Répartition plans" subtitle="Nombre de clients par débit." />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={PLAN_DATA} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="plan" tick={{ fill: "#6e7a8a", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6e7a8a", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Clients" fill="#00d4aa" radius={[12, 12, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <SectionHeader title="Activité récente" subtitle="Dernières opérations appliquées au routeur." />
        <div className="divide-y divide-border">
          {MOCK_LOGS.slice(0, 6).map((log, index) => (
            <div
              key={log.id}
              className="animate-soft-in grid grid-cols-[auto_1fr] gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[auto_9rem_7rem_1fr_auto] sm:items-center"
              style={{ animationDelay: `${index * 35}ms` }}
            >
              <span className={`mt-1.5 h-2 w-2 rounded-full sm:mt-0 ${log.result === "success" ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">{log.timestamp}</span>
              <span className="font-mono text-[10px] font-semibold text-primary">{log.action}</span>
              <span className="min-w-0 truncate font-mono text-[10px] text-foreground">{log.detail}</span>
              <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">{log.operator}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
