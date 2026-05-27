import { RefreshCw, Router } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, FormField, Input, PageIntro, SectionHeader } from "../components/ui";
import { fetchMikroTikSystemResource, getApiBaseUrl } from "../services/mikrotikApi";

function valueOf(result: Record<string, unknown> | undefined, key: string, fallback = "—"): string {
  const value = result?.[key];
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function formatMemory(result: Record<string, unknown> | undefined): string {
  const free = Number(result?.["free-memory"] ?? 0);
  const total = Number(result?.["total-memory"] ?? 0);
  if (!free || !total) return "—";
  const usedMb = (total - free) / 1024 / 1024;
  const totalMb = total / 1024 / 1024;
  return `${usedMb.toFixed(0)} / ${totalMb.toFixed(0)} MB`;
}

export default function RouterView() {
  const [result, setResult] = useState<Record<string, unknown> | undefined>();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchMikroTikSystemResource();
      setConnected(Boolean(response.ok));
      setResult(response.result || {});
    } catch (err) {
      setConnected(false);
      setResult(undefined);
      setError(err instanceof Error ? err.message : "Impossible de contacter le backend Django");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void testConnection();
  }, []);

  const metrics = [
    { label: "Backend Django", value: getApiBaseUrl() },
    { label: "État MikroTik", value: connected ? "Connecté" : "Déconnecté" },
    { label: "Version RouterOS", value: valueOf(result, "version") },
    { label: "Uptime", value: valueOf(result, "uptime") },
    { label: "CPU Load", value: `${valueOf(result, "cpu-load", "0")}%` },
    { label: "RAM utilisée", value: formatMemory(result) },
    { label: "Architecture", value: valueOf(result, "architecture-name") },
    { label: "Board", value: valueOf(result, "board-name") },
  ];

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageIntro
        icon={Router}
        tone={connected ? "success" : "warning"}
        title={connected ? "Connecté au routeur MikroTik" : "Routeur ou backend non connecté"}
        description="Le frontend communique avec Django via l’URL VITE_API_BASE_URL, puis Django contacte le routeur MikroTik REST API."
        action={
          <Button variant="secondary" className="w-full sm:w-auto" onClick={testConnection} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Tester connexion
          </Button>
        }
      />

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-300">
          {error}
        </div>
      )}

      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className="animate-soft-in rounded-2xl border border-border bg-muted/45 px-4 py-3"
              style={{ animationDelay: `${index * 25}ms` }}
            >
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{metric.label}</span>
              <div className="mt-1 break-words text-sm font-semibold text-foreground">{metric.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <SectionHeader title="Configuration API" subtitle="Toutes ces valeurs doivent venir du fichier .env global à la racine du projet." />
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <FormField label="URL backend Django utilisée par React">
                <Input value={getApiBaseUrl()} readOnly />
              </FormField>
            </div>
            <FormField label="Swagger backend">
              <Input value={`${getApiBaseUrl().replace(/\/$/, "")}/api/docs/`} readOnly />
            </FormField>
            <FormField label="OpenAPI schema">
              <Input value={`${getApiBaseUrl().replace(/\/$/, "")}/api/schema/`} readOnly />
            </FormField>
            <div className="md:col-span-2 rounded-2xl border border-border bg-muted/40 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
              Modifiez l’URL API dans <strong className="text-foreground">../.env</strong> avec <strong className="text-foreground">VITE_API_BASE_URL</strong>, puis redémarrez Vite.
              Les identifiants MikroTik restent uniquement côté Django dans le même fichier global.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
