import { fmtBytes } from "../types";
import { getQuotaBytes, getQuotaPercent, getSubscriptionUsage } from "./mikrotikQuota";
import type { Subscription } from "../types";

export interface ReceiptExportPayload {
  clientName: string;
  plan: string;
  expiresAt: string;
  quotaLabel: string;
  quotaUsageLabel: string;
  quotaPercent: number;
  ip: string;
  mac: string;
  status: string;
  generatedAt: string;
}

export function getReceiptPayload(subscription: Subscription): ReceiptExportPayload {
  const quotaBytes = getQuotaBytes(subscription);
  const usage = getSubscriptionUsage(subscription);
  const quotaPercent = getQuotaPercent(subscription);

  return {
    clientName: subscription.clientName,
    plan: subscription.rateLimit,
    expiresAt: subscription.expiresAt || "Non définie",
    quotaLabel: subscription.dataLimitEnabled && quotaBytes > 0 ? `${subscription.dataLimitGb} Go` : "Illimité",
    quotaUsageLabel: subscription.dataLimitEnabled && quotaBytes > 0 ? `${fmtBytes(usage)} / ${fmtBytes(quotaBytes)}` : "Quota data illimité",
    quotaPercent,
    ip: subscription.ip,
    mac: subscription.mac,
    status: subscription.status,
    generatedAt: new Date().toLocaleString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function filenameSafe(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "client";
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawLabelValue(ctx: CanvasRenderingContext2D, label: string, value: string, y: number) {
  ctx.fillStyle = "#64748b";
  ctx.font = "600 24px Arial, sans-serif";
  ctx.fillText(label.toUpperCase(), 90, y);

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 38px Arial, sans-serif";
  ctx.fillText(value, 90, y + 48);
}

function createReceiptCanvas(payload: ReceiptExportPayload): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1100;
  canvas.height = 1500;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible dans ce navigateur");

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0f172a";
  drawRoundedRect(ctx, 50, 50, 1000, 1400, 44);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, 70, 70, 960, 1360, 36);
  ctx.fill();

  ctx.fillStyle = "#14b8a6";
  drawRoundedRect(ctx, 90, 90, 920, 170, 30);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 52px Arial, sans-serif";
  ctx.fillText("Reçu d'abonnement", 130, 165);
  ctx.font = "500 26px Arial, sans-serif";
  ctx.fillText("Subscription MikroTik Management Platform", 130, 212);

  ctx.fillStyle = "#0f172a";
  ctx.font = "800 54px Arial, sans-serif";
  ctx.fillText(payload.clientName, 90, 350);

  ctx.fillStyle = "#64748b";
  ctx.font = "500 26px Arial, sans-serif";
  ctx.fillText(`Généré le ${payload.generatedAt}`, 90, 395);

  drawLabelValue(ctx, "Plan", payload.plan, 500);
  drawLabelValue(ctx, "Expiration", payload.expiresAt, 650);
  drawLabelValue(ctx, "Quota data", payload.quotaLabel, 800);
  drawLabelValue(ctx, "Consommation", payload.quotaUsageLabel, 950);

  const barX = 90;
  const barY = 1060;
  const barW = 920;
  const barH = 34;
  ctx.fillStyle = "#e2e8f0";
  drawRoundedRect(ctx, barX, barY, barW, barH, 18);
  ctx.fill();
  ctx.fillStyle = payload.quotaPercent >= 100 ? "#ef4444" : payload.quotaPercent >= 85 ? "#f59e0b" : "#14b8a6";
  drawRoundedRect(ctx, barX, barY, Math.max(18, (barW * payload.quotaPercent) / 100), barH, 18);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 28px Arial, sans-serif";
  ctx.fillText(`${payload.quotaPercent}% utilisé`, 90, 1145);

  ctx.fillStyle = "#f8fafc";
  drawRoundedRect(ctx, 90, 1210, 920, 130, 26);
  ctx.fill();

  ctx.fillStyle = "#64748b";
  ctx.font = "600 22px Arial, sans-serif";
  ctx.fillText("IP", 130, 1265);
  ctx.fillText("MAC", 430, 1265);
  ctx.fillText("STATUT", 760, 1265);
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 26px Arial, sans-serif";
  ctx.fillText(payload.ip, 130, 1310);
  ctx.fillText(payload.mac, 430, 1310);
  ctx.fillText(payload.status.toUpperCase(), 760, 1310);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 22px Arial, sans-serif";
  ctx.fillText("Ce reçu résume le forfait sélectionné. Il ne remplace pas une facture fiscale.", 90, 1390);

  return canvas;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Export impossible"));
    }, type, quality);
  });
}

export async function buildReceiptJpegBlob(subscription: Subscription): Promise<Blob> {
  const canvas = createReceiptCanvas(getReceiptPayload(subscription));
  return canvasToBlob(canvas, "image/jpeg", 0.94);
}

export async function downloadReceiptJpeg(subscription: Subscription): Promise<void> {
  const blob = await buildReceiptJpegBlob(subscription);
  downloadBlob(blob, `recu-${filenameSafe(subscription.clientName)}.jpeg`);
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function makePdfBlob(payload: ReceiptExportPayload): Blob {
  const lines = [
    "RECU D'ABONNEMENT",
    "Subscription MikroTik Management Platform",
    "",
    `Client : ${payload.clientName}`,
    `Plan : ${payload.plan}`,
    `Expiration : ${payload.expiresAt}`,
    `Quota data : ${payload.quotaLabel}`,
    `Consommation : ${payload.quotaUsageLabel}`,
    `Utilisation quota : ${payload.quotaPercent}%`,
    `IP : ${payload.ip}`,
    `MAC : ${payload.mac}`,
    `Statut : ${payload.status.toUpperCase()}`,
    `Genere le : ${payload.generatedAt}`,
    "",
    "Ce recu resume le forfait selectionne. Il ne remplace pas une facture fiscale.",
  ];

  const textCommands = lines
    .map((line, index) => `BT /F1 ${index === 0 ? 22 : 12} Tf 56 ${790 - index * 32} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");

  const stream = `0.95 0.98 1 rg 0 0 595 842 re f\n0.08 0.13 0.22 rg 42 42 511 758 re f\n1 1 1 rg 50 50 495 742 re f\n0.08 0.72 0.65 rg 56 730 483 58 re f\n0.06 0.09 0.16 rg\n${textCommands}`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export function buildReceiptPdfBlob(subscription: Subscription): Blob {
  return makePdfBlob(getReceiptPayload(subscription));
}

export function downloadReceiptPdf(subscription: Subscription): void {
  const blob = buildReceiptPdfBlob(subscription);
  downloadBlob(blob, `recu-${filenameSafe(subscription.clientName)}.pdf`);
}

export async function shareReceipt(subscription: Subscription, format: "jpeg" | "pdf") {
  const blob = format === "jpeg" ? await buildReceiptJpegBlob(subscription) : buildReceiptPdfBlob(subscription);
  const extension = format === "jpeg" ? "jpeg" : "pdf";
  const type = format === "jpeg" ? "image/jpeg" : "application/pdf";
  const file = new File([blob], `recu-${filenameSafe(subscription.clientName)}.${extension}`, { type });

  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({
      title: `Reçu abonnement - ${subscription.clientName}`,
      text: `Reçu d'abonnement de ${subscription.clientName}`,
      files: [file],
    });
    return;
  }

  downloadBlob(blob, file.name);
}
