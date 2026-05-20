"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { isTokenExpired } from "@/utils/token";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || isTokenExpired(token)) {
      logout();
      router.replace("/login");
    }
  }, [hydrated, token, logout, router]);

  if (!hydrated) return null;
  if (!token || isTokenExpired(token)) return null;

  return (
    <div
      style={{
        backgroundColor: "var(--color-bg-page)",
        color: "var(--color-text-primary)",
      }}
      className="flex flex-col h-screen overflow-hidden">
      <Topbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          minimized={minimized}
          onClose={() => setSidebarOpen(false)}
          onToggleMinimize={() => setMinimized((v) => !v)}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
