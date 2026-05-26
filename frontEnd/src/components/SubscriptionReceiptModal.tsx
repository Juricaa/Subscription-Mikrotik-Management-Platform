import { useState } from "react";
import { Download, FileText, ImageDown, Share2 } from "lucide-react";
import { Button, Modal } from "./ui";
import { STATUS_CFG, fmtBytes } from "../types";
import { downloadReceiptJpeg, downloadReceiptPdf, shareReceipt } from "../utils/receiptExport";
import { getQuotaBytes, getQuotaPercent, getSubscriptionUsage } from "../utils/mikrotikQuota";
import type { Subscription } from "../types";

interface SubscriptionReceiptModalProps {
  subscription: Subscription;
  onClose: () => void;
}

export function SubscriptionReceiptModal({ subscription, onClose }: SubscriptionReceiptModalProps) {
  const [working, setWorking] = useState<"jpeg" | "pdf" | "share-jpeg" | "share-pdf" | null>(null);
  const quotaBytes = getQuotaBytes(subscription);
  const usage = getSubscriptionUsage(subscription);
  const quotaPercent = getQuotaPercent(subscription);
  const status = STATUS_CFG[subscription.status];

  const run = async (action: typeof working, handler: () => void | Promise<void>) => {
    setWorking(action);
    try {
      await handler();
    } finally {
      setWorking(null);
    }
  };

  return (
    <Modal title="Reçu abonnement" onClose={onClose} wide>
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="overflow-hidden rounded-3xl border border-border bg-background shadow-sm">
          <div className="bg-primary px-5 py-5 text-primary-foreground">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] opacity-80">Reçu client</div>
                <div className="mt-2 text-2xl font-bold">{subscription.clientName}</div>
              </div>
              <div className="rounded-2xl bg-white/15 p-3">
                <FileText size={22} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <ReceiptItem label="Plan" value={subscription.rateLimit} highlight />
            <ReceiptItem label="Expiration" value={subscription.expiresAt || "Non définie"} highlight />
            <ReceiptItem label="Quota data" value={subscription.dataLimitEnabled && quotaBytes > 0 ? `${subscription.dataLimitGb} Go` : "Illimité"} />
            <ReceiptItem label="Consommation" value={subscription.dataLimitEnabled && quotaBytes > 0 ? `${fmtBytes(usage)} / ${fmtBytes(quotaBytes)}` : "Quota illimité"} />
            <ReceiptItem label="Adresse IP" value={subscription.ip} />
            <ReceiptItem label="Adresse MAC" value={subscription.mac} />
          </div>

          <div className="border-t border-border p-5">
            <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Progression quota</span>
              <span>{quotaPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${quotaPercent >= 100 ? "bg-red-400" : quotaPercent >= 85 ? "bg-amber-400" : "bg-primary"}`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${status.dot}`} />
              <span className={`font-mono text-[10px] font-semibold ${status.color}`}>{status.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">Dernière vue : {subscription.lastSeen}</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card/80 p-4">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Exporter / partager</div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Le reçu reprend le nom client, le plan, l'expiration et le quota data sélectionné. Il peut être téléchargé ou partagé directement si le navigateur le permet.
          </p>
          <div className="mt-4 grid gap-2">
            <Button variant="secondary" onClick={() => run("jpeg", () => downloadReceiptJpeg(subscription))} disabled={working !== null}>
              <ImageDown size={14} /> {working === "jpeg" ? "Export…" : "Exporter JPEG"}
            </Button>
            <Button variant="secondary" onClick={() => run("pdf", () => downloadReceiptPdf(subscription))} disabled={working !== null}>
              <Download size={14} /> {working === "pdf" ? "Export…" : "Exporter PDF"}
            </Button>
            <Button variant="primary" onClick={() => run("share-jpeg", () => shareReceipt(subscription, "jpeg"))} disabled={working !== null}>
              <Share2 size={14} /> Partager JPEG
            </Button>
            <Button variant="ghost" onClick={() => run("share-pdf", () => shareReceipt(subscription, "pdf"))} disabled={working !== null}>
              <Share2 size={14} /> Partager PDF
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ReceiptItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "border-primary/20 bg-primary/10" : "border-border bg-muted/40"}`}>
      <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 break-words text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
