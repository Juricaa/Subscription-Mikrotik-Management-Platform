import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, EthernetPort, Plus, RefreshCw, Wifi } from "lucide-react";
import { SubForm } from "../components/SubForm";
import { Badge, Button, Card, FilterTabs, PageIntro, SearchInput } from "../components/ui";
import { fmtBytes } from "../types";
import type { ConnectedDevice, SubscriptionDraft } from "../types";
import { getConnectedDeviceAccessKind, isWifiDevice } from "../utils/connectedDevice";

interface ConnectedClientsViewProps {
  devices: ConnectedDevice[];
  sources?: Record<string, number>;
  warnings?: string[];
  syncedAt?: string;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void | Promise<void>;
  onCreateSub: (data: SubscriptionDraft) => void | Promise<void>;
  subscribedMacs: Set<string>;
}

function normalizeMac(value: string): string {
  return value.trim().toUpperCase();
}

function SignalBars({ dbm }: { dbm: number | null }) {
  if (dbm === null) return <span className="font-mono text-[10px] text-muted-foreground">- cable/routeur</span>;
  const strength = dbm >= -55 ? 4 : dbm >= -65 ? 3 : dbm >= -75 ? 2 : 1;

  return (
    <div className="flex items-end gap-1" title={`${dbm} dBm`}>
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={`w-1 rounded-full transition-colors ${bar <= strength ? "bg-primary" : "bg-muted-foreground/20"}`}
          style={{ height: `${5 + bar * 3}px` }}
        />
      ))}
      <span className="ml-1 font-mono text-[10px] text-muted-foreground">{dbm} dBm</span>
    </div>
  );
}

export default function ConnectedClientsView({
  devices,
  sources = {},
  warnings = [],
  syncedAt = "",
  loading = false,
  error = null,
  onRefresh,
  onCreateSub,
  subscribedMacs,
}: ConnectedClientsViewProps) {
  const [search, setSearch] = useState("");
  const [filterIface, setFilterIface] = useState<"all" | "wifi" | "ethernet">("all");
  const [filterSub, setFilterSub] = useState<"all" | "subscribed" | "unsubscribed">("all");
  const [prefill, setPrefill] = useState<{ mac: string; ip: string; clientName?: string; comment?: string } | null>(null);

  const filtered = useMemo(
    () =>
      devices.filter((device) => {
        const q = search.toLowerCase();
        const matchQ =
          device.mac.toLowerCase().includes(q) ||
          device.ip.includes(q) ||
          device.hostname.toLowerCase().includes(q) ||
          device.vendor.toLowerCase().includes(q) ||
          (device.clientName || "").toLowerCase().includes(q);
        const accessKind = getConnectedDeviceAccessKind(device);
        const matchIface =
          filterIface === "all" ||
          (filterIface === "wifi" && accessKind === "wifi") ||
          (filterIface === "ethernet" && accessKind === "ethernet");
        const hasSub = device.hasSubscription || subscribedMacs.has(normalizeMac(device.mac));
        const matchSub =
          filterSub === "all" ||
          (filterSub === "subscribed" && hasSub) ||
          (filterSub === "unsubscribed" && !hasSub);

        return matchQ && matchIface && matchSub;
      }),
    [devices, filterIface, filterSub, search, subscribedMacs],
  );

  const unsubCount = devices.filter((device) => !(device.hasSubscription || subscribedMacs.has(normalizeMac(device.mac)))).length;
  const activeSources = Object.entries(sources).filter(([, value]) => value > 0);

  return (
    <div className="flex flex-col gap-5">
      <PageIntro
        icon={Wifi}
        title="Clients connectes reels MikroTik"
        description={
          <>
            {devices.length} appareil(s) lu(s) depuis RouterOS - <span className="text-amber-400">{unsubCount} sans abonnement</span>.
            {syncedAt && <span className="ml-1 text-muted-foreground">Derniere synchro : {syncedAt}</span>}
          </>
        }
        action={
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void onRefresh?.()} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualiser reel
          </Button>
        }
      />

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300">
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-mono text-[11px] leading-relaxed text-amber-300">
          Certaines tables RouterOS sont indisponibles sur ce routeur ou paquet : {warnings.slice(0, 3).join(" | ")}
          {warnings.length > 3 ? ` | +${warnings.length - 3} autres` : ""}
        </div>
      )}

      {activeSources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeSources.map(([key, value]) => (
            <Badge key={key} variant="default">
              {key}: {value}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher MAC, IP, nom, source..."
          className="w-full xl:max-w-md"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:ml-auto">
          <FilterTabs
            value={filterIface}
            onChange={setFilterIface}
            options={[
              { value: "all", label: "Toutes interfaces" },
              { value: "wifi", label: "WiFi" },
              { value: "ethernet", label: "RJ45 / LAN" },
            ]}
          />
          <FilterTabs
            value={filterSub}
            onChange={setFilterSub}
            options={[
              { value: "all", label: "Tous" },
              { value: "subscribed", label: "Abonnes" },
              { value: "unsubscribed", label: "Sans abonnement" },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {!loading && filtered.length === 0 && (
          <div className="lg:col-span-2 2xl:col-span-3 rounded-2xl border border-border bg-card/80 px-4 py-12 text-center font-mono text-xs text-muted-foreground">
            Aucun client reel trouve sur MikroTik. Verifiez les tables WiFi, Hotspot, DHCP/ARP ou cliquez sur Actualiser.
          </div>
        )}

        {filtered.map((device, index) => {
          const hasSub = device.hasSubscription || subscribedMacs.has(normalizeMac(device.mac));
          const accessKind = getConnectedDeviceAccessKind(device);
          const isWireless = isWifiDevice(device);
          const isEthernet = accessKind === "ethernet";
          const quotaPercent = device.quotaLimitBytes ? Math.min(100, Math.round(((device.quotaUsageBytes || 0) / device.quotaLimitBytes) * 100)) : 0;

          return (
            <Card key={`${device.mac}-${device.ip}`} className="group flex min-h-[310px] flex-col gap-4 p-4 hover-lift" style={{ animationDelay: `${index * 25}ms` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      isWireless ? "bg-primary/10 text-primary" : isEthernet ? "bg-amber-400/10 text-amber-400" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isWireless ? <Wifi size={19} /> : isEthernet ? <EthernetPort size={19} /> : <AlertTriangle size={19} />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{device.clientName || device.hostname}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">source: {device.vendor}</div>
                    {device.sourceDetails && device.sourceDetails !== device.vendor && (
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">details: {device.sourceDetails}</div>
                    )}
                    {accessKind === "wifi" && <div className="mt-0.5 font-mono text-[10px] text-primary">acces: utilisateur reellement en WiFi</div>}
                    {accessKind === "ethernet" && <div className="mt-0.5 font-mono text-[10px] text-amber-400">acces: utilisateur reellement en RJ45</div>}
                    {accessKind === "unknown" && <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">acces: type non confirme</div>}
                  </div>
                </div>
                {hasSub ? (
                  <Badge variant={device.dataLimitReached ? "error" : "success"}>
                    <CheckCircle size={10} /> {device.dataLimitReached ? "Quota atteint" : "Abonne"}
                  </Badge>
                ) : (
                  <Badge variant="warning">
                    <AlertTriangle size={10} /> Non abonne
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-muted/45 p-3">
                <div>
                  <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">IP</div>
                  <div className="font-mono text-xs font-semibold text-foreground">{device.ip || "-"}</div>
                </div>
                <div>
                  <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Interface</div>
                  <div className="font-mono text-xs font-semibold text-foreground">{device.interface || "-"}</div>
                </div>
                <div className="col-span-2 min-w-0">
                  <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Adresse MAC</div>
                  <div className="truncate font-mono text-xs font-semibold tracking-wide text-primary">{device.mac || "-"}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <SignalBars dbm={device.signalDbm} />
                <div className="font-mono text-[10px]">
                  <span className="text-emerald-400">Rx {fmtBytes(device.rxBytes)}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="text-blue-400">Tx {fmtBytes(device.txBytes)}</span>
                </div>
              </div>

              {hasSub && device.dataLimitEnabled && (device.quotaLimitBytes || 0) > 0 && (
                <div className="rounded-2xl border border-border bg-muted/35 p-3">
                  <div className="mb-1 flex justify-between font-mono text-[10px]">
                    <span className="text-muted-foreground">Quota reel</span>
                    <span className={quotaPercent >= 100 ? "text-red-400" : quotaPercent >= 85 ? "text-amber-400" : "text-primary"}>{quotaPercent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${quotaPercent >= 100 ? "bg-red-400" : quotaPercent >= 85 ? "bg-amber-400" : "bg-primary"}`} style={{ width: `${quotaPercent}%` }} />
                  </div>
                  <div className="mt-1 font-mono text-[9px] text-muted-foreground">
                    {fmtBytes(device.quotaUsageBytes || 0)} / {fmtBytes(device.quotaLimitBytes || 0)}
                  </div>
                </div>
              )}

              <div className="font-mono text-[10px] text-muted-foreground">
                Presence: <span className="text-foreground">{device.connectedSince}</span>
              </div>

              <div className="mt-auto border-t border-border pt-4">
                {hasSub ? (
                  <div className="flex items-center gap-2 font-mono text-[10px] text-emerald-400">
                    <CheckCircle size={12} /> Abonnement lie a ce dispositif
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() =>
                      setPrefill({
                        mac: device.mac,
                        ip: device.ip,
                        clientName: device.hostname && !device.hostname.toLowerCase().includes("client") ? device.hostname : "",
                        comment: `Cree depuis client reel MikroTik (${device.vendor})`,
                      })
                    }
                    className="w-full"
                  >
                    <Plus size={14} /> Creer abonnement
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {prefill && (
        <SubForm
          prefill={prefill}
          onSave={async (data) => {
            await onCreateSub(data);
            setPrefill(null);
          }}
          onClose={() => setPrefill(null)}
        />
      )}
    </div>
  );
}
