import type { Subscription } from "../types";

export const DEFAULT_QUOTA_GB = 100;
export const DEFAULT_QUOTA_INTERVAL = "5m";

export function gbToBytes(gb: number): number {
  return Math.max(0, Math.round(gb * 1024 ** 3));
}

export function bytesToGb(bytes: number): number {
  return bytes / 1024 ** 3;
}

export function getSubscriptionUsage(sub: Pick<Subscription, "bytesIn" | "bytesOut">): number {
  return (sub.bytesIn || 0) + (sub.bytesOut || 0);
}

export function getQuotaBytes(sub: Pick<Subscription, "dataLimitGb" | "dataLimitBytes">): number {
  if (typeof sub.dataLimitBytes === "number" && sub.dataLimitBytes > 0) return sub.dataLimitBytes;
  if (typeof sub.dataLimitGb === "number" && sub.dataLimitGb > 0) return gbToBytes(sub.dataLimitGb);
  return 0;
}

export function getQuotaPercent(sub: Pick<Subscription, "bytesIn" | "bytesOut" | "dataLimitGb" | "dataLimitBytes">): number {
  const limit = getQuotaBytes(sub);
  if (!limit) return 0;
  return Math.min(100, Math.round((getSubscriptionUsage(sub) / limit) * 100));
}

function safeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "client";
}

function routerComment(value: string): string {
  return value.replace(/"/g, "'").trim();
}

export function getMikroTikNames(data: Pick<Subscription, "clientName" | "ip">) {
  const userKey = safeName(`${data.clientName || "client"}-${data.ip || "ip"}`);
  return {
    queueName: `sub-${userKey}`,
    scriptName: `quota-check-${userKey}`,
    schedulerName: `quota-scheduler-${userKey}`,
  };
}

export function buildQuotaScriptPreview(data: Partial<Subscription>): string {
  const clientName = data.clientName || "Client";
  const ip = data.ip || "192.168.1.xxx";
  const rateLimit = data.rateLimit || "10M/5M";
  const expiresAt = data.expiresAt || "non définie";
  const quotaGb = Number(data.dataLimitGb || DEFAULT_QUOTA_GB);
  const quotaBytes = Number(data.dataLimitBytes || gbToBytes(quotaGb));
  const checkInterval = data.dataLimitCheckInterval || DEFAULT_QUOTA_INTERVAL;
  const { queueName, scriptName, schedulerName } = getMikroTikNames({ clientName, ip });
  const comment = routerComment(`SubManager ${clientName} | expiration ${expiresAt} | quota ${quotaGb}Go`);

  return `# Création / mise à jour de l'abonnement sans modifier la date d'expiration.
# Client: ${clientName}
# IP: ${ip}
# Quota data: ${quotaGb} Go (${quotaBytes} bytes)

/ip firewall filter
:if ([:len [find where comment="AUTO-QUOTA-BLOCK-SUBMANAGER"]] = 0) do={
  add chain=forward src-address-list=quota-blocked action=drop comment="AUTO-QUOTA-BLOCK-SUBMANAGER"
}

/queue simple
:if ([:len [find where name="${queueName}"]] = 0) do={
  add name="${queueName}" target=${ip}/32 max-limit=${rateLimit} comment="${comment}"
} else={
  set [find where name="${queueName}"] target=${ip}/32 max-limit=${rateLimit} comment="${comment}" disabled=no
}

/system script
:if ([:len [find where name="${scriptName}"]] > 0) do={ remove [find where name="${scriptName}"] }
add name="${scriptName}" policy=read,write,test source={
  :local queueName "${queueName}";
  :local userIp "${ip}";
  :local quotaBytes ${quotaBytes};

  :local qid [/queue simple find where name=$queueName];
  :if ([:len $qid] = 0) do={
    :log warning ("Quota data: queue introuvable " . $queueName);
    :return;
  }

  :local bytes [/queue simple get $qid bytes];
  :local slash [:find $bytes "/"];
  :local upload 0;
  :local download 0;

  :if ($slash != nil) do={
    :set upload [:tonum [:pick $bytes 0 $slash]];
    :set download [:tonum [:pick $bytes ($slash + 1) [:len $bytes]]];
  }

  :local total ($upload + $download);

  :if ($total >= $quotaBytes) do={
    :if ([:len [/ip firewall address-list find where list="quota-blocked" address=$userIp]] = 0) do={
      /ip firewall address-list add list=quota-blocked address=$userIp comment=("Quota atteint - " . $queueName);
    }
    /queue simple set $qid disabled=yes;
    :log warning ("Quota data atteint pour " . $userIp . " total=" . $total . " bytes");
  }
}

/system scheduler
:if ([:len [find where name="${schedulerName}"]] > 0) do={ remove [find where name="${schedulerName}"] }
add name="${schedulerName}" interval=${checkInterval} on-event="${scriptName}" comment="Vérifie le quota data de ${queueName}"`;
}
