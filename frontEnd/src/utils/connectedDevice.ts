import type { ConnectedDevice } from "../types";

export type ConnectedAccessKind = "wifi" | "ethernet" | "unknown";

const WIFI_INTERFACE_RE = /(wlan|wifi|wireless|capsman|caps-man|(^|[^a-z0-9])cap\d*([^a-z0-9]|$))/i;
const ETHERNET_INTERFACE_RE = /(ether|rj45|bridge|(^|[^a-z0-9])lan\d*([^a-z0-9]|$))/i;

function sourceText(device: ConnectedDevice): string {
  return `${device.source || ""} ${device.sourceDetails || ""} ${device.vendor || ""}`.toLowerCase();
}

export function getConnectedDeviceAccessKind(device: ConnectedDevice): ConnectedAccessKind {
  const interfaceName = String(device.interface || "");
  const source = sourceText(device);

  if (device.isWireless || device.accessType === "wifi") return "wifi";
  if (device.accessType === "ethernet_or_lan") return "ethernet";
  if (WIFI_INTERFACE_RE.test(interfaceName) || /(wifi|wireless|capsman|caps-man)/i.test(source)) return "wifi";
  if (ETHERNET_INTERFACE_RE.test(interfaceName) || /\b(dhcp|arp|queue|ppp)\b/i.test(source)) return "ethernet";
  return "unknown";
}

export function isWifiDevice(device: ConnectedDevice): boolean {
  return getConnectedDeviceAccessKind(device) === "wifi";
}

export function isEthernetDevice(device: ConnectedDevice): boolean {
  return getConnectedDeviceAccessKind(device) === "ethernet";
}

export function getConnectedDeviceAccessLabel(device: ConnectedDevice): string {
  const kind = getConnectedDeviceAccessKind(device);
  if (kind === "wifi") return "WiFi";
  if (kind === "ethernet") return "RJ45";
  return "Inconnu";
}

export function getConnectedDeviceName(device: ConnectedDevice): string {
  return String(device.clientName || device.hostname || device.ip || device.mac || "Client inconnu");
}

export function getConnectedDeviceTraffic(device: ConnectedDevice): number {
  return Number(device.rxBytes || 0) + Number(device.txBytes || 0);
}
