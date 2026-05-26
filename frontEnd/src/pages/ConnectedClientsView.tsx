import { useState } from "react";
import { AlertTriangle, CheckCircle, EthernetPort, Plus, RefreshCw, Wifi } from "lucide-react";
import { SubForm } from "../components/SubForm";
import { Badge, Button, Card, FilterTabs, PageIntro, SearchInput } from "../components/ui";
import { MOCK_CONNECTED } from "../data/mockData";
import { fmtBytes } from "../types";
import type { ConnectedDevice, Subscription } from "../types";

interface ConnectedClientsViewProps {
  onCreateSub: (data: Partial<Subscription>) => void;
  subscribedMacs: Set<string>;
}

function SignalBars({ dbm }: { dbm: number | null }) {
  if (dbm === null) return <span className="font-mono text-[10px] text-muted-foreground">— câble</span>;
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

export default function ConnectedClientsView({ onCreateSub, subscribedMacs }: ConnectedClientsViewProps) {
  const [devices] = useState<ConnectedDevice[]>(MOCK_CONNECTED);
  const [search, setSearch] = useState("");
  const [filterIface, setFilterIface] = useState<"all" | "wifi" | "ethernet">("all");
  const [filterSub, setFilterSub] = useState<"all" | "subscribed" | "unsubscribed">("all");
  const [prefill, setPrefill] = useState<{ mac: string; ip: string } | null>(null);

  const filtered = devices.filter((device) => {
    const q = search.toLowerCase();
    const matchQ =
      device.mac.toLowerCase().includes(q) ||
      device.ip.includes(q) ||
      device.hostname.toLowerCase().includes(q) ||
      device.vendor.toLowerCase().includes(q);
    const matchIface =
      filterIface === "all" ||
      (filterIface === "wifi" && device.interface.startsWith("wlan")) ||
      (filterIface === "ethernet" && device.interface.startsWith("ether"));
    const hasSub = subscribedMacs.has(device.mac);
    const matchSub =
      filterSub === "all" ||
      (filterSub === "subscribed" && hasSub) ||
      (filterSub === "unsubscribed" && !hasSub);

    return matchQ && matchIface && matchSub;
  });

  const unsubCount = devices.filter((device) => !subscribedMacs.has(device.mac)).length;

  return (
    <div className="flex flex-col gap-5">
      <PageIntro
        icon={Wifi}
        title="Appareils connectés au réseau"
        description={
          <>
            {devices.length} appareil(s) détecté(s) — <span className="text-amber-400">{unsubCount} sans abonnement</span>. Créez un bail DHCP et une Simple Queue depuis une carte client.
          </>
        }
        action={
          <Button variant="secondary" className="w-full sm:w-auto">
            <RefreshCw size={14} /> Actualiser
          </Button>
        }
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="MAC, IP, hostname, fabricant…"
          className="w-full xl:max-w-md"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:ml-auto">
          <FilterTabs
            value={filterIface}
            onChange={setFilterIface}
            options={[
              { value: "all", label: "Tous" },
              { value: "wifi", label: "Wi‑Fi" },
              { value: "ethernet", label: "Câble" },
            ]}
          />
          <FilterTabs
            value={filterSub}
            onChange={setFilterSub}
            options={[
              { value: "all", label: "Tous" },
              { value: "subscribed", label: "Abonnés" },
              { value: "unsubscribed", label: "Sans abo." },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {filtered.length === 0 && (
          <Card className="col-span-full py-14 text-center font-mono text-xs text-muted-foreground">
            Aucun appareil trouvé
          </Card>
        )}

        {filtered.map((device, index) => {
          const hasSub = subscribedMacs.has(device.mac);
          const isWifi = device.interface.startsWith("wlan");
          const Icon = isWifi ? Wifi : EthernetPort;

          return (
            <Card
              key={device.mac}
              className={`animate-soft-in hover-lift flex flex-col gap-4 p-4 ${hasSub ? "" : "border-amber-400/30"}`}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${hasSub ? "bg-emerald-400/10" : "bg-amber-400/10"}`}>
                    <Icon size={18} className={hasSub ? "text-emerald-400" : "text-amber-400"} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{device.hostname}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{device.vendor}</div>
                  </div>
                </div>
                {hasSub ? (
                  <Badge variant="success"><CheckCircle size={10} /> Abonné</Badge>
                ) : (
                  <Badge variant="warning"><AlertTriangle size={10} /> Non abonné</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-muted/45 p-3">
                <div>
                  <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">IP</div>
                  <div className="font-mono text-xs font-semibold text-foreground">{device.ip}</div>
                </div>
                <div>
                  <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Interface</div>
                  <div className="font-mono text-xs font-semibold text-foreground">{device.interface}</div>
                </div>
                <div className="col-span-2 min-w-0">
                  <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Adresse MAC</div>
                  <div className="truncate font-mono text-xs font-semibold tracking-wide text-primary">{device.mac}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <SignalBars dbm={device.signalDbm} />
                <div className="font-mono text-[10px]">
                  <span className="text-emerald-400">↓{fmtBytes(device.rxBytes)}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="text-blue-400">↑{fmtBytes(device.txBytes)}</span>
                </div>
              </div>

              <div className="font-mono text-[10px] text-muted-foreground">
                Connecté depuis: <span className="text-foreground">{device.connectedSince}</span>
              </div>

              <div className="mt-auto border-t border-border pt-4">
                {hasSub ? (
                  <div className="flex items-center gap-2 font-mono text-[10px] text-emerald-400">
                    <CheckCircle size={12} /> Abonnement actif sur ce dispositif
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => setPrefill({ mac: device.mac, ip: device.ip })}
                    className="w-full"
                  >
                    <Plus size={14} /> Créer abonnement
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
          onSave={(data) => {
            onCreateSub(data);
            setPrefill(null);
          }}
          onClose={() => setPrefill(null)}
        />
      )}
    </div>
  );
}
