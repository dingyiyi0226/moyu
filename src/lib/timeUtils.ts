import { type BreakSession, type PauseInterval, type WorkInterval } from "@/store/appStore";

export function getDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Format seconds as MM:SS timer display */
export function formatTimer(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Format fractional hour (e.g. 9.5) to "HH:MM" */
export function formatHour(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Format minutes-since-midnight to "HH:MM" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Format a Unix timestamp to "HH:MM:SS" (24h, locale-aware) */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export const navBtnClass =
  "p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none";

/** Filter work intervals that overlap with a given date (midnight to midnight). */
export function getWorkIntervalsForDate(
  allIntervals: WorkInterval[],
  date: Date,
): WorkInterval[] {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  const dsMs = dayStart.getTime();
  const deMs = dayEnd.getTime();

  return allIntervals.filter((iv) => {
    const end = iv.end ?? Date.now();
    return iv.start <= deMs && end >= dsMs;
  });
}

export function getBreakSessionsForDate(
  allSessions: BreakSession[],
  date: Date,
): BreakSession[] {
  const key = getDateKey(date.getTime());
  return allSessions
    .filter((s) => getDateKey(s.startTime) === key)
    .sort((a, b) => a.startTime - b.startTime);
}

export function getPauseIntervalsForDate(
  allIntervals: PauseInterval[],
  date: Date,
): PauseInterval[] {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  const dsMs = dayStart.getTime();
  const deMs = dayEnd.getTime();

  return allIntervals.filter((iv) => {
    const end = iv.end ?? Date.now();
    return iv.start <= deMs && end >= dsMs;
  });
}

export function computeDayStats(
  sessions: BreakSession[],
  workIntervals: WorkInterval[],
  date: Date,
  pauseIntervals?: PauseInterval[],
): { breakSec: number; workSec: number; pauseSec: number; earnings: number; breakCount: number } {
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
  const dayIntervals = getWorkIntervalsForDate(workIntervals, date);
  for (const iv of dayIntervals) {
    const end = iv.end ?? Date.now();
    workSec += Math.round((end - iv.start) / 1000);
  }

  let pauseSec = 0;
  if (pauseIntervals) {
    const dayPauses = getPauseIntervalsForDate(pauseIntervals, date);
    for (const iv of dayPauses) {
      const end = iv.end ?? Date.now();
      pauseSec += Math.round((end - iv.start) / 1000);
    }
  }

  workSec = Math.max(0, workSec - breakSec);

  return { breakSec, workSec, pauseSec, earnings, breakCount };
}

/** Convert fractional hour to % position within the schedule bar */
export function toPercent(hour: number, schedStart: number, schedEnd: number): number {
  const total = schedEnd - schedStart;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, ((hour - schedStart) / total) * 100));
}
