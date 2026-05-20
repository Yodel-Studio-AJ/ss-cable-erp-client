"use client";

import { useState, useEffect } from "react";
import { Save, CheckCheck, XCircle, Loader2 } from "lucide-react";
import type { DayAttendanceUser, AttendanceStatus, MarkRecord } from "@/types/attendance";
import { STATUS_SHORT, STATUS_COLORS } from "@/types/attendance";

interface Props {
  date:          string;
  users:         DayAttendanceUser[];
  canMark:       boolean;
  isSaving:      boolean;
  onSave:        (records: MarkRecord[]) => Promise<void>;
}

const STATUSES: AttendanceStatus[] = ["present", "absent", "half_day", "leave"];

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function AttendanceDayPanel({ date, users, canMark, isSaving, onSave }: Props) {
  const [draft, setDraft] = useState<Record<string, AttendanceStatus | null>>({});

  // Sync draft whenever users (or date) changes
  useEffect(() => {
    const init: Record<string, AttendanceStatus | null> = {};
    for (const u of users) init[u.userId] = u.status;
    setDraft(init);
  }, [users, date]);

  const setStatus = (userId: string, status: AttendanceStatus) => {
    if (!canMark) return;
    setDraft((prev) => ({
      ...prev,
      [userId]: prev[userId] === status ? null : status,
    }));
  };

  const markAll = (status: AttendanceStatus) => {
    if (!canMark) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const u of users) next[u.userId] = status;
      return next;
    });
  };

  const handleSave = async () => {
    const records: MarkRecord[] = [];
    for (const u of users) {
      const s = draft[u.userId];
      if (s) records.push({ userId: u.userId, status: s });
    }
    await onSave(records);
  };

  const isDirty = users.some((u) => draft[u.userId] !== u.status);
  const markedCount = Object.values(draft).filter(Boolean).length;

  return (
    <div
      style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
      className="border rounded-xl flex flex-col overflow-hidden h-full">

      {/* Header */}
      <div
        style={{ borderBottomColor: "var(--color-border)" }}
        className="px-4 py-3 border-b flex flex-col gap-1">
        <p style={{ color: "var(--color-text-muted)" }} className="text-[11px] uppercase tracking-wider font-medium">
          Daily Attendance
        </p>
        <h3 style={{ color: "var(--color-text-primary)" }} className="text-sm font-semibold leading-tight">
          {formatDate(date)}
        </h3>
        <p style={{ color: "var(--color-text-muted)" }} className="text-[11px]">
          {markedCount} / {users.length} marked
        </p>
      </div>

      {/* Quick actions */}
      {canMark && users.length > 0 && (
        <div
          style={{ borderBottomColor: "var(--color-border)" }}
          className="px-4 py-2 border-b flex items-center gap-2">
          <span style={{ color: "var(--color-text-muted)" }} className="text-[11px] mr-1">
            Mark all:
          </span>
          <button
            onClick={() => markAll("present")}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: "#22c55e22", color: "#22c55e" }}>
            <CheckCheck size={11} /> Present
          </button>
          <button
            onClick={() => markAll("absent")}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: "#ef444422", color: "#ef4444" }}>
            <XCircle size={11} /> Absent
          </button>
        </div>
      )}

      {/* User list */}
      <div className="flex-1 overflow-y-auto">
        {users.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
              No users to display
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {users.map((user) => {
              const currentStatus = draft[user.userId] ?? null;
              return (
                <li key={user.userId} className="px-4 py-3 flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                    style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + role */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        style={{ color: "var(--color-text-primary)" }}
                        className="text-sm font-medium truncate leading-none">
                        {user.name}
                      </p>
                      {user.isAlwaysPresent && (
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0"
                          style={{ backgroundColor: "#22c55e22", color: "#22c55e" }}>
                          Always
                        </span>
                      )}
                    </div>
                    <p style={{ color: "var(--color-text-muted)" }} className="text-[11px] mt-0.5 capitalize">
                      {user.role.replace("_", " ")}
                    </p>
                  </div>

                  {/* Status pills */}
                  <div className="flex items-center gap-1 shrink-0">
                    {STATUSES.map((s) => {
                      const isActive = currentStatus === s;
                      const colors = STATUS_COLORS[s];
                      return (
                        <button
                          key={s}
                          onClick={() => setStatus(user.userId, s)}
                          disabled={!canMark}
                          title={s.replace("_", " ")}
                          className="w-7 h-7 rounded-md text-[11px] font-bold transition-all"
                          style={
                            isActive
                              ? { backgroundColor: colors.bg, color: colors.text }
                              : {
                                  backgroundColor: "var(--color-bg-page)",
                                  color: "var(--color-text-muted)",
                                  border: "1px solid var(--color-border)",
                                  opacity: canMark ? 1 : 0.5,
                                }
                          }>
                          {STATUS_SHORT[s]}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Save footer */}
      {canMark && (
        <div
          style={{ borderTopColor: "var(--color-border)" }}
          className="px-4 py-3 border-t">
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }}>
            {isSaving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : (
              <><Save size={14} /> Save Attendance</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
