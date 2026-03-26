import { useMemo } from "react";
import { useAppStore } from "@/store/appStore";
import { formatDuration, formatFractionalHour, formatWeekLabel, getDateKey, getIntervalsForDate, getMsOfDay } from "@/lib/timeUtils";
import {
  computeAllTimeTotals,
  computeDayStats,
  computeExtremes,
  getAllDateKeys,
  getWorkSessions,
} from "@/lib/statsUtils";
import { getDayScheduleForDate } from "@/lib/scheduleUtils";
import { useCurrency } from "@/hooks/useCurrency";
import { ClockTimeChart } from "@/components/chart/ClockTimeChart";
import { DailyDurationChart } from "@/components/chart/DailyDurationChart";
import { WeeklyDurationChart } from "@/components/chart/WeeklyDurationChart";
import { SessionHistogram } from "@/components/chart/SessionHistogram";
import { AllTimeRecords } from "@/components/AllTimeRecords";
import { ActivityLineChart } from "@/components/chart/ActivityLineChart";
import { buildDayTimeline, computeMovingAverage, getBreakSessionsForDate } from "@/components/chart/utils";

function AllTimeSummary() {
  const sessions = useAppStore((s) => s.sessions);
  const workIntervals = useAppStore((s) => s.workIntervals);
  const pauseIntervals = useAppStore((s) => s.pauseIntervals);
  const { formatCurrency } = useCurrency();

  const totals = useMemo(
    () => computeAllTimeTotals(sessions, workIntervals, pauseIntervals),
    [sessions, workIntervals, pauseIntervals],
  );

  const { dayCount, weekCount } = useMemo(() => {
    const dateKeys = getAllDateKeys(workIntervals, sessions);
    const weeks = new Set(dateKeys.map(formatWeekLabel));
    return { dayCount: dateKeys.length, weekCount: weeks.size };
  }, [workIntervals, sessions]);

  const weeklyAvg = weekCount > 0 ? totals.earnings / weekCount : 0;
  const dailyAvg = dayCount > 0 ? totals.earnings / dayCount : 0;
  const weeklyWorkSec = weekCount > 0 ? Math.round(totals.workDuration / weekCount) : 0;
  const weeklyBreakSec = weekCount > 0 ? Math.round(totals.breakDuration / weekCount) : 0;
  const dailyWorkSec = dayCount > 0 ? Math.round(totals.workDuration / dayCount) : 0;
  const dailyBreakSec = dayCount > 0 ? Math.round(totals.breakDuration / dayCount) : 0;

  return (
    <div className="px-4 py-3 shrink-0">
      <div className="text-sm text-muted-foreground mb-1">
        You earned
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold inline-block min-w-[5em] text-right">{formatCurrency(totals.earnings)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-1">
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="text-[10px] text-muted-foreground mb-1">Daily Average</div>
            <div className="text-[9px] text-muted-foreground">earned</div>
            <div className="text-sm font-bold leading-tight">{formatCurrency(dailyAvg)}</div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <div className="text-[9px] text-muted-foreground">break</div>
                <div className="text-xs font-bold leading-tight">{formatDuration(dailyBreakSec)}</div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground">work</div>
                <div className="text-xs font-bold leading-tight">{formatDuration(dailyWorkSec)}</div>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="text-[10px] text-muted-foreground mb-1">Weekly Average</div>
            <div className="text-[9px] text-muted-foreground">earned</div>
            <div className="text-sm font-bold leading-tight">{formatCurrency(weeklyAvg)}</div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <div className="text-[9px] text-muted-foreground">break</div>
                <div className="text-xs font-bold leading-tight">{formatDuration(weeklyBreakSec)}</div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground">work</div>
                <div className="text-xs font-bold leading-tight">{formatDuration(weeklyWorkSec)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SummaryTab() {
  const sessions = useAppStore((s) => s.sessions);
  const workIntervals = useAppStore((s) => s.workIntervals);
  const pauseIntervals = useAppStore((s) => s.pauseIntervals);
  const schedule = useAppStore((s) => s.schedule);
  const dailySchedules = useAppStore((s) => s.dailySchedules);

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

  const todayKey = getDateKey(Date.now());
  const thisWeekLabel = formatWeekLabel(todayKey);

  // Exclude today / this week from extremes so incomplete periods don't skew records
  const pastDayStats = useMemo(
    () => dayStats.filter((ds) => ds.key !== todayKey),
    [dayStats, todayKey],
  );
  const pastWeekMap = useMemo(() => {
    const map = new Map(weekMap);
    map.delete(thisWeekLabel);
    return map;
  }, [weekMap, thisWeekLabel]);

  const dayDurationData = useMemo(
    () => computeExtremes(pastDayStats),
    [pastDayStats],
  );

  const weekDurationData = useMemo(
    () => computeExtremes(pastWeekMap.values()),
    [pastWeekMap],
  );

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

  const allTimeLineData = useMemo(() => {
    const dateKeys = getAllDateKeys(workIntervals, sessions);
    if (dateKeys.length === 0) return [];

    const now = new Date();
    const nowKey = getDateKey(now.getTime());
    const nowH = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    const dailyAverages: { hour: number; percent: number }[][] = [];

    for (const dk of dateKeys) {
      const date = new Date(dk + "T00:00:00");
      const dayIntervals = getIntervalsForDate(workIntervals, date);
      if (dayIntervals.length === 0) continue;

      const daySessions = getBreakSessionsForDate(sessions, date);
      const daySchedule = getDayScheduleForDate(date, schedule, dailySchedules);
      const schedStart = daySchedule.startMinute / 60;
      const schedEnd = daySchedule.endMinute / 60;
      const timeline = buildDayTimeline(schedStart, schedEnd, dayIntervals, daySessions);
      dailyAverages.push(computeMovingAverage(timeline, 0.5, 5, dk === nowKey ? nowH : undefined));
    }

    if (dailyAverages.length === 0) return [];

    const hourMap = new Map<number, { total: number; count: number }>();
    for (const dayPoints of dailyAverages) {
      for (const pt of dayPoints) {
        const key = Math.round(pt.hour * 1000) / 1000;
        const existing = hourMap.get(key);
        if (existing) { existing.total += pt.percent; existing.count += 1; }
        else hourMap.set(key, { total: pt.percent, count: 1 });
      }
    }

    return Array.from(hourMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, { total, count }]) => ({
        hour,
        label: formatFractionalHour(hour),
        percent: Math.round((total / count) * 10) / 10,
      }));
  }, [workIntervals, sessions, schedule, dailySchedules]);

  const allTimeXTicks = useMemo(() => {
    if (allTimeLineData.length === 0) return [];
    const minH = allTimeLineData[0].hour;
    const maxH = allTimeLineData[allTimeLineData.length - 1].hour;
    const range = maxH - minH;
    const step = range > 6 ? 2 : 1;
    const start = Math.ceil(minH / step) * step;
    const ticks: number[] = [];
    for (let h = start; h <= maxH; h += step) ticks.push(h);
    return ticks;
  }, [allTimeLineData]);

  const allTimeDomain = useMemo((): [number, number] | undefined => {
    if (allTimeLineData.length === 0) return undefined;
    return [allTimeLineData[0].hour, allTimeLineData[allTimeLineData.length - 1].hour];
  }, [allTimeLineData]);

  if (workIntervals.length === 0) {
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
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4 [&>[data-chart-type=histogram]]:!-mb-2">
        {allTimeLineData.length > 0 && (
          <div>
            <div className="text-[10px] font-medium text-muted-foreground mb-1.5 text-center">
              All-time Activity
            </div>
            <ActivityLineChart
              data={allTimeLineData}
              xTicks={allTimeXTicks}
              domain={allTimeDomain ?? [0, 24]}
              legendLabel="Avg working % (30m avg)"
              gradientId="allTimeWorkGradient"
            />
          </div>
        )}
        {clockTimeData && (
          <ClockTimeChart
            earliestClockInH={clockTimeData.earliestClockInH}
            latestClockOutH={clockTimeData.latestClockOutH}
          />
        )}
        {dayDurationData && <DailyDurationChart {...dayDurationData} />}
        {weekDurationData && <WeeklyDurationChart {...weekDurationData} />}
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
        <AllTimeRecords pastDayStats={pastDayStats} pastWeekMap={pastWeekMap} />
      </div>
    </div>
  );
}
