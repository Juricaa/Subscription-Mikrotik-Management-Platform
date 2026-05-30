import type { ConnectedDevice, LogEntry, Subscription, SubscriptionDraft } from "../types";

export interface MikroTikApplyResponse {
  ok: boolean;
  applied?: boolean;
  reset?: boolean;
  message?: string;
  subscription?: Subscription;
  error?: {
    message?: string;
    statusCode?: number;
    detail?: unknown;
  };
}

export interface MikroTikSystemResourceResponse {
  ok: boolean;
  service?: string;
  time?: string;
  result?: Record<string, unknown>;
  error?: {
    message?: string;
    statusCode?: number;
    detail?: unknown;
  };
}

export interface ConnectedClientsResponse {
  ok: boolean;
  devices: ConnectedDevice[];
  sources?: Record<string, number>;
  errors?: string[];
  syncedAt?: string;
  error?: {
    message?: string;
    statusCode?: number;
    detail?: unknown;
  };
}

// En développement, on passe par le proxy Vite /api par défaut.
// Cela évite les erreurs CORS navigateur entre :5173/:5174 et :8000.
// Pour forcer l'appel direct à Django, mettez VITE_USE_VITE_PROXY=false.
const USE_VITE_PROXY = import.meta.env.DEV && String(import.meta.env.VITE_USE_VITE_PROXY || "true").toLowerCase() !== "false";
const RAW_API_BASE_URL = USE_VITE_PROXY ? "" : import.meta.env.VITE_API_BASE_URL || "";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "");
const API_WITH_CREDENTIALS = String(import.meta.env.VITE_API_WITH_CREDENTIALS || "false").toLowerCase() === "true";

export function getApiBaseUrl(): string {
  return API_BASE_URL || "proxy Vite /api -> Django";
}

function makeApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeSubscription(data: Subscription): Subscription {
  return {
    ...data,
    id: String(data.id),
    dataLimitGb: Number(data.dataLimitGb || 0),
    dataLimitBytes: Number(data.dataLimitBytes || 0),
    bytesIn: Number(data.bytesIn || 0),
    bytesOut: Number(data.bytesOut || 0),
  };
}

function normalizeConnectedDevice(data: ConnectedDevice): ConnectedDevice {
  return {
    ...data,
    mac: data.mac || "",
    ip: data.ip || "",
    hostname: data.hostname || data.clientName || "Client inconnu",
    vendor: data.vendor || data.source || "RouterOS",
    sourceDetails: data.sourceDetails || data.source || data.vendor || "RouterOS",
    accessType: data.accessType || (data.isWireless ? "wifi" : "unknown"),
    isWireless: Boolean(data.isWireless || data.accessType === "wifi"),
    rxBytes: Number(data.rxBytes || 0),
    txBytes: Number(data.txBytes || 0),
    signalDbm: data.signalDbm === undefined ? null : data.signalDbm,
    connectedSince: data.connectedSince || "—",
    interface: data.interface || "—",
    hasSubscription: Boolean(data.hasSubscription),
    quotaLimitBytes: Number(data.quotaLimitBytes || 0),
    quotaUsageBytes: Number(data.quotaUsageBytes || 0),
  };
}

async function readJson<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null) as Promise<T | null>;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const hasBody = options.body !== undefined && options.body !== null;
  const response = await fetch(makeApiUrl(path), {
    ...options,
    credentials: API_WITH_CREDENTIALS ? "include" : "omit",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await readJson<T & { error?: { message?: string }; message?: string }>(response);

  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Erreur backend HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

async function postMikroTikAction(path: string, subscription: SubscriptionDraft): Promise<MikroTikApplyResponse> {
  const data = await apiRequest<MikroTikApplyResponse>(path, {
    method: "POST",
    body: JSON.stringify({ subscription }),
  });

  if (!data?.ok) {
    const message = data?.error?.message || data?.message || "Erreur backend MikroTik";
    throw new Error(message);
  }

  if (data.subscription) data.subscription = normalizeSubscription(data.subscription);
  return data;
}

export async function fetchSubscriptionsFromDatabase(): Promise<Subscription[]> {
  const data = await apiRequest<Subscription[]>("/api/subscriptions/");
  return data.map(normalizeSubscription);
}

export async function saveSubscriptionToDatabase(subscription: SubscriptionDraft, id?: string): Promise<Subscription> {
  const path = id ? `/api/subscriptions/${id}/` : "/api/subscriptions/";
  const method = id ? "PATCH" : "POST";
  const data = await apiRequest<Subscription>(path, {
    method,
    body: JSON.stringify(subscription),
  });
  return normalizeSubscription(data);
}

export async function deleteSubscriptionFromDatabase(id: string): Promise<void> {
  await apiRequest<void>(`/api/subscriptions/${id}/`, { method: "DELETE" });
}

export async function fetchLogsFromDatabase(): Promise<LogEntry[]> {
  return apiRequest<LogEntry[]>("/api/logs/");
}

export async function fetchMikroTikSystemResource(): Promise<MikroTikSystemResourceResponse> {
  return apiRequest<MikroTikSystemResourceResponse>("/api/mikrotik/system/resource");
}

export async function fetchBackendHealth(): Promise<MikroTikSystemResourceResponse> {
  return apiRequest<MikroTikSystemResourceResponse>("/api/health");
}

export async function fetchConnectedClientsFromRouter(syncDatabase = true, includeGeneric = false): Promise<ConnectedClientsResponse> {
  const data = await apiRequest<ConnectedClientsResponse>(`/api/mikrotik/connected-clients?sync=${syncDatabase ? "true" : "false"}&includeGeneric=${includeGeneric ? "true" : "false"}`);
  if (!data.ok) {
    const message = data.error?.message || "Impossible de lire les clients connectés MikroTik";
    throw new Error(message);
  }
  return {
    ...data,
    devices: (data.devices || []).map(normalizeConnectedDevice),
  };
}

export async function syncSubscriptionUsageFromRouter(): Promise<ConnectedClientsResponse> {
  const data = await apiRequest<ConnectedClientsResponse>("/api/mikrotik/subscriptions/sync", { method: "POST" });
  return {
    ...data,
    devices: (data.devices || []).map(normalizeConnectedDevice),
  };
}

export async function applySubscriptionOnRouter(subscription: SubscriptionDraft): Promise<MikroTikApplyResponse> {
  return postMikroTikAction("/api/mikrotik/subscriptions/apply", subscription);
}

export async function resetSubscriptionQuotaOnRouter(subscription: SubscriptionDraft): Promise<MikroTikApplyResponse> {
  return postMikroTikAction("/api/mikrotik/subscriptions/reset-quota", subscription);
}
