import { LayoutDashboard, Settings, Package, Building2, Users2 } from "lucide-react";
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
    name: "Parties",
    icon: Users2,
    children: [
      { name: "Customers", href: "/parties/customers" },
    ],
  },
  {
    name: "Organization",
    icon: Building2,
    children: [
      { name: "Branches", href: "/organization/branches" },
      { name: "Members", href: "/organization/members" },
      { name: "Attendance", href: "/organization/attendance" },
    ],
  },
  {
    name: "Settings",
    icon: Settings,
    children: [
      { name: "Owner Settings", href: "/settings/owner-settings" },
      { name: "Integration Settings", href: "/settings/integration-settings" },
    ],
  },
];
