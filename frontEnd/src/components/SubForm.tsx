import { useMemo, useState } from "react";
import { Copy, Database, ShieldAlert } from "lucide-react";
import { Button, FormField, Input, Modal, Select } from "./ui";
import { PLANS } from "../types";
import { buildQuotaScriptPreview, DEFAULT_QUOTA_GB, DEFAULT_QUOTA_INTERVAL, gbToBytes } from "../utils/mikrotikQuota";
import type { Plan, Status, Subscription } from "../types";

interface SubFormProps {
  initial?: Subscription | null;
  prefill?: { mac?: string; ip?: string };
  onSave: (data: Partial<Subscription>) => void;
  onClose: () => void;
}

type FormState = {
  clientName: string;
  mac: string;
  ip: string;
  rateLimit: Plan;
  expiresAt: string;
  comment: string;
  status: Status;
  dataLimitEnabled: boolean;
  dataLimitGb: string;
  dataLimitCheckInterval: string;
};

const quotaIntervals = ["1m", "5m", "10m", "30m", "1h"];

export function SubForm({ initial, prefill, onSave, onClose }: SubFormProps) {
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<FormState>({
    clientName: initial?.clientName ?? "",
    mac: initial?.mac ?? prefill?.mac ?? "",
    ip: initial?.ip ?? prefill?.ip ?? "",
    rateLimit: (initial?.rateLimit ?? "10M/5M") as Plan,
    expiresAt: initial?.expiresAt ?? "",
    comment: initial?.comment ?? "",
    status: (initial?.status ?? "active") as Status,
    dataLimitEnabled: initial?.dataLimitEnabled ?? false,
    dataLimitGb: String(initial?.dataLimitGb || DEFAULT_QUOTA_GB),
    dataLimitCheckInterval: initial?.dataLimitCheckInterval ?? DEFAULT_QUOTA_INTERVAL,
  });

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setCopied(false);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const isEdit = Boolean(initial);
  const normalizedQuotaGb = Math.max(1, Number(form.dataLimitGb) || DEFAULT_QUOTA_GB);
  const scriptPreview = useMemo(
    () => buildQuotaScriptPreview({
      ...form,
      dataLimitGb: normalizedQuotaGb,
      dataLimitBytes: gbToBytes(normalizedQuotaGb),
      dataLimitAction: "firewall-block",
    }),
    [form, normalizedQuotaGb],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scriptPreview);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleSave = () => {
    const dataLimitGb = form.dataLimitEnabled ? normalizedQuotaGb : 0;
    onSave({
      clientName: form.clientName,
      mac: form.mac,
      ip: form.ip,
      rateLimit: form.rateLimit,
      expiresAt: form.expiresAt,
      comment: form.comment,
      status: form.status,
      dataLimitEnabled: form.dataLimitEnabled,
      dataLimitGb,
      dataLimitBytes: gbToBytes(dataLimitGb),
      dataLimitCheckInterval: form.dataLimitCheckInterval,
      dataLimitAction: "firewall-block",
      dataLimitReached: initial?.dataLimitReached ?? false,
    });
    onClose();
  };

  return (
    <Modal title={isEdit ? "Modifier abonnement" : "Nouvel abonnement"} onClose={onClose} wide>
      {prefill && !isEdit && (
        <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3">
          <p className="font-mono text-[11px] leading-relaxed text-primary">
            Appareil pré-rempli depuis la liste des clients connectés. Vérifiez les informations avant de soumettre.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Nom client">
          <Input placeholder="Hassan Ouédraogo" value={form.clientName} onChange={(event) => set("clientName", event.target.value)} />
        </FormField>
        <FormField label="Adresse MAC">
          <Input placeholder="DC:A6:32:7F:2E:01" value={form.mac} onChange={(event) => set("mac", event.target.value)} />
        </FormField>
        <FormField label="Adresse IP">
          <Input placeholder="192.168.1.xxx" value={form.ip} onChange={(event) => set("ip", event.target.value)} />
        </FormField>
        <FormField label="Rate Limit (↓/↑)">
          <Select value={form.rateLimit} onChange={(event) => set("rateLimit", event.target.value as Plan)}>
            {PLANS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
          </Select>
        </FormField>
        <FormField label="Date expiration">
          <Input type="date" value={form.expiresAt} onChange={(event) => set("expiresAt", event.target.value)} />
        </FormField>
        <FormField label="Statut">
          <Select value={form.status} onChange={(event) => set("status", event.target.value as Status)}>
            <option value="active">Actif</option>
            <option value="suspended">Suspendu</option>
            <option value="expired">Expiré</option>
            <option value="pending">En attente</option>
          </Select>
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Commentaire">
            <Input placeholder="Remarque libre…" value={form.comment} onChange={(event) => set("comment", event.target.value)} />
          </FormField>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-muted/35 p-4">
        <label className="flex cursor-pointer flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Database size={18} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">Couper automatiquement après quota data</span>
              <span className="mt-1 block font-mono text-[11px] leading-relaxed text-muted-foreground">
                Crée une Simple Queue pour compter le trafic, puis un Scheduler vérifie le compteur. La date d'expiration reste séparée et n'est pas modifiée.
              </span>
            </span>
          </div>
          <input
            type="checkbox"
            checked={form.dataLimitEnabled}
            onChange={(event) => set("dataLimitEnabled", event.target.checked)}
            className="mt-1 h-5 w-5 rounded border-border accent-primary"
          />
        </label>

        {form.dataLimitEnabled && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Limite data totale">
              <div className="relative">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.dataLimitGb}
                  onChange={(event) => set("dataLimitGb", event.target.value)}
                  className="pr-12"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">Go</span>
              </div>
            </FormField>
            <FormField label="Intervalle de vérification">
              <Select value={form.dataLimitCheckInterval} onChange={(event) => set("dataLimitCheckInterval", event.target.value)}>
                {quotaIntervals.map((interval) => <option key={interval} value={interval}>Toutes les {interval}</option>)}
              </Select>
            </FormField>
            <div className="sm:col-span-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
              <div className="flex gap-2 text-amber-300">
                <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                <p className="font-mono text-[11px] leading-relaxed">
                  À {normalizedQuotaGb} Go, le Scheduler ajoute l'IP dans <span className="font-semibold">quota-blocked</span>, désactive la Simple Queue et bloque le forwarding via firewall. L'abonnement peut garder sa date d'expiration normale.
                </p>
              </div>
            </div>

            <div className="sm:col-span-2 overflow-hidden rounded-2xl border border-border bg-background/70">
              <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Script MikroTik généré</span>
                <Button variant="secondary" onClick={handleCopy} className="w-full py-2 sm:w-auto">
                  <Copy size={13} /> {copied ? "Copié" : "Copier"}
                </Button>
              </div>
              <pre className="thin-scrollbar max-h-64 overflow-auto p-4 text-[11px] leading-relaxed text-muted-foreground"><code>{scriptPreview}</code></pre>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button onClick={onClose} variant="secondary" className="w-full sm:w-auto">
          Annuler
        </Button>
        <Button variant="primary" onClick={handleSave} className="w-full sm:w-auto">
          {isEdit ? "Enregistrer" : "Créer + Appliquer MikroTik"}
        </Button>
      </div>
    </Modal>
  );
}
