import type { ElementType } from "react";
import {
  Activity,
  LayoutDashboard,
  MonitorSmartphone,
  Router,
  Settings,
  Users,
} from "lucide-react";
import type { View } from "../types";

export interface NavItem {
  id: View;
  label: string;
  description: string;
  icon: ElementType;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Vue globale du réseau et des abonnements",
    icon: LayoutDashboard,
  },
  {
    id: "clients",
    label: "Clients connectés",
    description: "Appareils en ligne détectés par MikroTik",
    icon: MonitorSmartphone,
  },
  {
    id: "subscriptions",
    label: "Abonnements",
    description: "Plans, statuts, expirations et règles de débit",
    icon: Users,
  },
  {
    id: "router",
    label: "Routeur",
    description: "Connexion API, santé et métriques MikroTik",
    icon: Router,
  },
  {
    id: "logs",
    label: "Journaux",
    description: "Historique des actions Django → MikroTik",
    icon: Activity,
  },
  {
    id: "settings",
    label: "Paramètres",
    description: "Base de données, sécurité et automatisations",
    icon: Settings,
  },
];

export function getNavItem(view: View) {
  return NAV_ITEMS.find((item) => item.id === view) ?? NAV_ITEMS[0];
}
