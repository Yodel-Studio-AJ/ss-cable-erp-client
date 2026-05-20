export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';

export interface DaySummary {
  present:  number;
  absent:   number;
  halfDay:  number;
  leave:    number;
  unmarked: number;
  total:    number;
}

export interface MonthSummary {
  summary:            Record<string, DaySummary>;
  totalUsers:         number;
  alwaysPresentCount: number;
}

export interface DayAttendanceUser {
  userId:          string;
  name:            string;
  role:            string;
  isAlwaysPresent: boolean;
  status:          AttendanceStatus | null;
  note:            string | null;
  recordId:        string | null;
}

export interface MarkRecord {
  userId: string;
  status: AttendanceStatus;
  note?:  string | null;
}

export interface AttendanceSettingUser {
  userId:          string;
  name:            string;
  role:            string;
  isAlwaysPresent: boolean;
}

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present:  'Present',
  absent:   'Absent',
  half_day: 'Half Day',
  leave:    'Leave',
};

export const STATUS_SHORT: Record<AttendanceStatus, string> = {
  present:  'P',
  absent:   'A',
  half_day: 'H',
  leave:    'L',
};

export const STATUS_COLORS: Record<AttendanceStatus, { bg: string; text: string; ring: string }> = {
  present:  { bg: '#22c55e', text: '#fff',     ring: '#22c55e' },
  absent:   { bg: '#ef4444', text: '#fff',     ring: '#ef4444' },
  half_day: { bg: '#f59e0b', text: '#fff',     ring: '#f59e0b' },
  leave:    { bg: '#3b82f6', text: '#fff',     ring: '#3b82f6' },
};
