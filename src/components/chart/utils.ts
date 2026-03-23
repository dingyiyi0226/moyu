import { type BreakSession, type WorkInterval } from "@/store/appStore";
import { getDateKey, formatHour } from "@/lib/timeUtils";

// ── Types ────────────────────────────────────────────────────────────

export interface TimeRange {
  startH: number; // fractional hour (e.g. 9.5 = 09:30)
  endH: number;
}

export interface DayTimeline {
  axisStart: number; // schedule start hour
  axisEnd: number;   // schedule end hour
  workBands: TimeRange[];
  breakBands: (TimeRange & { id: string })[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function toFractionalHour(timestamp: number): number {
  const d = new Date(timestamp);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** Clip [start, end] to [rangeStart, rangeEnd]. Returns null if no overlap. */
function clipRange(
  start: number,
  end: number,
  rangeStart: number,
  rangeEnd: number,
): { start: number; end: number } | null {
  const s = Math.max(start, rangeStart);
  const e = Math.min(end, rangeEnd);
  return s < e ? { start: s, end: e } : null;
}

/** Convert fractional hour to % position within the schedule bar */
export function toPercent(hour: number, schedStart: number, schedEnd: number): number {
  const total = schedEnd - schedStart;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, ((hour - schedStart) / total) * 100));
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

// ── Timeline construction ────────────────────────────────────────────

/**
 * Build the timeline for a single day.
 *
 * Priority: clock in/out > breaks > schedule.
 * - Work bands = work intervals clipped to schedule range
 * - Break bands = break sessions clipped to the intersection of work bands AND schedule range
 */
export function buildDayTimeline(
  schedStart: number,
  schedEnd: number,
  workIntervals: WorkInterval[],
  breakSessions: BreakSession[],
  nowH?: number,
): DayTimeline {
  const workBands: TimeRange[] = [];
  for (const iv of workIntervals) {
    const startH = toFractionalHour(iv.start);
    const endH = iv.end != null
      ? toFractionalHour(iv.end)
      : (nowH != null ? Math.min(nowH, schedEnd) : schedEnd);
    const clipped = clipRange(startH, endH, schedStart, schedEnd);
    if (clipped) {
      workBands.push({ startH: clipped.start, endH: clipped.end });
    }
  }

  const breakBands: (TimeRange & { id: string })[] = [];
  for (const brk of breakSessions) {
    const bStartH = toFractionalHour(brk.startTime);
    const bEndH = toFractionalHour(brk.endTime);
    for (const work of workBands) {
      const clipped = clipRange(bStartH, bEndH, work.startH, work.endH);
      if (clipped) {
        breakBands.push({ startH: clipped.start, endH: clipped.end, id: brk.id });
      }
    }
  }

  return { axisStart: schedStart, axisEnd: schedEnd, workBands, breakBands };
}

// ── Moving average ───────────────────────────────────────────────────

export function computeMovingAverage(
  timeline: DayTimeline,
  windowHours: number,
  stepMinutes: number,
  maxHour?: number,
): { hour: number; label: string; percent: number }[] {
  const halfWindow = windowHours / 2;
  const points: { hour: number; label: string; percent: number }[] = [];
  const endH = maxHour != null ? Math.min(maxHour, timeline.axisEnd) : timeline.axisEnd;

  for (let h = timeline.axisStart; h <= endH + 0.001; h += stepMinutes / 60) {
    const isClockedIn = timeline.workBands.some(
      (band) => h >= band.startH && h <= band.endH,
    );

    let percent = 0;
    if (isClockedIn) {
      const wStart = h - halfWindow;
      const wEnd = h + halfWindow;

      let workTime = 0;
      for (const band of timeline.workBands) {
        const s = Math.max(band.startH, wStart);
        const e = Math.min(band.endH, wEnd);
        if (s < e) workTime += e - s;
      }

      let breakTime = 0;
      for (const band of timeline.breakBands) {
        const s = Math.max(band.startH, wStart);
        const e = Math.min(band.endH, wEnd);
        if (s < e) breakTime += e - s;
      }

      const netWork = Math.max(0, workTime - breakTime);
      percent = workTime > 0 ? Math.round((netWork / workTime) * 1000) / 10 : 0;
    }

    points.push({ hour: h, label: formatHour(h), percent });
  }

  return points;
}
