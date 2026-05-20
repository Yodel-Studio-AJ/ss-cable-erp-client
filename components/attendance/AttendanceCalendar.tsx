"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DaySummary } from "@/types/attendance";

interface Props {
  year:           number;
  month:          number;
  selectedDate:   string;
  summary:        Record<string, DaySummary>;
  totalUsers:     number;
  onPrevMonth:    () => void;
  onNextMonth:    () => void;
  onSelectDate:   (date: string) => void;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function pad(n: number) { return String(n).padStart(2, "0"); }

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const total    = new Date(year, month, 0).getDate();
  const days: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= total; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function attendanceColor(summary: DaySummary | undefined): string {
  if (!summary || summary.total === 0) return "transparent";
  const rate = (summary.present + summary.halfDay * 0.5) / summary.total;
  if (rate >= 0.9) return "#22c55e";
  if (rate >= 0.7) return "#f59e0b";
  return "#ef4444";
}

export default function AttendanceCalendar({
  year, month, selectedDate, summary, totalUsers, onPrevMonth, onNextMonth, onSelectDate,
}: Props) {
  const today     = new Date();
  const todayStr  = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const days      = getCalendarDays(year, month);
  const isCurrentOrPast = (d: number) => {
    const date = new Date(year, month - 1, d);
    return date <= today;
  };

  return (
    <div
      style={{ backgroundColor: "var(--color-bg-popup)", borderColor: "var(--color-border)" }}
      className="border rounded-xl p-4 flex flex-col gap-4">

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrevMonth}
          style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-border)" }}
          className="p-1.5 rounded-lg border hover:opacity-70 transition-opacity">
          <ChevronLeft size={16} />
        </button>
        <h2 style={{ color: "var(--color-text-primary)" }} className="text-base font-semibold">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button
          onClick={onNextMonth}
          style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-border)" }}
          className="p-1.5 rounded-lg border hover:opacity-70 transition-opacity">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((d) => (
          <div key={d} style={{ color: "var(--color-text-muted)" }} className="text-center text-[11px] font-medium py-1">
            {d}
          </div>
        ))}

        {/* Day cells */}
        {days.map((day, i) => {
          if (!day) return <div key={i} />;

          const dateStr   = `${year}-${pad(month)}-${pad(day)}`;
          const isToday   = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isPast    = isCurrentOrPast(day);
          const daySummary = summary[dateStr];
          const dotColor  = isPast ? attendanceColor(daySummary) : "transparent";
          const hasData   = isPast && daySummary && daySummary.total > 0;

          return (
            <button
              key={i}
              onClick={() => onSelectDate(dateStr)}
              style={
                isSelected
                  ? { backgroundColor: "var(--color-btn-bg)", color: "var(--color-btn-text)" }
                  : isToday
                  ? { borderColor: "var(--color-btn-bg)", color: "var(--color-text-primary)" }
                  : { color: isPast ? "var(--color-text-primary)" : "var(--color-text-muted)" }
              }
              className={`
                relative flex flex-col items-center justify-center rounded-lg py-1.5 gap-0.5
                transition-all hover:opacity-80
                ${isToday && !isSelected ? "border-2" : ""}
                ${!isPast ? "opacity-40 cursor-default" : "cursor-pointer"}
              `}>
              <span className="text-sm font-medium leading-none">{day}</span>

              {/* Attendance dot indicator */}
              <div className="flex items-center gap-0.5">
                {hasData ? (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: isSelected ? "var(--color-btn-text)" : dotColor }}
                  />
                ) : (
                  <span className="w-1.5 h-1.5" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{ borderTopColor: "var(--color-border)" }}
        className="border-t pt-3 flex items-center gap-4 flex-wrap">
        <span style={{ color: "var(--color-text-muted)" }} className="text-[11px]">
          {totalUsers} user{totalUsers !== 1 ? "s" : ""} tracked
        </span>
        {[
          { color: "#22c55e", label: "≥90% present" },
          { color: "#f59e0b", label: "70–89%" },
          { color: "#ef4444", label: "<70%" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span style={{ color: "var(--color-text-muted)" }} className="text-[11px]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
