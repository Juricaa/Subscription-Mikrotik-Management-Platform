import type { Subscription, LogEntry, ConnectedDevice } from "../types";

export const MOCK_SUBS: Subscription[] = [
  { id: "s001", clientName: "Hassan Ouédraogo",   mac: "DC:A6:32:7F:2E:01", ip: "192.168.1.101", rateLimit: "20M/10M",  status: "active",    expiresAt: "2026-06-30", comment: "Quartier Dapoya",        bytesIn: 142_398_000,   bytesOut: 32_100_000,  lastSeen: "2026-05-26 14:32" },
  { id: "s002", clientName: "Amina Traoré",        mac: "B8:27:EB:4C:9A:12", ip: "192.168.1.102", rateLimit: "10M/5M",   status: "active",    expiresAt: "2026-05-31", comment: "Zone commerciale",       bytesIn: 89_200_000,    bytesOut: 12_400_000,  lastSeen: "2026-05-26 13:18" },
  { id: "s003", clientName: "Jean-Baptiste Kaboré",mac: "F0:18:98:2B:D3:45", ip: "192.168.1.103", rateLimit: "50M/20M",  status: "suspended", expiresAt: "2026-05-20", comment: "Non-paiement",           bytesIn: 0,             bytesOut: 0,           lastSeen: "2026-05-20 08:45" },
  { id: "s004", clientName: "Fatimata Compaoré",   mac: "3C:22:FB:81:11:67", ip: "192.168.1.104", rateLimit: "100M/50M", status: "active",    expiresAt: "2026-07-15", comment: "Abonnement premium",     bytesIn: 1_240_000_000, bytesOut: 320_000_000, lastSeen: "2026-05-26 14:55" },
  { id: "s005", clientName: "Moussa Sawadogo",     mac: "A4:77:33:DC:6E:80", ip: "192.168.1.105", rateLimit: "20M/10M",  status: "expired",   expiresAt: "2026-04-30", comment: "Renouvellement en attente", bytesIn: 0,           bytesOut: 0,           lastSeen: "2026-04-30 23:59" },
  { id: "s006", clientName: "Roukiatou Diallo",    mac: "78:2B:CB:55:F1:C0", ip: "192.168.1.106", rateLimit: "10M/5M",   status: "active",    expiresAt: "2026-06-10", comment: "Résidentiel",            bytesIn: 56_300_000,    bytesOut: 8_900_000,   lastSeen: "2026-05-26 11:04" },
  { id: "s007", clientName: "Saidou Zongo",        mac: "C8:3A:35:0D:7B:22", ip: "192.168.1.107", rateLimit: "50M/20M",  status: "pending",   expiresAt: "2026-06-01", comment: "Installation en cours",  bytesIn: 0,             bytesOut: 0,           lastSeen: "—" },
  { id: "s008", clientName: "Mariam Coulibaly",    mac: "E4:F0:42:AA:3C:9F", ip: "192.168.1.108", rateLimit: "20M/10M",  status: "active",    expiresAt: "2026-06-25", comment: "Immeuble Liberté",       bytesIn: 234_000_000,   bytesOut: 47_800_000,  lastSeen: "2026-05-26 14:01" },
];

export const MOCK_LOGS: LogEntry[] = [
  { id: "l001", timestamp: "2026-05-26 14:55:12", action: "DHCP_ADD",     target: "192.168.1.108", operator: "admin",  result: "success", detail: "Bail statique créé pour Mariam Coulibaly (20M/10M)" },
  { id: "l002", timestamp: "2026-05-26 14:32:07", action: "RATE_MODIFY",  target: "192.168.1.101", operator: "admin",  result: "success", detail: "Rate-limit mis à jour: 10M/5M → 20M/10M" },
  { id: "l003", timestamp: "2026-05-26 13:18:44", action: "QUEUE_ADD",    target: "192.168.1.102", operator: "admin",  result: "success", detail: "Simple queue créée pour Amina Traoré" },
  { id: "l004", timestamp: "2026-05-26 11:30:02", action: "DHCP_SUSPEND", target: "192.168.1.103", operator: "system", result: "success", detail: "Suspension automatique pour non-paiement" },
  { id: "l005", timestamp: "2026-05-26 10:15:33", action: "DHCP_DELETE",  target: "192.168.1.109", operator: "admin",  result: "error",   detail: "Erreur MikroTik: bail introuvable (ID /ip/dhcp-server/lease/!xxx)" },
  { id: "l006", timestamp: "2026-05-25 23:59:01", action: "EXPIRE_CHECK", target: "192.168.1.105", operator: "system", result: "success", detail: "Abonnement expiré — cron job exécuté" },
  { id: "l007", timestamp: "2026-05-25 18:44:55", action: "QUEUE_REMOVE", target: "192.168.1.103", operator: "admin",  result: "success", detail: "Simple queue supprimée (suspension)" },
];

export const MOCK_CONNECTED: ConnectedDevice[] = [
  { mac: "DC:A6:32:7F:2E:01", ip: "192.168.1.101", hostname: "hassan-pc",       vendor: "Raspberry Pi",   rxBytes: 142_398_000, txBytes: 32_100_000, signalDbm: -52, connectedSince: "2026-05-26 06:12", interface: "wlan1", hasSubscription: true  },
  { mac: "B8:27:EB:4C:9A:12", ip: "192.168.1.102", hostname: "amina-phone",     vendor: "Samsung",        rxBytes: 89_200_000,  txBytes: 12_400_000, signalDbm: -67, connectedSince: "2026-05-26 08:45", interface: "wlan1", hasSubscription: true  },
  { mac: "3C:22:FB:81:11:67", ip: "192.168.1.104", hostname: "DESKTOP-F4T9K",   vendor: "Dell",           rxBytes: 1_240_000_000,txBytes:320_000_000, signalDbm: null,connectedSince: "2026-05-26 07:00", interface: "ether2", hasSubscription: true  },
  { mac: "78:2B:CB:55:F1:C0", ip: "192.168.1.106", hostname: "roukiatou-ipad",  vendor: "Apple",          rxBytes: 56_300_000,  txBytes: 8_900_000,  signalDbm: -71, connectedSince: "2026-05-26 09:30", interface: "wlan1", hasSubscription: true  },
  { mac: "E4:F0:42:AA:3C:9F", ip: "192.168.1.108", hostname: "mariam-laptop",   vendor: "Lenovo",         rxBytes: 234_000_000, txBytes: 47_800_000, signalDbm: -59, connectedSince: "2026-05-26 07:55", interface: "wlan1", hasSubscription: true  },
  { mac: "52:74:F2:B1:3D:AA", ip: "192.168.1.120", hostname: "android-9f3a",    vendor: "Tecno Mobile",   rxBytes: 12_400_000,  txBytes: 2_100_000,  signalDbm: -75, connectedSince: "2026-05-26 13:02", interface: "wlan1", hasSubscription: false },
  { mac: "1A:2C:D8:44:7E:F0", ip: "192.168.1.121", hostname: "iphone-diallo",   vendor: "Apple",          rxBytes: 8_900_000,   txBytes: 1_400_000,  signalDbm: -63, connectedSince: "2026-05-26 14:10", interface: "wlan1", hasSubscription: false },
  { mac: "C0:EE:FB:20:91:55", ip: "192.168.1.122", hostname: "unknown",         vendor: "TP-Link",        rxBytes: 3_200_000,   txBytes: 600_000,    signalDbm: -80, connectedSince: "2026-05-26 14:33", interface: "wlan2", hasSubscription: false },
  { mac: "88:D7:F6:0A:CC:31", ip: "192.168.1.123", hostname: "bureau-PC",       vendor: "HP",             rxBytes: 67_000_000,  txBytes: 9_800_000,  signalDbm: null,connectedSince: "2026-05-26 08:20", interface: "ether3", hasSubscription: false },
  { mac: "F4:60:E2:77:12:BC", ip: "192.168.1.124", hostname: "itel-phone",      vendor: "Itel",           rxBytes: 4_500_000,   txBytes: 800_000,    signalDbm: -88, connectedSince: "2026-05-26 14:50", interface: "wlan1", hasSubscription: false },
];

export const TRAFFIC_DATA = [
  { t: "00:00", in: 12, out: 3 }, { t: "02:00", in: 8, out: 2 }, { t: "04:00", in: 5, out: 1 },
  { t: "06:00", in: 18, out: 6 }, { t: "08:00", in: 45, out: 14 }, { t: "10:00", in: 82, out: 28 },
  { t: "12:00", in: 91, out: 33 }, { t: "14:00", in: 87, out: 30 }, { t: "16:00", in: 76, out: 25 },
  { t: "18:00", in: 94, out: 38 }, { t: "20:00", in: 88, out: 31 }, { t: "22:00", in: 52, out: 18 },
];

export const PLAN_DATA = [
  { plan: "10M/5M", count: 2 },
  { plan: "20M/10M", count: 3 },
  { plan: "50M/20M", count: 2 },
  { plan: "100M/50M", count: 1 },
];
