"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings2, Loader2, AlertCircle } from "lucide-react";
import AttendanceCalendar from "@/components/attendance/AttendanceCalendar";
import AttendanceDayPanel from "@/components/attendance/AttendanceDayPanel";
import AttendanceSettingsModal from "@/components/attendance/AttendanceSettingsModal";
import {
  getMonthSummary,
  getDayAttendance,
  markAttendance,
} from "@/api/attendance";
import type { DaySummary, DayAttendanceUser, MarkRecord } from "@/types/attendance";
import { useAuthStore } from "@/store/authStore";

function pad(n: number) { return String(n).padStart(2, "0"); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const CAN_MARK_ROLES = new Set(["owner", "admin", "floor_manager"]);

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const canMark = user ? CAN_MARK_ROLES.has(user.role) : false;

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const [summary, setSummary]           = useState<Record<string, DaySummary>>({});
  const [totalUsers, setTotalUsers]     = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [dayUsers, setDayUsers]         = useState<DayAttendanceUser[]>([]);
  const [dayLoading, setDayLoading]     = useState(false);
  const [dayError, setDayError]         = useState<string | null>(null);

  const [isSaving, setIsSaving]         = useState(false);
  const [saveSuccess, setSaveSuccess]   = useState(false);

  const [showSettings, setShowSettings] = useState(false);

  // Load month summary
  const loadSummary = useCallback(async (y: number, m: number) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await getMonthSummary(y, m);
      setSummary(data.summary);
      setTotalUsers(data.totalUsers);
    } catch {
      setSummaryError("Failed to load month summary");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Load day attendance
  const loadDay = useCallback(async (date: string) => {
    setDayLoading(true);
    setDayError(null);
    try {
      const data = await getDayAttendance(date);
      setDayUsers(data);
    } catch {
      setDayError("Failed to load attendance for this day");
    } finally {
      setDayLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(year, month); }, [year, month, loadSummary]);
  useEffect(() => { loadDay(selectedDate); }, [selectedDate, loadDay]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  async function handleSave(records: MarkRecord[]) {
    if (records.length === 0) return;
    setIsSaving(true);
    try {
      await markAttendance(selectedDate, records);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      // Refresh both day and month
      await Promise.all([loadDay(selectedDate), loadSummary(year, month)]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ color: "var(--color-text-primary)" }} className="text-lg font-semibold">
            Attendance
          </h1>
          <p style={{ color: "var(--color-text-muted)" }} className="text-xs mt-0.5">
            Track daily attendance across your organization
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#22c55e22", color: "#22c55e" }}>
              Saved
            </span>
          )}
          {canMark && (
            <button
              onClick={() => setShowSettings(true)}
              style={{
                color: "var(--color-text-secondary)",
                borderColor: "var(--color-border)",
                backgroundColor: "var(--color-bg-popup)",
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:opacity-80 transition-opacity">
              <Settings2 size={14} />
              Settings
            </button>
          )}
        </div>
      </div>

      {/* Error banners */}
      {summaryError && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm" style={{ backgroundColor: "#ef444422", color: "#ef4444" }}>
          <AlertCircle size={14} />
          {summaryError}
          <button onClick={() => loadSummary(year, month)} className="ml-auto underline text-xs">Retry</button>
        </div>
      )}

      {/* Main layout: Calendar left, Day panel right */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Calendar */}
        <div className="w-80 shrink-0 relative">
          {summaryLoading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl z-10" style={{ backgroundColor: "var(--color-bg-popup)", opacity: 0.7 }}>
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />
            </div>
          )}
          <AttendanceCalendar
            year={year}
            month={month}
            selectedDate={selectedDate}
            summary={summary}
            totalUsers={totalUsers}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onSelectDate={setSelectedDate}
          />
        </div>

        {/* Day panel */}
        <div className="flex-1 min-w-0 relative">
          {dayLoading && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-xl z-10"
              style={{ backgroundColor: "var(--color-bg-popup)", opacity: 0.8 }}>
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />
            </div>
          )}
          {dayError ? (
            <div
              style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
              className="border rounded-xl flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle size={20} className="mx-auto mb-2" style={{ color: "#ef4444" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{dayError}</p>
                <button
                  onClick={() => loadDay(selectedDate)}
                  className="mt-2 text-xs underline"
                  style={{ color: "var(--color-text-muted)" }}>
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <AttendanceDayPanel
              date={selectedDate}
              users={dayUsers}
              canMark={canMark}
              isSaving={isSaving}
              onSave={handleSave}
            />
          )}
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && <AttendanceSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
