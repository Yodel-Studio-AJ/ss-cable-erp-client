"use client";

import { Menu } from "lucide-react";

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header
      style={{
        backgroundColor: "var(--color-bg-topbar)",
        borderBottomColor: "var(--color-border)",
        color: "var(--color-text-primary)",
      }}
      className="h-12 border-b flex items-center px-4 gap-4 shrink-0 z-50">
      <button
        onClick={onMenuClick}
        style={{ color: "var(--color-text-nav)" }}
        className="lg:hidden p-1 rounded transition-colors hover:opacity-70">
        <Menu size={20} />
      </button>
      <span className="font-semibold text-sm tracking-wide">SS Cable ERP</span>
    </header>
  );
}
