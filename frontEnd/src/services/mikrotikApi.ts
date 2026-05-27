import type { LogEntry, Subscription, SubscriptionDraft } from "../types";

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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function getApiBaseUrl(): string {
  return API_BASE_URL || "proxy /api Vite";
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

async function readJson<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null) as Promise<T | null>;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(makeApiUrl(path), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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

export async function applySubscriptionOnRouter(subscription: SubscriptionDraft): Promise<MikroTikApplyResponse> {
  return postMikroTikAction("/api/mikrotik/subscriptions/apply", subscription);
}

export async function resetSubscriptionQuotaOnRouter(subscription: SubscriptionDraft): Promise<MikroTikApplyResponse> {
  return postMikroTikAction("/api/mikrotik/subscriptions/reset-quota", subscription);
}
