"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { getAttendanceSettings, updateAttendanceSetting } from "@/api/attendance";
import type { AttendanceSettingUser } from "@/types/attendance";

interface Props {
  onClose: () => void;
}

const ROLE_ORDER = ["owner", "admin", "floor_manager", "member"];

function sortUsers(users: AttendanceSettingUser[]) {
  return [...users].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name)
  );
}

export default function AttendanceSettingsModal({ onClose }: Props) {
  const [users, setUsers]       = useState<AttendanceSettingUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    getAttendanceSettings()
      .then((data) => setUsers(sortUsers(data)))
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (u: AttendanceSettingUser) => {
    setToggling(u.userId);
    try {
      await updateAttendanceSetting(u.userId, !u.isAlwaysPresent);
      setUsers((prev) =>
        prev.map((x) => (x.userId === u.userId ? { ...x, isAlwaysPresent: !x.isAlwaysPresent } : x))
      );
    } catch {
      setError("Failed to update setting");
    } finally {
      setToggling(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
        className="border rounded-xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div
          style={{ borderBottomColor: "var(--color-border)" }}
          className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 style={{ color: "var(--color-text-primary)" }} className="text-base font-semibold">
              Attendance Settings
            </h2>
            <p style={{ color: "var(--color-text-muted)" }} className="text-[11px] mt-0.5">
              Always-present users are auto-marked daily
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ color: "var(--color-text-muted)" }}
            className="p-1.5 rounded-lg hover:opacity-70 transition-opacity">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 gap-2">
              <Loader2 size={16} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />
              <span style={{ color: "var(--color-text-muted)" }} className="text-sm">Loading…</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p style={{ color: "var(--color-text-muted)" }} className="text-sm">No users found</p>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {users.map((u) => (
                <li key={u.userId} className="px-5 py-3 flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                    style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p style={{ color: "var(--color-text-primary)" }} className="text-sm font-medium truncate">
                      {u.name}
                    </p>
                    <p style={{ color: "var(--color-text-muted)" }} className="text-[11px] capitalize">
                      {u.role.replace("_", " ")}
                    </p>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => toggle(u)}
                    disabled={toggling === u.userId}
                    className="relative w-10 h-5 rounded-full transition-colors shrink-0 disabled:opacity-50"
                    style={{ backgroundColor: u.isAlwaysPresent ? "#22c55e" : "var(--color-border)" }}>
                    {toggling === u.userId ? (
                      <Loader2
                        size={12}
                        className="animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        style={{ color: u.isAlwaysPresent ? "#fff" : "var(--color-text-muted)" }}
                      />
                    ) : (
                      <span
                        className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                        style={{
                          backgroundColor: "#fff",
                          left: u.isAlwaysPresent ? "calc(100% - 1.125rem)" : "0.125rem",
                        }}
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div
          style={{ borderTopColor: "var(--color-border)" }}
          className="px-5 py-3 border-t">
          <p style={{ color: "var(--color-text-muted)" }} className="text-[11px]">
            {users.filter((u) => u.isAlwaysPresent).length} of {users.length} users always present
          </p>
        </div>
      </div>
    </div>
  );
}
