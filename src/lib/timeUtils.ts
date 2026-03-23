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
export function formatTimeSec(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Format a Unix timestamp to "HH:MM" (24h, locale-aware) */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Format a "YYYY-MM-DD" date key to locale short display (e.g. "Mon, Mar 2") */
export function formatDateKey(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

/** Extract milliseconds since midnight from a Unix timestamp. */
export function getMsOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 3600000 + d.getMinutes() * 60000 + d.getSeconds() * 1000;
}

/** Get a week label "Mar 2 – Mar 8" for a date string "YYYY-MM-DD". */
export function formatWeekLabel(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString([], { month: "short", day: "numeric" });
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

/** Get the Sunday (start) of a week by offset from the current week. */
export function getWeekSunday(weekOffset: number): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const sunday = new Date(now);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(now.getDate() - dayOfWeek + weekOffset * 7);
  return sunday;
}

/** Filter intervals (work or pause) that overlap with a given date (midnight to midnight). */
export function getIntervalsForDate<T extends { start: number; end: number | null }>(
  allIntervals: T[],
  date: Date,
): T[] {
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

