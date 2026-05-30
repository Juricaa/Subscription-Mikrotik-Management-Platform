from __future__ import annotations

import re
import unicodedata
from decimal import Decimal
from typing import Any

DEFAULT_QUOTA_GB = Decimal("100")
DEFAULT_QUOTA_INTERVAL = "5m"


def gb_to_bytes(gb: Any) -> int:
    value = Decimal(str(gb or 0))
    if value < 0:
        value = Decimal("0")
    return int(value * (1024 ** 3))


def _safe_name(value: Any) -> str:
    text = str(value or "client")
    normalized = unicodedata.normalize("NFD", text)
    without_accents = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    safe = re.sub(r"[^a-zA-Z0-9_-]+", "-", without_accents).strip("-")[:32]
    return safe or "client"


def _router_comment(value: Any) -> str:
    return str(value or "").replace('"', "'").strip()


def _required(data: dict[str, Any], key: str) -> str:
    value = str(data.get(key) or "").strip()
    if not value:
        raise ValueError(f"Champ obligatoire manquant: {key}")
    return value


def get_mikrotik_names(data: dict[str, Any]) -> dict[str, str]:
    user_key = _safe_name(f"{data.get('clientName') or data.get('client_name') or 'client'}-{data.get('ip') or 'ip'}")
    return {
        "queueName": f"sub-{user_key}",
        "scriptName": f"quota-check-{user_key}",
        "schedulerName": f"quota-scheduler-{user_key}",
    }


def subscription_to_script_payload(subscription: Any) -> dict[str, Any]:
    """Accept either a Django model instance or a raw dict from the React app."""
    if isinstance(subscription, dict):
        return dict(subscription)

    return {
        "id": str(subscription.id),
        "clientName": subscription.customer.name,
        "mac": subscription.mac,
        "ip": subscription.ip,
        "rateLimit": subscription.rate_limit,
        "status": subscription.status,
        "expiresAt": subscription.expires_at.isoformat() if subscription.expires_at else "non définie",
        "comment": subscription.comment,
        "dataLimitEnabled": subscription.data_limit_enabled,
        "dataLimitGb": float(subscription.data_limit_gb),
        "dataLimitBytes": subscription.data_limit_bytes,
        "dataLimitCheckInterval": subscription.data_limit_check_interval,
        "dataLimitAction": subscription.data_limit_action,
        "dataLimitReached": subscription.data_limit_reached,
        "bytesIn": subscription.bytes_in,
        "bytesOut": subscription.bytes_out,
    }


def build_subscription_apply_script(subscription: Any) -> str:
    data = subscription_to_script_payload(subscription)
    client_name = _required(data, "clientName")
    safe_client_name = _router_comment(client_name)
    ip = _required(data, "ip")
    mac = _required(data, "mac").upper()
    rate_limit = str(data.get("rateLimit") or data.get("rate_limit") or "10M/5M").strip()
    expires_at = str(data.get("expiresAt") or data.get("expires_at") or "non définie").strip()
    data_limit_enabled = bool(data.get("dataLimitEnabled") or data.get("data_limit_enabled"))
    quota_gb = Decimal(str(data.get("dataLimitGb") or data.get("data_limit_gb") or DEFAULT_QUOTA_GB))
    if quota_gb <= 0:
        quota_gb = DEFAULT_QUOTA_GB
    quota_bytes = int(data.get("dataLimitBytes") or data.get("data_limit_bytes") or gb_to_bytes(quota_gb))
    check_interval = str(data.get("dataLimitCheckInterval") or data.get("data_limit_check_interval") or DEFAULT_QUOTA_INTERVAL).strip()
    names = get_mikrotik_names({"clientName": client_name, "ip": ip})
    queue_name = names["queueName"]
    script_name = names["scriptName"]
    scheduler_name = names["schedulerName"]
    comment = _router_comment(
        f"SubManager {client_name} | MAC {mac} | expiration {expires_at}"
        + (f" | quota {quota_gb}Go" if data_limit_enabled else " | quota illimité")
    )

    common_script = f'''# Script généré par Subscription MikroTik Management Platform - Django backend.
# Date d'expiration conservée dans le commentaire MikroTik.
# Client: {safe_client_name}
# IP: {ip}
# MAC: {mac}

/ip firewall filter
:if ([:len [find where comment="AUTO-QUOTA-BLOCK-SUBMANAGER"]] = 0) do={{
  add chain=forward src-address-list=quota-blocked action=drop comment="AUTO-QUOTA-BLOCK-SUBMANAGER"
}}

/ip firewall address-list
:foreach item in=[find where list="quota-blocked" address="{ip}"] do={{ remove $item }}

/queue simple
:if ([:len [find where name="{queue_name}"]] = 0) do={{
  add name="{queue_name}" target={ip}/32 max-limit={rate_limit} comment="{comment}"
}} else={{
  set [find where name="{queue_name}"] target={ip}/32 max-limit={rate_limit} comment="{comment}" disabled=no
}}'''

    if not data_limit_enabled:
        return f'''{common_script}

/system scheduler
:foreach task in=[find where name="{scheduler_name}"] do={{ remove $task }}

/system script
:foreach script in=[find where name="{script_name}"] do={{ remove $script }}

:log info "SubManager Django: abonnement {safe_client_name} appliqué sans quota data"'''

    return f'''{common_script}

/system script
:foreach script in=[find where name="{script_name}"] do={{ remove $script }}
add name="{script_name}" policy=read,write,test source={{
  :local queueName "{queue_name}";
  :local userIp "{ip}";
  :local quotaBytes {quota_bytes};

  :local qid [/queue simple find where name=$queueName];
  :if ([:len $qid] = 0) do={{
    :log warning ("SubManager quota: queue introuvable " . $queueName);
    :return;
  }}

  :local bytes [/queue simple get $qid bytes];
  :local slash [:find $bytes "/"];
  :local upload 0;
  :local download 0;

  :if ($slash != nil) do={{
    :set upload [:tonum [:pick $bytes 0 $slash]];
    :set download [:tonum [:pick $bytes ($slash + 1) [:len $bytes]]];
  }}

  :local total ($upload + $download);

  :if ($total >= $quotaBytes) do={{
    :if ([:len [/ip firewall address-list find where list="quota-blocked" address=$userIp]] = 0) do={{
      /ip firewall address-list add list=quota-blocked address=$userIp comment=("Quota atteint - " . $queueName);
    }}
    /queue simple set $qid disabled=yes;
    :log warning ("SubManager Django: quota data atteint pour " . $userIp . " total=" . $total . " bytes");
  }}
}}

/system scheduler
:foreach task in=[find where name="{scheduler_name}"] do={{ remove $task }}
add name="{scheduler_name}" interval={check_interval} on-event="{script_name}" comment="SubManager quota {quota_gb}Go - {queue_name}"

:log info "SubManager Django: abonnement {safe_client_name} appliqué avec quota {quota_gb}Go"'''


def build_quota_reset_script(subscription: Any) -> str:
    """Reset quota counters and re-apply the latest plan/quota on RouterOS.

    This function is intentionally based on build_subscription_apply_script() so a renewal
    can change the plan, expiration and quota in one transaction. If quota is disabled,
    the generated apply script removes the quota scheduler/script from MikroTik.
    """
    data = subscription_to_script_payload(subscription)
    client_name = _required(data, "clientName")
    ip = _required(data, "ip")
    expires_at = str(data.get("expiresAt") or data.get("expires_at") or "non définie").strip()
    data_limit_enabled = bool(data.get("dataLimitEnabled") or data.get("data_limit_enabled"))
    quota_gb = Decimal(str(data.get("dataLimitGb") or data.get("data_limit_gb") or 0))
    names = get_mikrotik_names({"clientName": client_name, "ip": ip})
    queue_name = names["queueName"]
    safe_client_name = _router_comment(client_name)

    apply_script = build_subscription_apply_script(data)
    quota_label = f"quota {quota_gb}Go" if data_limit_enabled and quota_gb > 0 else "quota désactivé"

    return f'''{apply_script}

# Reset final après renouvellement.
# Le plan, l'expiration et le quota ci-dessus ont déjà été appliqués.
/ip firewall address-list
:foreach item in=[find where list="quota-blocked" address="{ip}"] do={{ remove $item }}

/queue simple
:local qid [find where name="{queue_name}"];
:if ([:len $qid] > 0) do={{
  reset-counters $qid;
  set $qid disabled=no;
}} else={{
  :log warning "SubManager Django reset quota: Simple Queue introuvable {queue_name}";
}}

:log info "SubManager Django: renouvellement appliqué pour {safe_client_name} ({ip}) - expiration {expires_at} - {quota_label}"'''
