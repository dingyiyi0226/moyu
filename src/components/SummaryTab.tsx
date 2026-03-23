import { useMemo } from "react";
import { useAppStore } from "@/store/appStore";
import { formatDuration, formatWeekLabel, getMsOfDay } from "@/lib/timeUtils";
import {
  computeAllTimeTotals,
  computeDayStats,
  getAllDateKeys,
  getWorkSessions,
  longestSingleBreak,
  longestWorkWithoutBreak,
  maxDayRecord,
  maxWeekRecord,
  type StatRecord,
} from "@/lib/statsUtils";
import { useCurrency } from "@/hooks/useCurrency";
import { ClockTimeChart } from "@/components/chart/ClockTimeChart";
import { DayDurationChart } from "@/components/chart/DayDurationChart";
import { WeekDurationChart } from "@/components/chart/WeekDurationChart";
import { SessionHistogram } from "@/components/chart/SessionHistogram";

function AllTimeSummary() {
  const sessions = useAppStore((s) => s.sessions);
  const workIntervals = useAppStore((s) => s.workIntervals);
  const pauseIntervals = useAppStore((s) => s.pauseIntervals);
  const { formatCurrency } = useCurrency();

  const totals = useMemo(
    () => computeAllTimeTotals(sessions, workIntervals, pauseIntervals),
    [sessions, workIntervals, pauseIntervals],
  );

  return (
    <div className="px-4 py-3 text-center shrink-0">
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

  const dayStats = useMemo(() => {
    const dateKeys = getAllDateKeys(workIntervals, sessions);
    if (dateKeys.length === 0) return [];
    return dateKeys.map((dk) => {
      const date = new Date(dk + "T00:00:00");
      const s = computeDayStats(sessions, workIntervals, date, pauseIntervals);
      return { key: dk, workSec: s.workSec, breakSec: s.breakSec };
    });
  }, [sessions, workIntervals, pauseIntervals]);

  const weekMap = useMemo(() => {
    const map = new Map<string, { workSec: number; breakSec: number }>();
    for (const ds of dayStats) {
      const wk = formatWeekLabel(ds.key);
      const existing = map.get(wk) ?? { workSec: 0, breakSec: 0 };
      existing.workSec += ds.workSec;
      existing.breakSec += ds.breakSec;
      map.set(wk, existing);
    }
    return map;
  }, [dayStats]);

  const stats = useMemo(() => {
    if (dayStats.length === 0) return [];

    return [
      maxDayRecord(dayStats, "workSec", "Most work in a day"),
      maxWeekRecord(weekMap, "workSec", "Most work in a week"),
      maxDayRecord(dayStats, "breakSec", "Most break in a day"),
      maxWeekRecord(weekMap, "breakSec", "Most break in a week"),
      longestWorkWithoutBreak(workIntervals, sessions),
      longestSingleBreak(sessions),
    ].filter((r): r is StatRecord => r != null);
  }, [dayStats, weekMap, workIntervals, sessions]);

  const dayDurationData = useMemo(() => {
    if (dayStats.length === 0) return null;
    let maxWork = 0, minWork = Infinity, maxBreak = 0, minBreak = Infinity;
    for (const ds of dayStats) {
      if (ds.workSec > maxWork) maxWork = ds.workSec;
      if (ds.workSec > 0 && ds.workSec < minWork) minWork = ds.workSec;
      if (ds.breakSec > maxBreak) maxBreak = ds.breakSec;
      if (ds.breakSec > 0 && ds.breakSec < minBreak) minBreak = ds.breakSec;
    }
    if (maxWork === 0 && maxBreak === 0) return null;
    return {
      mostWorkSec: maxWork,
      leastWorkSec: minWork === Infinity ? 0 : minWork,
      mostBreakSec: maxBreak,
      leastBreakSec: minBreak === Infinity ? 0 : minBreak,
    };
  }, [dayStats]);

  const weekDurationData = useMemo(() => {
    if (weekMap.size === 0) return null;
    let maxWork = 0, minWork = Infinity, maxBreak = 0, minBreak = Infinity;
    for (const ws of weekMap.values()) {
      if (ws.workSec > maxWork) maxWork = ws.workSec;
      if (ws.workSec > 0 && ws.workSec < minWork) minWork = ws.workSec;
      if (ws.breakSec > maxBreak) maxBreak = ws.breakSec;
      if (ws.breakSec > 0 && ws.breakSec < minBreak) minBreak = ws.breakSec;
    }
    if (maxWork === 0 && maxBreak === 0) return null;
    return {
      mostWorkSec: maxWork,
      leastWorkSec: minWork === Infinity ? 0 : minWork,
      mostBreakSec: maxBreak,
      leastBreakSec: minBreak === Infinity ? 0 : minBreak,
    };
  }, [weekMap]);

  const workDurationsMs = useMemo(() => {
    const ws = getWorkSessions(workIntervals, sessions);
    return ws.map((w) => w.end - w.start);
  }, [workIntervals, sessions]);

  const breakDurationsMs = useMemo(
    () => sessions.map((s) => s.endTime - s.startTime),
    [sessions],
  );

  const clockTimeData = useMemo(() => {
    const clockIns = workIntervals.map((iv) => iv.start);
    const clockOuts = workIntervals
      .filter((iv): iv is typeof iv & { end: number } => iv.end != null)
      .map((iv) => iv.end);
    if (clockIns.length === 0 || clockOuts.length === 0) return null;

    let earliestInMs = Infinity;
    for (const ts of clockIns) {
      const ms = getMsOfDay(ts);
      if (ms < earliestInMs) earliestInMs = ms;
    }
    let latestOutMs = -1;
    for (const ts of clockOuts) {
      const ms = getMsOfDay(ts);
      if (ms > latestOutMs) latestOutMs = ms;
    }
    if (latestOutMs < 0) return null;

    return {
      earliestClockInH: earliestInMs / 3_600_000,
      latestClockOutH: latestOutMs / 3_600_000,
    };
  }, [workIntervals]);

  if (stats.length === 0) {
    return (
      <div className="flex-1 min-h-0 px-4 py-12 text-center text-[11px] text-muted-foreground">
        No data yet. Clock in to start tracking.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <AllTimeSummary />
      <div className="h-px bg-border mx-4 shrink-0" />
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1">
        {clockTimeData && (
          <ClockTimeChart
            earliestClockInH={clockTimeData.earliestClockInH}
            latestClockOutH={clockTimeData.latestClockOutH}
          />
        )}
        {dayDurationData && <DayDurationChart {...dayDurationData} />}
        {weekDurationData && <WeekDurationChart {...weekDurationData} />}
        <SessionHistogram
          title="Work Session Duration"
          durationsMs={workDurationsMs}
          binSeconds={60}
          config={{ work: { label: "Work", color: "oklch(0.707 0.165 254.624)" } }}
          dataKey="work"
          tickIntervalSec={600}
        />
        <SessionHistogram
          title="Break Session Duration"
          durationsMs={breakDurationsMs}
          binSeconds={5}
          config={{ break: { label: "Break", color: "oklch(0.765 0.177 163.223)" } }}
          dataKey="break"
          tickIntervalSec={60}
        />
        <div>
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
      </div>
    </div>
  );
}
