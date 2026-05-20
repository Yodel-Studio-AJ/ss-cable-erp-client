import api from "@/lib/api";
import type { MonthSummary, DayAttendanceUser, MarkRecord, AttendanceSettingUser } from "@/types/attendance";

export async function getMonthSummary(year: number, month: number): Promise<MonthSummary> {
  const { data } = await api.get<MonthSummary>("/api/attendance", { params: { year, month } });
  return data;
}

export async function getDayAttendance(date: string): Promise<DayAttendanceUser[]> {
  const { data } = await api.get<DayAttendanceUser[]>("/api/attendance/day", { params: { date } });
  return data;
}

export async function markAttendance(date: string, records: MarkRecord[]): Promise<{ marked: number }> {
  const { data } = await api.post<{ marked: number }>("/api/attendance/mark", { date, records });
  return data;
}

export async function getAttendanceSettings(): Promise<AttendanceSettingUser[]> {
  const { data } = await api.get<AttendanceSettingUser[]>("/api/attendance/settings");
  return data;
}

export async function updateAttendanceSetting(userId: string, isAlwaysPresent: boolean): Promise<void> {
  await api.patch(`/api/attendance/settings/${userId}`, { isAlwaysPresent });
}
