from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Any

from django.utils import timezone

from .mikrotik_client import MikroTikError, router_request
from .models import ClientSession, Subscription


def normalize_mac(value: Any) -> str:
    text = str(value or "").strip().upper().replace("-", ":")
    if not text:
        return ""
    parts = [part.zfill(2) for part in re.split(r"[^0-9A-Fa-f]", text) if part]
    if len(parts) == 6:
        return ":".join(parts).upper()
    return text


def parse_int(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default


def parse_byte_pair(value: Any) -> tuple[int, int]:
    """RouterOS usually returns queue bytes as 'upload/download'."""
    if value is None:
        return 0, 0
    if isinstance(value, (int, float)):
        return int(value), 0
    text = str(value).strip()
    if not text:
        return 0, 0
    if "/" in text:
        left, right = text.split("/", 1)
        return parse_int(left), parse_int(right)
    return parse_int(text), 0


def parse_signal(value: Any) -> int | None:
    if value is None or value == "":
        return None
    match = re.search(r"-?\d+", str(value))
    return int(match.group(0)) if match else None


def target_contains_ip(target: Any, ip: str) -> bool:
    if not target or not ip:
        return False
    values = target if isinstance(target, list) else str(target).split(",")
    for item in values:
        cleaned = str(item).strip().split("/")[0]
        if cleaned == ip:
            return True
    return False


SOURCE_PRIORITY = {
    "arp": 10,
    "dhcp": 20,
    "queue": 30,
    "ppp": 70,
    "hotspot": 82,
    "hotspot-host": 82,
    "capsman": 85,
    "wifi": 90,
}
GENERIC_SOURCES = {"arp", "dhcp", "queue"}
PRECISE_ONLINE_SOURCES = {"hotspot", "hotspot-host", "ppp", "wifi", "capsman"}


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def source_priority(source: Any) -> int:
    return SOURCE_PRIORITY.get(str(source or "").lower(), 0)


def is_wifi_source(source: Any, interface: Any = "") -> bool:
    text = f"{source or ''} {interface or ''}".lower()
    wifi_tokens = ("wifi", "wlan", "wireless", "capsman", "cap")
    if any(token in text for token in wifi_tokens):
        return True
    # Dans ce projet, les utilisateurs Hotspot affichés dans Winbox > IP > Hotspot > Hosts
    # correspondent aux clients WiFi gérés par le routeur. On le laisse configurable
    # pour les installations où le Hotspot serait aussi utilisé sur Ethernet.
    return env_bool("MIKROTIK_TREAT_HOTSPOT_AS_WIFI", True) and "hotspot" in text


def sorted_sources(sources: set[str]) -> list[str]:
    return sorted((str(item) for item in sources if item), key=lambda item: source_priority(item), reverse=True)


def primary_source_label(sources: set[str]) -> str:
    ordered = sorted_sources(sources)
    if not ordered:
        return "routeros"
    return ordered[0]


def router_list(endpoint: str, errors: list[str]) -> list[dict[str, Any]]:
    try:
        result = router_request("GET", endpoint)
        if isinstance(result, list):
            return [item for item in result if isinstance(item, dict)]
        if isinstance(result, dict):
            return [result]
        return []
    except MikroTikError as exc:
        # Some endpoints are optional depending on RouterOS packages/configuration.
        errors.append(f"{endpoint}: {exc}")
        return []
    except Exception as exc:  # pragma: no cover - defensive for unknown RouterOS payloads
        errors.append(f"{endpoint}: {exc}")
        return []


@dataclass
class RealDevice:
    ip: str = ""
    mac: str = ""
    hostname: str = ""
    interface: str = ""
    rx_bytes: int = 0
    tx_bytes: int = 0
    signal_dbm: int | None = None
    connected_since: str = "—"
    source: set[str] = field(default_factory=set)
    blocked: bool = False
    best_source_priority: int = 0
    access_type: str = "unknown"

    def merge(self, **kwargs: Any) -> None:
        incoming_source = kwargs.get("source")
        incoming_priority = source_priority(incoming_source)
        incoming_interface = kwargs.get("interface")

        if incoming_source:
            self.source.add(str(incoming_source))
        if is_wifi_source(incoming_source, incoming_interface):
            self.access_type = "wifi"
        elif self.access_type == "unknown" and str(incoming_source or "").lower() in {"arp", "dhcp", "queue"}:
            self.access_type = "ethernet_or_lan"

        # ARP/DHCP see every client on the LAN, including WiFi clients.
        # If a more precise table later identifies the same MAC/IP as WiFi, replace
        # the generic ARP/DHCP label/interface so the UI shows the real access type.
        should_prefer_incoming = incoming_priority >= self.best_source_priority
        if incoming_priority > self.best_source_priority:
            self.best_source_priority = incoming_priority

        for key, value in kwargs.items():
            if key == "source":
                continue
            if key in {"rx_bytes", "tx_bytes"}:
                current = getattr(self, key)
                setattr(self, key, max(int(current or 0), int(value or 0)))
                continue
            if key == "signal_dbm":
                if value is not None:
                    self.signal_dbm = int(value)
                continue
            if key == "blocked":
                self.blocked = self.blocked or bool(value)
                continue
            if value in (None, ""):
                continue
            if key in {"hostname", "interface", "connected_since"}:
                current = getattr(self, key)
                if should_prefer_incoming or not current or current in {"arp", "bridge", "dhcp", "Client ARP", "Client DHCP", "ARP actif", "DHCP actif", "—"}:
                    setattr(self, key, str(value))
                continue
            if not getattr(self, key):
                setattr(self, key, str(value))


def device_key(mac: str = "", ip: str = "") -> str:
    normalized_mac = normalize_mac(mac)
    if normalized_mac:
        return f"mac:{normalized_mac}"
    return f"ip:{ip}"


def upsert(devices: dict[str, RealDevice], mac: Any = "", ip: Any = "", **kwargs: Any) -> RealDevice | None:
    normalized_mac = normalize_mac(mac)
    ip_text = str(ip or "").strip()
    if not normalized_mac and not ip_text:
        return None

    # Reuse an existing item if IP or MAC was discovered from another RouterOS table.
    key = device_key(normalized_mac, ip_text)
    existing_key = None
    for candidate_key, candidate in devices.items():
        if normalized_mac and candidate.mac == normalized_mac:
            existing_key = candidate_key
            break
        if ip_text and candidate.ip == ip_text:
            existing_key = candidate_key
            break
    if existing_key:
        key = existing_key

    device = devices.setdefault(key, RealDevice(ip=ip_text, mac=normalized_mac))
    if normalized_mac and not device.mac:
        device.mac = normalized_mac
    if ip_text and not device.ip:
        device.ip = ip_text
    device.merge(**kwargs)
    return device


def queue_usage_by_ip_or_name(queues: list[dict[str, Any]]) -> tuple[dict[str, tuple[int, int]], dict[str, tuple[int, int]]]:
    by_ip: dict[str, tuple[int, int]] = {}
    by_name: dict[str, tuple[int, int]] = {}
    for queue in queues:
        upload, download = parse_byte_pair(queue.get("bytes") or queue.get("total-bytes"))
        tx, rx = upload, download
        name = str(queue.get("name") or "")
        if name:
            by_name[name] = (rx, tx)
        target = queue.get("target") or queue.get("targets") or ""
        for raw in str(target).split(","):
            ip = raw.strip().split("/")[0]
            if ip:
                by_ip[ip] = (rx, tx)
    return by_ip, by_name


def collect_realtime_clients(sync_database: bool = True, include_generic: bool = False) -> dict[str, Any]:
    include_generic = bool(include_generic or env_bool("MIKROTIK_SHOW_GENERIC_ARP_CLIENTS", False))
    errors: list[str] = []
    devices: dict[str, RealDevice] = {}

    leases = router_list("/ip/dhcp-server/lease", errors)
    arp_items = router_list("/ip/arp", errors)
    hotspot_active = router_list("/ip/hotspot/active", errors)
    hotspot_hosts = router_list("/ip/hotspot/host", errors)
    ppp_active = router_list("/ppp/active", errors)
    simple_queues = router_list("/queue/simple", errors)
    # Wireless clients are only visible in registration tables when this RouterOS
    # device is the WiFi AP/CAPsMAN controller. If APs are external/bridged, RouterOS
    # may only expose those devices through DHCP/ARP.
    wireless_legacy_registrations = router_list("/interface/wireless/registration-table", errors)
    wifi_registrations = router_list("/interface/wifi/registration-table", errors)
    wifiwave2_registrations = router_list("/interface/wifiwave2/registration-table", errors)
    capsman_registrations = router_list("/caps-man/registration-table", errors)
    address_lists = router_list("/ip/firewall/address-list", errors)

    blocked_ips = {
        str(item.get("address") or "").split("/")[0]
        for item in address_lists
        if str(item.get("list") or "") == "quota-blocked" and item.get("address")
    }

    for lease in leases:
        status = str(lease.get("status") or "").lower()
        ip = lease.get("active-address") or lease.get("address")
        mac = lease.get("active-mac-address") or lease.get("mac-address")
        if not ip or (status and status not in {"bound", "active", "offered"} and not lease.get("active-address")):
            continue
        upsert(
            devices,
            mac=mac,
            ip=ip,
            hostname=lease.get("host-name") or lease.get("comment") or "Client DHCP",
            interface=lease.get("server") or lease.get("interface") or "dhcp",
            connected_since=lease.get("last-seen") or lease.get("expires-after") or "DHCP actif",
            source="dhcp",
            blocked=str(ip).split("/")[0] in blocked_ips,
        )

    for arp in arp_items:
        if str(arp.get("complete") or "true").lower() == "false":
            continue
        upsert(
            devices,
            mac=arp.get("mac-address"),
            ip=arp.get("address"),
            hostname=arp.get("comment") or "Client ARP",
            interface=arp.get("interface") or "arp",
            connected_since="ARP actif",
            source="arp",
            blocked=str(arp.get("address") or "").split("/")[0] in blocked_ips,
        )

    for active in hotspot_active:
        upsert(
            devices,
            mac=active.get("mac-address"),
            ip=active.get("address"),
            hostname=active.get("user") or active.get("host-name") or "Hotspot",
            interface=active.get("server") or "hotspot",
            rx_bytes=parse_int(active.get("bytes-in")),
            tx_bytes=parse_int(active.get("bytes-out")),
            connected_since=active.get("uptime") or "Hotspot actif",
            source="hotspot",
            blocked=str(active.get("address") or "").split("/")[0] in blocked_ips,
        )

    for host in hotspot_hosts:
        ip = host.get("address") or host.get("to-address")
        mac = host.get("mac-address")
        if not ip or not mac:
            continue
        upsert(
            devices,
            mac=mac,
            ip=ip,
            hostname=host.get("user") or host.get("host-name") or host.get("comment") or "Client Hotspot",
            interface=host.get("server") or host.get("interface") or "hotspot",
            rx_bytes=parse_int(host.get("bytes-in") or host.get("rx-bytes")),
            tx_bytes=parse_int(host.get("bytes-out") or host.get("tx-bytes")),
            connected_since=host.get("uptime") or host.get("idle-time") or "Hotspot actif",
            source="hotspot",
            blocked=str(ip).split("/")[0] in blocked_ips or str(host.get("to-address") or "").split("/")[0] in blocked_ips,
        )

    for active in ppp_active:
        caller = active.get("caller-id") or active.get("mac-address") or ""
        mac = caller if ":" in str(caller) or "-" in str(caller) else ""
        upsert(
            devices,
            mac=mac,
            ip=active.get("address"),
            hostname=active.get("name") or "PPP",
            interface=active.get("service") or "ppp",
            rx_bytes=parse_int(active.get("bytes-in")),
            tx_bytes=parse_int(active.get("bytes-out")),
            connected_since=active.get("uptime") or "PPP actif",
            source="ppp",
            blocked=str(active.get("address") or "").split("/")[0] in blocked_ips,
        )

    def merge_wifi_registration(wifi: dict[str, Any], source: str) -> None:
        upsert(
            devices,
            mac=wifi.get("mac-address") or wifi.get("mac") or wifi.get("client-mac-address"),
            ip=wifi.get("last-ip") or wifi.get("address") or wifi.get("ip-address"),
            hostname=wifi.get("comment") or wifi.get("ssid") or "Client WiFi",
            interface=wifi.get("interface") or wifi.get("radio") or source,
            rx_bytes=parse_int(wifi.get("rx-bytes") or wifi.get("bytes-in") or wifi.get("packets-in")),
            tx_bytes=parse_int(wifi.get("tx-bytes") or wifi.get("bytes-out") or wifi.get("packets-out")),
            signal_dbm=parse_signal(wifi.get("signal-strength") or wifi.get("signal") or wifi.get("rx-signal")),
            connected_since=wifi.get("uptime") or wifi.get("last-seen") or "WiFi actif",
            source=source,
        )

    for wifi in wireless_legacy_registrations:
        merge_wifi_registration(wifi, "wifi")
    for wifi in [*wifi_registrations, *wifiwave2_registrations]:
        merge_wifi_registration(wifi, "wifi")
    for wifi in capsman_registrations:
        merge_wifi_registration(wifi, "capsman")

    queue_by_ip, queue_by_name = queue_usage_by_ip_or_name(simple_queues)
    subscriptions = list(Subscription.objects.select_related("customer").all())
    by_mac = {normalize_mac(sub.mac): sub for sub in subscriptions if sub.mac}
    by_ip = {str(sub.ip): sub for sub in subscriptions if sub.ip}
    seen_subscription_ids: set[str] = set()
    now = timezone.now()

    # Merge Simple Queue counters only into devices that are already seen as connected.
    # A Simple Queue can remain present for an offline subscriber; it must not create a
    # fake connected client in the UI.
    for ip, (rx, tx) in queue_by_ip.items():
        sub = by_ip.get(ip)
        if not sub:
            continue
        already_online = any(device.ip == ip or (sub.mac and device.mac == normalize_mac(sub.mac)) for device in devices.values())
        if already_online:
            upsert(
                devices,
                mac=sub.mac,
                ip=ip,
                hostname=sub.customer.name,
                interface="simple-queue",
                rx_bytes=rx,
                tx_bytes=tx,
                connected_since="Queue active",
                source="queue",
                blocked=ip in blocked_ips,
            )

    has_precise_online_source = any(
        {str(source).lower() for source in device.source} & PRECISE_ONLINE_SOURCES
        for device in devices.values()
    )

    output: list[dict[str, Any]] = []
    for device in devices.values():
        device_sources = {str(source).lower() for source in device.source}
        subscription = by_mac.get(normalize_mac(device.mac)) or by_ip.get(device.ip)
        if (
            not include_generic
            and has_precise_online_source
            and device_sources
            and device_sources.issubset(GENERIC_SOURCES)
            and not subscription
        ):
            continue
        if subscription:
            seen_subscription_ids.add(str(subscription.id))
            # Prefer queue counters because they are the quota reference.
            queue_usage = queue_by_name.get(subscription.mikrotik_queue_name) or queue_by_ip.get(str(subscription.ip))
            if queue_usage:
                device.rx_bytes = max(device.rx_bytes, queue_usage[0])
                device.tx_bytes = max(device.tx_bytes, queue_usage[1])

            if sync_database:
                subscription.bytes_in = int(device.rx_bytes or 0)
                subscription.bytes_out = int(device.tx_bytes or 0)
                subscription.last_seen = now
                subscription.data_limit_reached = bool(device.blocked) or (
                    bool(subscription.data_limit_enabled)
                    and int(subscription.data_limit_bytes or 0) > 0
                    and subscription.usage_bytes >= int(subscription.data_limit_bytes or 0)
                )
                subscription.save(update_fields=["bytes_in", "bytes_out", "last_seen", "data_limit_reached", "updated_at"])
                session = (
                    ClientSession.objects.filter(subscription=subscription, status=ClientSession.STATUS_ONLINE)
                    .order_by("-started_at")
                    .first()
                )
                if session:
                    session.ip = device.ip or subscription.ip
                    session.mac = device.mac or subscription.mac
                    session.rx_bytes = int(device.rx_bytes or 0)
                    session.tx_bytes = int(device.tx_bytes or 0)
                    session.interface = device.interface or session.interface
                    session.hostname = device.hostname or session.hostname
                    session.save(update_fields=["ip", "mac", "rx_bytes", "tx_bytes", "interface", "hostname", "updated_at"])
                else:
                    ClientSession.objects.create(
                        subscription=subscription,
                        ip=device.ip or subscription.ip,
                        mac=device.mac or subscription.mac,
                        rx_bytes=int(device.rx_bytes or 0),
                        tx_bytes=int(device.tx_bytes or 0),
                        interface=device.interface,
                        hostname=device.hostname,
                        status=ClientSession.STATUS_ONLINE,
                    )

        primary_source = primary_source_label(device.source)
        source_details = ", ".join(sorted_sources(device.source))
        source_label = primary_source
        access_type = "wifi" if device.access_type == "wifi" or is_wifi_source(source_details or source_label, device.interface) else "ethernet_or_lan"
        output.append(
            {
                "mac": device.mac,
                "ip": device.ip,
                "hostname": subscription.customer.name if subscription else (device.hostname or "Client inconnu"),
                "vendor": source_label,
                "source": source_label,
                "sourceDetails": source_details,
                "accessType": access_type,
                "isWireless": access_type == "wifi",
                "rxBytes": int(device.rx_bytes or 0),
                "txBytes": int(device.tx_bytes or 0),
                "signalDbm": device.signal_dbm,
                "connectedSince": device.connected_since or "—",
                "interface": device.interface or ("wifi" if access_type == "wifi" else "—"),
                "hasSubscription": bool(subscription),
                "subscriptionId": str(subscription.id) if subscription else None,
                "clientName": subscription.customer.name if subscription else "",
                "status": subscription.status if subscription else "unsubscribed",
                "dataLimitEnabled": bool(subscription.data_limit_enabled) if subscription else False,
                "dataLimitReached": bool(subscription.data_limit_reached) if subscription else bool(device.blocked),
                "quotaLimitBytes": int(subscription.data_limit_bytes or 0) if subscription else 0,
                "quotaUsageBytes": int(subscription.usage_bytes) if subscription else int(device.rx_bytes or 0) + int(device.tx_bytes or 0),
            }
        )

    if sync_database:
        ClientSession.objects.filter(status=ClientSession.STATUS_ONLINE).exclude(subscription_id__in=seen_subscription_ids).update(
            status=ClientSession.STATUS_OFFLINE,
            ended_at=now,
        )

    output.sort(key=lambda item: (not item["hasSubscription"], item.get("hostname") or item.get("ip") or ""))
    return {
        "devices": output,
        "sources": {
            "dhcpLeases": len(leases),
            "arpEntries": len(arp_items),
            "hotspotActive": len(hotspot_active),
            "hotspotHosts": len(hotspot_hosts),
            "pppActive": len(ppp_active),
            "simpleQueues": len(simple_queues),
            "wifiRegistrations": len(wireless_legacy_registrations) + len(wifi_registrations) + len(wifiwave2_registrations),
            "capsmanRegistrations": len(capsman_registrations),
            "blockedIps": len(blocked_ips),
        },
        "errors": errors,
        "syncedAt": now.isoformat(),
    }
