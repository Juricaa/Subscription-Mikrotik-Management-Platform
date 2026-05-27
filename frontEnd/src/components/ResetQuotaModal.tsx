import { useMemo, useState } from "react";
import { CalendarClock, Database, RotateCcw, ShieldCheck, Wifi } from "lucide-react";
import { Button, FormField, Input, Modal, Select } from "./ui";
import { fmtBytes, PLANS } from "../types";
import { DEFAULT_QUOTA_GB, DEFAULT_QUOTA_INTERVAL, gbToBytes, getQuotaBytes, getQuotaPercent, getSubscriptionUsage } from "../utils/mikrotikQuota";
import type { Plan, Subscription, SubscriptionRenewalPayload } from "../types";

interface ResetQuotaModalProps {
  subscription: Subscription;
  onClose: () => void;
  onConfirm: (payload: SubscriptionRenewalPayload) => void | Promise<void>;
}

const quotaIntervals = ["1m", "5m", "10m", "30m", "1h"];

export function ResetQuotaModal({ subscription, onClose, onConfirm }: ResetQuotaModalProps) {
  const [expiresAt, setExpiresAt] = useState(subscription.expiresAt || "");
  const [rateLimit, setRateLimit] = useState<Plan>(subscription.rateLimit);
  const [dataLimitEnabled, setDataLimitEnabled] = useState(subscription.dataLimitEnabled);
  const [dataLimitGb, setDataLimitGb] = useState(String(subscription.dataLimitGb || DEFAULT_QUOTA_GB));
  const [dataLimitCheckInterval, setDataLimitCheckInterval] = useState(subscription.dataLimitCheckInterval || DEFAULT_QUOTA_INTERVAL);
  const [saving, setSaving] = useState(false);

  const quotaBytes = getQuotaBytes(subscription);
  const usage = getSubscriptionUsage(subscription);
  const quotaPercent = getQuotaPercent(subscription);
  const normalizedQuotaGb = useMemo(() => Math.max(1, Number(dataLimitGb) || DEFAULT_QUOTA_GB), [dataLimitGb]);
  const nextQuotaBytes = dataLimitEnabled ? gbToBytes(normalizedQuotaGb) : 0;
  const hasPlanChanged = rateLimit !== subscription.rateLimit;
  const hasQuotaChanged =
    dataLimitEnabled !== subscription.dataLimitEnabled ||
    Number(subscription.dataLimitGb || 0) !== (dataLimitEnabled ? normalizedQuotaGb : 0) ||
    dataLimitCheckInterval !== subscription.dataLimitCheckInterval;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm({
        expiresAt,
        rateLimit,
        dataLimitEnabled,
        dataLimitGb: dataLimitEnabled ? normalizedQuotaGb : 0,
        dataLimitBytes: nextQuotaBytes,
        dataLimitCheckInterval,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Reset quota + renouvellement" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-3xl border border-primary/20 bg-primary/10 p-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <RotateCcw size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{subscription.clientName}</div>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
                Cette action remet le quota data à zéro, débloque l'utilisateur sur MikroTik et permet de renouveler le même abonnement sans créer un nouvel enregistrement.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Summary label="Plan actuel" value={subscription.rateLimit} />
          <Summary label="Expiration actuelle" value={subscription.expiresAt || "Non définie"} />
          <Summary label="Quota actuel" value={subscription.dataLimitEnabled && quotaBytes > 0 ? `${subscription.dataLimitGb} Go` : "Illimité"} />
          <Summary label="Utilisé" value={`${fmtBytes(usage)} (${quotaPercent}%)`} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nouvelle date d'expiration">
            <Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </FormField>

          <FormField label="Nouveau plan">
            <Select value={rateLimit} onChange={(event) => setRateLimit(event.target.value as Plan)}>
              {PLANS.map((plan) => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="rounded-3xl border border-border bg-muted/35 p-4">
          <label className="flex cursor-pointer flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Database size={18} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">Nouveau quota data</span>
                <span className="mt-1 block font-mono text-[11px] leading-relaxed text-muted-foreground">
                  Active ou modifie la limite data pendant le renouvellement. Les compteurs repartent à zéro après confirmation.
                </span>
              </span>
            </div>
            <input
              type="checkbox"
              checked={dataLimitEnabled}
              onChange={(event) => setDataLimitEnabled(event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-border accent-primary"
            />
          </label>

          {dataLimitEnabled ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField label="Limite data totale">
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={dataLimitGb}
                    onChange={(event) => setDataLimitGb(event.target.value)}
                    className="pr-12"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">Go</span>
                </div>
              </FormField>

              <FormField label="Intervalle de vérification">
                <Select value={dataLimitCheckInterval} onChange={(event) => setDataLimitCheckInterval(event.target.value)}>
                  {quotaIntervals.map((interval) => (
                    <option key={interval} value={interval}>Toutes les {interval}</option>
                  ))}
                </Select>
              </FormField>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-border bg-background/60 p-3 font-mono text-[11px] text-muted-foreground">
              Le renouvellement remettra les compteurs à zéro et supprimera le Scheduler quota. Le client restera limité uniquement par le plan débit.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
          <div className="flex gap-2 text-amber-300">
            <CalendarClock size={15} className="mt-0.5 shrink-0" />
            <p className="font-mono text-[11px] leading-relaxed">
              Après confirmation, MySQL et MikroTik seront mis à jour : expiration, plan, quota data, Simple Queue, Scheduler et déblocage firewall.
            </p>
          </div>
        </div>

        {(hasPlanChanged || hasQuotaChanged) && (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
            <div className="flex gap-2 text-primary">
              <Wifi size={15} className="mt-0.5 shrink-0" />
              <p className="font-mono text-[11px] leading-relaxed">
                Nouveau résumé : plan <strong>{rateLimit}</strong> · quota <strong>{dataLimitEnabled ? `${normalizedQuotaGb} Go` : "illimité"}</strong> · vérification <strong>{dataLimitEnabled ? dataLimitCheckInterval : "désactivée"}</strong>.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={saving || !expiresAt}>
            <ShieldCheck size={14} /> {saving ? "Application…" : "Confirmer reset"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-3">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
