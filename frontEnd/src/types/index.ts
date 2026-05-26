export type Status = "active" | "suspended" | "expired" | "pending";
export type Plan = "10M/5M" | "20M/10M" | "50M/20M" | "100M/50M";

export interface Subscription {
  id: string;
  clientName: string;
  mac: string;
  ip: string;
  rateLimit: Plan;
  status: Status;
  expiresAt: string;
  comment: string;
  bytesIn: number;
  bytesOut: number;
  lastSeen: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  target: string;
  operator: string;
  result: "success" | "error";
  detail: string;
}

export interface ConnectedDevice {
  mac: string;
  ip: string;
  hostname: string;
  vendor: string;
  rxBytes: number;
  txBytes: number;
  signalDbm: number | null;
  connectedSince: string;
  interface: string;
  hasSubscription: boolean;
}

export type View = "dashboard" | "subscriptions" | "clients" | "router" | "logs" | "settings";

export const STATUS_CFG: Record<Status, { label: string; color: string; dot: string }> = {
  active:    { label: "ACTIF",      color: "text-emerald-400", dot: "bg-emerald-400" },
  suspended: { label: "SUSPENDU",   color: "text-amber-400",   dot: "bg-amber-400"  },
  expired:   { label: "EXPIRÉ",     color: "text-red-400",     dot: "bg-red-400"    },
  pending:   { label: "EN ATTENTE", color: "text-blue-400",    dot: "bg-blue-400"   },
};

export const PLANS: Plan[] = ["10M/5M", "20M/10M", "50M/20M", "100M/50M"];

export function fmtBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + " GB";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " MB";
  return (n / 1e3).toFixed(0) + " KB";
}
