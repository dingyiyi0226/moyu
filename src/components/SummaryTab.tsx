import { useMemo } from "react";
import { useAppStore } from "@/store/appStore";
import type { BreakSession, WorkInterval, PauseInterval } from "@/store/appStore";
import {
  computeDayStats,
  formatDuration,
  getDateKey,
} from "@/lib/timeUtils";
import { useCurrency } from "@/hooks/useCurrency";

interface StatRecord {
  label: string;
  value: string;
  detail?: string;
}

/** Collect all unique date keys from work intervals and break sessions. */
function getAllDateKeys(
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

/** Get the ISO week key "YYYY-Www" for a date string "YYYY-MM-DD". */
function getWeekKey(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  // Find the Monday of the week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  const monday = new Date(d);
  monday.setDate(diff);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString([], { month: "short", day: "numeric" });
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function formatDateKey(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00");
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function computeOverallStats(
  sessions: BreakSession[],
  workIntervals: WorkInterval[],
  pauseIntervals: PauseInterval[],
): StatRecord[] {
  const dateKeys = getAllDateKeys(workIntervals, sessions);
  if (dateKeys.length === 0) return [];

  // Per-day stats
  const dayStats: { key: string; workSec: number; breakSec: number }[] = [];
  for (const dk of dateKeys) {
    const date = new Date(dk + "T00:00:00");
    const stats = computeDayStats(sessions, workIntervals, date, pauseIntervals);
    dayStats.push({ key: dk, workSec: stats.workSec, breakSec: stats.breakSec });
  }

  // Per-week aggregation
  const weekMap = new Map<string, { workSec: number; breakSec: number }>();
  for (const ds of dayStats) {
    const wk = getWeekKey(ds.key);
    const existing = weekMap.get(wk) ?? { workSec: 0, breakSec: 0 };
    existing.workSec += ds.workSec;
    existing.breakSec += ds.breakSec;
    weekMap.set(wk, existing);
  }

  const records: StatRecord[] = [];

  // Most working time in a day
  const maxWorkDay = dayStats.reduce(
    (best, d) => (d.workSec > best.workSec ? d : best),
    dayStats[0],
  );
  if (maxWorkDay.workSec > 0) {
    records.push({
      label: "Most work in a day",
      value: formatDuration(maxWorkDay.workSec),
      detail: formatDateKey(maxWorkDay.key),
    });
  }

  // Most working time in a week
  let maxWorkWeek = { key: "", workSec: 0 };
  for (const [wk, s] of weekMap) {
    if (s.workSec > maxWorkWeek.workSec) {
      maxWorkWeek = { key: wk, workSec: s.workSec };
    }
  }
  if (maxWorkWeek.workSec > 0) {
    records.push({
      label: "Most work in a week",
      value: formatDuration(maxWorkWeek.workSec),
      detail: maxWorkWeek.key,
    });
  }

  // Most break time in a day
  const maxBreakDay = dayStats.reduce(
    (best, d) => (d.breakSec > best.breakSec ? d : best),
    dayStats[0],
  );
  if (maxBreakDay.breakSec > 0) {
    records.push({
      label: "Most break in a day",
      value: formatDuration(maxBreakDay.breakSec),
      detail: formatDateKey(maxBreakDay.key),
    });
  }

  // Most break time in a week
  let maxBreakWeek = { key: "", breakSec: 0 };
  for (const [wk, s] of weekMap) {
    if (s.breakSec > maxBreakWeek.breakSec) {
      maxBreakWeek = { key: wk, breakSec: s.breakSec };
    }
  }
  if (maxBreakWeek.breakSec > 0) {
    records.push({
      label: "Most break in a week",
      value: formatDuration(maxBreakWeek.breakSec),
      detail: maxBreakWeek.key,
    });
  }

  // Longest working interval without a break
  // For each work interval, find gaps between breaks to get continuous work stretches
  let longestWorkStretch = 0;
  let longestWorkStretchTs = 0;
  for (const iv of workIntervals) {
    const ivEnd = iv.end ?? Date.now();
    // Find all breaks that overlap this work interval
    const overlapping = sessions
      .filter((s) => s.startTime < ivEnd && s.endTime > iv.start)
      .sort((a, b) => a.startTime - b.startTime);

    const updateMax = (dur: number, ts: number) => {
      if (dur > longestWorkStretch) {
        longestWorkStretch = dur;
        longestWorkStretchTs = ts;
      }
    };

    if (overlapping.length === 0) {
      updateMax(ivEnd - iv.start, iv.start);
    } else {
      updateMax(overlapping[0].startTime - iv.start, iv.start);
      for (let i = 1; i < overlapping.length; i++) {
        updateMax(
          overlapping[i].startTime - overlapping[i - 1].endTime,
          overlapping[i - 1].endTime,
        );
      }
      updateMax(
        ivEnd - overlapping[overlapping.length - 1].endTime,
        overlapping[overlapping.length - 1].endTime,
      );
    }
  }
  if (longestWorkStretch > 0) {
    records.push({
      label: "Longest work without break",
      value: formatDuration(Math.round(longestWorkStretch / 1000)),
      detail: formatDateKey(getDateKey(longestWorkStretchTs)),
    });
  }

  // Longest break interval
  let longestBreak = 0;
  let longestBreakTs = 0;
  for (const s of sessions) {
    const dur = s.endTime - s.startTime;
    if (dur > longestBreak) {
      longestBreak = dur;
      longestBreakTs = s.startTime;
    }
  }
  if (longestBreak > 0) {
    records.push({
      label: "Longest single break",
      value: formatDuration(Math.round(longestBreak / 1000)),
      detail: formatDateKey(getDateKey(longestBreakTs)),
    });
  }

  return records;
}

function AllTimeSummary() {
  const sessions = useAppStore((s) => s.sessions);
  const workIntervals = useAppStore((s) => s.workIntervals);
  const pauseIntervals = useAppStore((s) => s.pauseIntervals);
  const { formatCurrency } = useCurrency();

  const totals = useMemo(() => {
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
  }, [sessions, workIntervals, pauseIntervals]);

  return (
    <div className="px-4 py-3 text-center">
      <div className="text-[10px] text-muted-foreground">
        All-time earnings
      </div>
      <div className="text-2xl font-semibold mt-0.5">
        {formatCurrency(totals.earnings)}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        Work {formatDuration(totals.workDuration)} &middot; Break {formatDuration(totals.breakDuration)}
      </div>
    </div>
  );
}

export function SummaryTab() {
  const sessions = useAppStore((s) => s.sessions);
  const workIntervals = useAppStore((s) => s.workIntervals);
  const pauseIntervals = useAppStore((s) => s.pauseIntervals);

  const stats = useMemo(
    () => computeOverallStats(sessions, workIntervals, pauseIntervals),
    [sessions, workIntervals, pauseIntervals],
  );

  if (stats.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-[11px] text-muted-foreground">
        No data yet. Clock in to start tracking.
      </div>
    );
  }

  return (
    <>
      <AllTimeSummary />
      <div className="h-px bg-border mx-4" />
      <div className="px-4 py-3 space-y-2">
      <div className="text-[10px] text-muted-foreground text-center mb-3">
        All-time Records
      </div>
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-baseline justify-between gap-2 py-1.5 border-b border-border last:border-0"
        >
          <span className="text-[11px] text-muted-foreground shrink-0">
            {s.label}
          </span>
          <div className="text-right">
            <span className="text-[13px] font-semibold">{s.value}</span>
            {s.detail && (
              <span className="text-[10px] text-muted-foreground ml-1.5">
                {s.detail}
              </span>
            )}
          </div>
        </div>
      ))}
      </div>
    </>
  );
}
