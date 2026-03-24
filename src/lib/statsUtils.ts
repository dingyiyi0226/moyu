import { type BreakSession, type PauseInterval, type WorkInterval } from "@/store/appStore";
import {
  formatDateKey,
  formatDuration,
  formatTime,
  getDateKey,
  getIntervalsForDate,
  getWeekSunday,
  getMsOfDay,
} from "@/lib/timeUtils";

export interface DayStats {
  breakSec: number;
  workSec: number;
  pauseSec: number;
  earnings: number;
  breakCount: number;
}

export function computeDayStats(
  sessions: BreakSession[],
  workIntervals: WorkInterval[],
  date: Date,
  pauseIntervals?: PauseInterval[],
): DayStats {
  const dateKey = getDateKey(date.getTime());

  let breakSec = 0;
  let earnings = 0;
  let breakCount = 0;
  for (const s of sessions) {
    if (getDateKey(s.startTime) === dateKey) {
      breakSec += Math.round((s.endTime - s.startTime) / 1000);
      earnings += s.earnings;
      breakCount++;
    }
  }

  let workSec = 0;
  const dayIntervals = getIntervalsForDate(workIntervals, date);
  for (const iv of dayIntervals) {
    const end = iv.end ?? Date.now();
    workSec += Math.round((end - iv.start) / 1000);
  }

  let pauseSec = 0;
  if (pauseIntervals) {
    const dayPauses = getIntervalsForDate(pauseIntervals, date);
    for (const iv of dayPauses) {
      const end = iv.end ?? Date.now();
      pauseSec += Math.round((end - iv.start) / 1000);
    }
  }

  workSec = Math.max(0, workSec - breakSec);

  return { breakSec, workSec, pauseSec, earnings, breakCount };
}

const WEEK_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface WeekDayStats extends DayStats {
  key: string;
  label: string;
}

/** Aggregate daily stats for a full week (Sun–Sat). */
export function aggregateWeekStats(
  sessions: BreakSession[],
  workIntervals: WorkInterval[],
  weekOffset: number,
  pauseIntervals: PauseInterval[],
): WeekDayStats[] {
  const sunday = getWeekSunday(weekOffset);

  return WEEK_DAY_LABELS.map((label, i) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + i);
    const stats = computeDayStats(sessions, workIntervals, date, pauseIntervals);
    return { key: getDateKey(date.getTime()), label, ...stats };
  });
}

// ── Overall / all-time stats ──────────────────────────────────────────

export interface StatRecord {
  label: string;
  value: string;
  detail?: string;
}

/** Collect all unique date keys from work intervals and break sessions. */
export function getAllDateKeys(
  workIntervals: WorkInterval[],
  sessions: BreakSession[],
): string[] {
  const keys = new Set<string>();
  for (const iv of workIntervals) {
    keys.add(getDateKey(iv.start));
    if (iv.end) keys.add(getDateKey(iv.end));
  }
  for (const s of sessions) {
    keys.add(getDateKey(s.startTime));
  }
  return Array.from(keys).sort();
}

/** Compute all-time totals across every recorded day. */
export function computeAllTimeTotals(
  sessions: BreakSession[],
  workIntervals: WorkInterval[],
  pauseIntervals: PauseInterval[],
): { earnings: number; workDuration: number; breakDuration: number } {
  const dateKeys = getAllDateKeys(workIntervals, sessions);
  let totalWorkSec = 0;
  let totalBreakSec = 0;
  let totalEarnings = 0;
  for (const dk of dateKeys) {
    const date = new Date(dk + "T00:00:00");
    const stats = computeDayStats(sessions, workIntervals, date, pauseIntervals);
    totalWorkSec += stats.workSec;
    totalBreakSec += stats.breakSec;
    totalEarnings += stats.earnings;
  }
  return { earnings: totalEarnings, workDuration: totalWorkSec, breakDuration: totalBreakSec };
}

// ── Record helpers ────────────────────────────────────────────────────

export type KeyedDayStats = { key: string; workSec: number; breakSec: number };

export function extremeDayRecord(
  dayStats: KeyedDayStats[],
  field: "workSec" | "breakSec",
  mode: "max" | "min",
  label: string,
): StatRecord | null {
  const candidates = dayStats.filter((d) => d[field] > 0);
  if (candidates.length === 0) return null;
  const cmp = mode === "max"
    ? (a: number, b: number) => a > b
    : (a: number, b: number) => a < b;
  const best = candidates.reduce((b, d) => (cmp(d[field], b[field]) ? d : b), candidates[0]);
  return { label, value: formatDuration(best[field]), detail: formatDateKey(best.key) };
}

export function extremeWeekRecord(
  weekMap: Map<string, { workSec: number; breakSec: number }>,
  field: "workSec" | "breakSec",
  mode: "max" | "min",
  label: string,
): StatRecord | null {
  let best = { key: "", value: mode === "max" ? 0 : Infinity };
  const cmp = mode === "max"
    ? (a: number, b: number) => a > b
    : (a: number, b: number) => a < b;
  for (const [wk, s] of weekMap) {
    if (s[field] > 0 && cmp(s[field], best.value)) best = { key: wk, value: s[field] };
  }
  if (best.value <= 0 || best.value === Infinity) return null;
  return { label, value: formatDuration(best.value), detail: best.key };
}

export interface WorkSession {
  start: number; // Unix timestamp ms
  end: number;   // Unix timestamp ms
}

/** Split work intervals into continuous work sessions by removing break gaps. */
export function getWorkSessions(
  workIntervals: WorkInterval[],
  sessions: BreakSession[],
): WorkSession[] {
  const intervals = [...workIntervals].sort((a, b) => a.start - b.start);
  const breaks = [...sessions].sort((a, b) => a.startTime - b.startTime);
  const result: WorkSession[] = [];
  let bi = 0;

  for (const iv of intervals) {
    const ivEnd = iv.end ?? Date.now();
    let cursor = iv.start;

    while (bi < breaks.length && breaks[bi].startTime < ivEnd) {
      if (breaks[bi].endTime <= iv.start) { bi++; continue; }
      result.push({ start: cursor, end: breaks[bi].startTime });
      cursor = breaks[bi].endTime;
      bi++;
    }
    result.push({ start: cursor, end: ivEnd });
  }
  return result;
}

export function longestWorkSession(
  workIntervals: WorkInterval[],
  sessions: BreakSession[],
): StatRecord | null {
  const workSessions = getWorkSessions(workIntervals, sessions);
  let longestMs = 0;
  let longestTs = 0;
  for (const ws of workSessions) {
    const dur = ws.end - ws.start;
    if (dur > longestMs) {
      longestMs = dur;
      longestTs = ws.start;
    }
  }
  if (longestMs <= 0) return null;
  return {
    label: "Longest work session",
    value: formatDuration(Math.round(longestMs / 1000)),
    detail: formatDateKey(getDateKey(longestTs)),
  };
}

/** Find earliest & latest timestamps by time-of-day and return as StatRecords. */
export function timeOfDayRecords(
  timestamps: number[],
  earliestLabel: string,
  latestLabel: string,
): StatRecord[] {
  if (timestamps.length === 0) return [];
  let earliestMs = Infinity, earliestTs = 0;
  let latestMs = -1, latestTs = 0;
  for (const ts of timestamps) {
    const ms = getMsOfDay(ts);
    if (ms < earliestMs) { earliestMs = ms; earliestTs = ts; }
    if (ms > latestMs) { latestMs = ms; latestTs = ts; }
  }
  const records: StatRecord[] = [];
  if (earliestTs > 0) {
    records.push({
      label: earliestLabel,
      value: formatTime(earliestTs),
      detail: formatDateKey(getDateKey(earliestTs)),
    });
  }
  if (latestTs > 0) {
    records.push({
      label: latestLabel,
      value: formatTime(latestTs),
      detail: formatDateKey(getDateKey(latestTs)),
    });
  }
  return records;
}

export function longestSingleBreak(sessions: BreakSession[]): StatRecord | null {
  let longestMs = 0;
  let longestTs = 0;
  for (const s of sessions) {
    const dur = s.endTime - s.startTime;
    if (dur > longestMs) { longestMs = dur; longestTs = s.startTime; }
  }
  if (longestMs <= 0) return null;
  return {
    label: "Longest break session",
    value: formatDuration(Math.round(longestMs / 1000)),
    detail: formatDateKey(getDateKey(longestTs)),
  };
}

