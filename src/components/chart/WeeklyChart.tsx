import { useMemo, useState } from "react";
import { useAppStore, type BreakSession } from "@/store/appStore";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatFractionalHour, getWeekSunday, getIntervalsForDate } from "@/lib/timeUtils";
import { getDayScheduleForDate } from "@/lib/scheduleUtils";
import { navBtnClass } from "@/lib/utils";
import { aggregateWeekStats } from "@/lib/statsUtils";
import { buildDayTimeline, computeMovingAverage, getBreakSessionsForDate } from "./utils";
import { WeeklyBarChart } from "./WeeklyBarChart";
import { ActivityLineChart } from "./ActivityLineChart";

function formatWeekLabel(weekOffset: number): string {
  if (weekOffset === 0) return "This Week";
  const sunday = getWeekSunday(weekOffset);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${fmt(sunday)} – ${fmt(saturday)}`;
}

export function WeeklyChart({
  sessions,
  onBarClick,
  weekOffset,
  onWeekOffsetChange,
}: {
  sessions: BreakSession[];
  onBarClick?: (date: Date) => void;
  weekOffset: number;
  onWeekOffsetChange: (offset: number) => void;
}) {
  const allWorkIntervals = useAppStore((s) => s.workIntervals);
  const pauseIntervals = useAppStore((s) => s.pauseIntervals);
  const schedule = useAppStore((s) => s.schedule);
  const dailySchedules = useAppStore((s) => s.dailySchedules);
  const [showLineChart, setShowLineChart] = useState(false);

  const bars = useMemo(
    () => aggregateWeekStats(sessions, allWorkIntervals, weekOffset, pauseIntervals),
    [sessions, allWorkIntervals, weekOffset, pauseIntervals],
  );

  const weeklyLineData = useMemo(() => {
    if (!showLineChart) return [];

    const sunday = getWeekSunday(weekOffset);
    const dailyAverages: { hour: number; percent: number }[][] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      const dayIntervals = getIntervalsForDate(allWorkIntervals, date);
      if (dayIntervals.length === 0) continue;

      const daySessions = getBreakSessionsForDate(sessions, date);
      const daySchedule = getDayScheduleForDate(date, schedule, dailySchedules);
      const schedStart = daySchedule.startMinute / 60;
      const schedEnd = daySchedule.endMinute / 60;
      const timeline = buildDayTimeline(schedStart, schedEnd, dayIntervals, daySessions);
      dailyAverages.push(computeMovingAverage(timeline, 0.5, 5));
    }

    if (dailyAverages.length === 0) return [];

    const hourMap = new Map<number, { total: number; count: number }>();
    for (const dayPoints of dailyAverages) {
      for (const pt of dayPoints) {
        const key = Math.round(pt.hour * 1000) / 1000;
        const existing = hourMap.get(key);
        if (existing) {
          existing.total += pt.percent;
          existing.count += 1;
        } else {
          hourMap.set(key, { total: pt.percent, count: 1 });
        }
      }
    }

    return Array.from(hourMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, { total, count }]) => ({
        hour,
        label: formatFractionalHour(hour),
        percent: Math.round((total / count) * 10) / 10,
      }));
  }, [showLineChart, weekOffset, allWorkIntervals, sessions, schedule, dailySchedules]);

  const lineXTicks = useMemo(() => {
    if (!showLineChart || weeklyLineData.length === 0) return [];
    const minH = weeklyLineData[0].hour;
    const maxH = weeklyLineData[weeklyLineData.length - 1].hour;
    const range = maxH - minH;
    const step = range > 6 ? 2 : 1;
    const start = Math.ceil(minH / step) * step;
    const ticks: number[] = [];
    for (let h = start; h <= maxH; h += step) ticks.push(h);
    return ticks;
  }, [showLineChart, weeklyLineData]);

  const lineDomain = useMemo((): [number, number] | undefined => {
    if (weeklyLineData.length === 0) return undefined;
    return [weeklyLineData[0].hour, weeklyLineData[weeklyLineData.length - 1].hour];
  }, [weeklyLineData]);

  return (
    <div className="px-4 py-3 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => onWeekOffsetChange(weekOffset - 1)}
          className={navBtnClass}
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-[11px] font-medium text-muted-foreground">
          {formatWeekLabel(weekOffset)}
        </span>
        <button
          onClick={() => onWeekOffsetChange(weekOffset + 1)}
          disabled={weekOffset >= 0}
          className={navBtnClass}
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      {showLineChart ? (
        <ActivityLineChart
          data={weeklyLineData}
          xTicks={lineXTicks}
          domain={lineDomain ?? [0, 24]}
          legendLabel="Avg working % (30m avg)"
          gradientId="weeklyWorkGradient"
          onToggle={() => setShowLineChart(false)}
        />
      ) : (
        <WeeklyBarChart
          bars={bars}
          onBarClick={onBarClick}
          onToggleLineChart={() => setShowLineChart(true)}
        />
      )}
    </div>
  );
}
