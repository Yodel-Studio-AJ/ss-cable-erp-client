"use client";

import { useAuthStore } from "@/store/authStore";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <h1 className="text-xl font-semibold text-black dark:text-white">Dashboard</h1>
      <p className="text-[#888] text-sm mt-1">
        Welcome back, {user?.name ?? "—"}
      </p>
    </div>
  );
}
