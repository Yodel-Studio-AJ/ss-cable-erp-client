import { LayoutDashboard, Settings, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavChild {
  name: string;
  href: string;
}

export interface NavItem {
  name: string;
  icon: LucideIcon;
  href?: string;
  children?: NavChild[];
}

export const navItems: NavItem[] = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    name: "Products",
    icon: Package,
    children: [
      { name: "Product Groups", href: "/inventory/product-groups" },
    ],
  },
  {
    name: "Settings",
    icon: Settings,
    children: [
      { name: "Owner Settings", href: "/settings/owner-settings" },
      { name: "Organization", href: "/settings/organization" },
      { name: "Integration Settings", href: "/settings/integration-settings" },
    ],
  },
];
