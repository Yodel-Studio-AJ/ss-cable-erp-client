import { LayoutDashboard, Settings, Package, Building2, Users2, ShoppingCart, Factory, ClipboardList } from "lucide-react";
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
      { name: "Product Variants", href: "/inventory/products" },
    ],
  },
  {
    name: "Procurement",
    icon: ShoppingCart,
    children: [
      { name: "Purchase Orders", href: "/procurement/purchase-orders" },
    ],
  },
  {
    name: "Orders",
    icon: ClipboardList,
    children: [
      { name: "Quotes", href: "/sales/quotes" },
    ],
  },
  {
    name: "Manufacturing",
    icon: Factory,
    children: [
      { name: "BOM Calculator", href: "/manufacturing/bom" },
    ],
  },
  {
    name: "Parties",
    icon: Users2,
    children: [
      { name: "Customers", href: "/parties/customers" },
      { name: "Vendors", href: "/parties/vendors" },
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
