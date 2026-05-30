import { useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Copy, Database, Router, ShieldAlert, Zap } from "lucide-react";
import { Button, FormField, Input, Modal, Select, cx } from "./ui";
import { PLANS } from "../types";
import { buildQuotaScriptPreview, DEFAULT_QUOTA_GB, DEFAULT_QUOTA_INTERVAL, gbToBytes } from "../utils/mikrotikQuota";
import type { Plan, Status, Subscription, SubscriptionDraft } from "../types";

interface SubFormProps {
  initial?: Subscription | null;
  prefill?: { mac?: string; ip?: string; clientName?: string; comment?: string };
  onSave: (data: SubscriptionDraft) => void | Promise<void>;
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
  applyToRouter: boolean;
};

const quotaIntervals = ["1m", "5m", "10m", "30m", "1h"];

export function SubForm({ initial, prefill, onSave, onClose }: SubFormProps) {
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [form, setForm] = useState<FormState>({
    clientName: initial?.clientName ?? prefill?.clientName ?? "",
    mac: initial?.mac ?? prefill?.mac ?? "",
    ip: initial?.ip ?? prefill?.ip ?? "",
    rateLimit: (initial?.rateLimit ?? "10M/5M") as Plan,
    expiresAt: initial?.expiresAt ?? "",
    comment: initial?.comment ?? prefill?.comment ?? "",
    status: (initial?.status ?? "active") as Status,
    dataLimitEnabled: initial?.dataLimitEnabled ?? false,
    dataLimitGb: String(initial?.dataLimitGb || DEFAULT_QUOTA_GB),
    dataLimitCheckInterval: initial?.dataLimitCheckInterval ?? DEFAULT_QUOTA_INTERVAL,
    applyToRouter: true,
  });

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setCopied(false);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setApplyToRouter = (enabled: boolean) => {
    setCopied(false);
    setForm((current) => ({
      ...current,
      // Le quota data doit toujours être appliqué au routeur pour fonctionner.
      applyToRouter: current.dataLimitEnabled ? true : enabled,
    }));
  };

  const setDataLimitEnabled = (enabled: boolean) => {
    setCopied(false);
    setForm((current) => ({
      ...current,
      dataLimitEnabled: enabled,
      // Quand l'utilisateur coche le quota, le frontend force l'application backend -> MikroTik.
      applyToRouter: enabled ? true : current.applyToRouter,
    }));
  };

  const isEdit = Boolean(initial);
  const normalizedQuotaGb = Math.max(1, Number(form.dataLimitGb) || DEFAULT_QUOTA_GB);
  const routerApplyForced = form.dataLimitEnabled;
  const effectiveApplyToRouter = form.applyToRouter || form.dataLimitEnabled;
  const scriptPreview = useMemo(
    () => buildQuotaScriptPreview({
      ...form,
      dataLimitGb: normalizedQuotaGb,
      dataLimitBytes: gbToBytes(normalizedQuotaGb),
      dataLimitAction: "firewall-block",
    }),
    [form, normalizedQuotaGb],
  );

  const missingRequired = !form.clientName.trim() || !form.mac.trim() || !form.ip.trim() || !form.expiresAt;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scriptPreview);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleSave = async () => {
    if (missingRequired) return;
    const dataLimitGb = form.dataLimitEnabled ? normalizedQuotaGb : 0;
    setApplying(true);
    try {
      await onSave({
        clientName: form.clientName.trim(),
        mac: form.mac.trim().toUpperCase(),
        ip: form.ip.trim(),
        rateLimit: form.rateLimit,
        expiresAt: form.expiresAt,
        comment: form.comment,
        status: form.status,
        dataLimitEnabled: form.dataLimitEnabled,
        dataLimitGb,
        dataLimitBytes: gbToBytes(dataLimitGb),
        dataLimitCheckInterval: form.dataLimitEnabled ? form.dataLimitCheckInterval : DEFAULT_QUOTA_INTERVAL,
        dataLimitAction: "firewall-block",
        dataLimitReached: initial?.dataLimitReached ?? false,
        applyToRouter: effectiveApplyToRouter,
      });
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal title={isEdit ? "Modifier abonnement MikroTik" : "Nouvel abonnement MikroTik"} onClose={onClose} wide>
      <div className="space-y-5">
        {prefill && !isEdit && (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3">
            <p className="font-mono text-[11px] leading-relaxed text-primary">
              Appareil pré-rempli depuis les clients connectés réels. Vérifiez le nom, l'IP et la MAC avant d'appliquer sur MikroTik.
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
          <FormField label="Plan débit (↓/↑)">
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

        <TogglePanel
          icon={<Router size={18} />}
          title="Appliquer maintenant sur MikroTik"
          description="Le frontend envoie la demande à Django. Le backend garde les identifiants dans .env et exécute le script RouterOS REST API directement sur le routeur."
          checked={effectiveApplyToRouter}
          onChange={setApplyToRouter}
          disabled={routerApplyForced}
          badge={routerApplyForced ? "Forcé par quota" : effectiveApplyToRouter ? "Backend → MikroTik" : "MySQL seulement"}
          tone="primary"
        />

        <div className="rounded-3xl border border-border bg-muted/35 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Database size={18} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="block text-sm font-semibold text-foreground">Limiter automatiquement par quota data</span>
                  <span className="rounded-full border border-border bg-background/80 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Optionnel
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  Si l'utilisateur coche cette option, le backend crée/met à jour la Simple Queue, le script et le Scheduler. La date d'expiration reste indépendante.
                </p>
              </div>
            </div>
            <ToggleSwitch checked={form.dataLimitEnabled} onChange={setDataLimitEnabled} />
          </div>

          {form.dataLimitEnabled ? (
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
                    À {normalizedQuotaGb} Go, le Scheduler ajoute l'IP dans <span className="font-semibold">quota-blocked</span>, coupe le forwarding via firewall et désactive la Simple Queue. Le quota est appliqué seulement parce que cette case est cochée.
                  </p>
                </div>
              </div>

              <div className="sm:col-span-2 overflow-hidden rounded-2xl border border-border bg-background/70">
                <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Script envoyé par Django au routeur</span>
                  <Button variant="secondary" onClick={handleCopy} className="w-full py-2 sm:w-auto">
                    <Copy size={13} /> {copied ? "Copié" : "Copier aperçu"}
                  </Button>
                </div>
                <pre className="thin-scrollbar max-h-56 overflow-auto p-4 text-[11px] leading-relaxed text-muted-foreground"><code>{scriptPreview}</code></pre>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-border bg-background/60 p-3">
              <div className="flex gap-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                Quota désactivé : le backend supprimera le script/Scheduler quota existant et gardera uniquement la Simple Queue avec le plan débit.
              </div>
            </div>
          )}
        </div>

        {missingRequired && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 font-mono text-[11px] text-red-300">
            Nom client, MAC, IP et date d'expiration sont obligatoires pour appliquer correctement sur MikroTik.
          </div>
        )}

        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end">
          <Button onClick={onClose} variant="secondary" className="w-full sm:w-auto">
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={applying || missingRequired} className="w-full sm:w-auto">
            <Zap size={14} /> {applying ? "Application…" : isEdit ? "Enregistrer + appliquer" : "Créer + appliquer MikroTik"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TogglePanel({
  icon,
  title,
  description,
  checked,
  onChange,
  disabled,
  badge,
  tone = "primary",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  badge?: string;
  tone?: "primary" | "success";
}) {
  return (
    <div className={cx(
      "rounded-3xl border p-4",
      tone === "primary" ? "border-primary/15 bg-primary/[0.06]" : "border-emerald-400/15 bg-emerald-400/[0.06]",
    )}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{title}</span>
              {badge && <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-primary">{badge}</span>}
            </div>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <ToggleSwitch checked={checked} disabled={disabled} onChange={onChange} />
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative mt-1 h-7 w-12 shrink-0 rounded-full border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-80",
        checked ? "border-primary bg-primary shadow-lg shadow-primary/20" : "border-border bg-muted",
      )}
    >
      <span
        className={cx(
          "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all duration-200",
          checked ? "left-6" : "left-1",
        )}
      />
    </button>
  );
}
