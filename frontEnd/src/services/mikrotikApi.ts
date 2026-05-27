import type { Subscription, SubscriptionDraft } from "../types";

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
  const response = await fetch(path, {
    ...options,
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
  await fetch(`/api/subscriptions/${id}/`, { method: "DELETE" }).then((response) => {
    if (!response.ok && response.status !== 204) throw new Error(`Erreur suppression HTTP ${response.status}`);
  });
}

export async function applySubscriptionOnRouter(subscription: SubscriptionDraft): Promise<MikroTikApplyResponse> {
  return postMikroTikAction("/api/mikrotik/subscriptions/apply", subscription);
}

export async function resetSubscriptionQuotaOnRouter(subscription: SubscriptionDraft): Promise<MikroTikApplyResponse> {
  return postMikroTikAction("/api/mikrotik/subscriptions/reset-quota", subscription);
}
