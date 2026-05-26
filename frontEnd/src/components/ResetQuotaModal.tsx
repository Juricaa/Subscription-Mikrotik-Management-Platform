import { useState } from "react";
import { CalendarClock, RotateCcw, ShieldCheck } from "lucide-react";
import { Button, FormField, Input, Modal } from "./ui";
import { fmtBytes } from "../types";
import { getQuotaBytes, getQuotaPercent, getSubscriptionUsage } from "../utils/mikrotikQuota";
import type { Subscription } from "../types";

interface ResetQuotaModalProps {
  subscription: Subscription;
  onClose: () => void;
  onConfirm: (expiresAt: string) => void | Promise<void>;
}

export function ResetQuotaModal({ subscription, onClose, onConfirm }: ResetQuotaModalProps) {
  const [expiresAt, setExpiresAt] = useState(subscription.expiresAt || "");
  const [saving, setSaving] = useState(false);
  const quotaBytes = getQuotaBytes(subscription);
  const usage = getSubscriptionUsage(subscription);
  const quotaPercent = getQuotaPercent(subscription);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(expiresAt);
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
                Cette action remet le quota data à zéro et débloque l'utilisateur sur MikroTik. Elle met aussi à jour la date d'expiration pour marquer un renouvellement sans créer un nouvel abonnement.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Summary label="Plan" value={subscription.rateLimit} />
          <Summary label="Expiration actuelle" value={subscription.expiresAt || "Non définie"} />
          <Summary label="Quota data" value={subscription.dataLimitEnabled && quotaBytes > 0 ? `${subscription.dataLimitGb} Go` : "Illimité"} />
          <Summary label="Utilisé" value={`${fmtBytes(usage)} (${quotaPercent}%)`} />
        </div>

        <FormField label="Nouvelle date d'expiration">
          <Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </FormField>

        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
          <div className="flex gap-2 text-amber-300">
            <CalendarClock size={15} className="mt-0.5 shrink-0" />
            <p className="font-mono text-[11px] leading-relaxed">
              La date sera mise à jour dans l'application et dans le commentaire MikroTik de la Simple Queue. Aucun nouvel utilisateur n'est créé.
            </p>
          </div>
        </div>

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
