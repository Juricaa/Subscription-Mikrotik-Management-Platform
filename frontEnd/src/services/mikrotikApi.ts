import type { SubscriptionDraft } from "../types";

export interface MikroTikApplyResponse {
  ok: boolean;
  applied?: boolean;
  reset?: boolean;
  message?: string;
  error?: {
    message?: string;
    statusCode?: number;
    detail?: unknown;
  };
}

async function postMikroTikAction(path: string, subscription: SubscriptionDraft): Promise<MikroTikApplyResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
  });

  const data = await response.json().catch(() => null) as MikroTikApplyResponse | null;
  if (!response.ok || !data?.ok) {
    const message = data?.error?.message || data?.message || `Erreur backend HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function applySubscriptionOnRouter(subscription: SubscriptionDraft): Promise<MikroTikApplyResponse> {
  return postMikroTikAction("/api/mikrotik/subscriptions/apply", subscription);
}

export async function resetSubscriptionQuotaOnRouter(subscription: SubscriptionDraft): Promise<MikroTikApplyResponse> {
  return postMikroTikAction("/api/mikrotik/subscriptions/reset-quota", subscription);
}
