import { useMemo, useState } from "react";
import { useAppStore, type BreakSession } from "@/store/appStore";
import { getDayScheduleForDate } from "@/lib/scheduleUtils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getIntervalsForDate } from "@/lib/timeUtils";
import { navBtnClass } from "@/lib/utils";
import { useNow } from "@/hooks/useNow";
import { buildDayTimeline, computeMovingAverage, getBreakSessionsForDate } from "./utils";
import { DailyTimelineChart } from "./DailyTimelineChart";
import { ActivityLineChart } from "./ActivityLineChart";

/** Get a Date offset by `days` from today, at midnight */
function getOffsetDate(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateLabel(dayOffset: number): string {
  if (dayOffset === 0) return "Today";
  if (dayOffset === -1) return "Yesterday";
  const d = getOffsetDate(dayOffset);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function DailyChart({
  sessions,
  todayOnly = false,
  fixedDate,
  onPrev,
  onNext,
}: {
  sessions: BreakSession[];
  todayOnly?: boolean;
  fixedDate?: Date;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const schedule = useAppStore((s) => s.schedule);
  const dailySchedules = useAppStore((s) => s.dailySchedules);
  const allWorkIntervals = useAppStore((s) => s.workIntervals);
  const [dayOffset, setDayOffset] = useState(0);
  const [showLineChart, setShowLineChart] = useState(false);

  const effectiveOffset = todayOnly ? 0 : dayOffset;
  const targetDate = fixedDate ?? getOffsetDate(effectiveOffset);

  const now = useNow();
  const nowH = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const isToday = targetDate.toDateString() === now.toDateString();

  const timeline = useMemo(() => {
    const dayIntervals = getIntervalsForDate(allWorkIntervals, targetDate);
    const daySessions = getBreakSessionsForDate(sessions, targetDate);
    const daySchedule = getDayScheduleForDate(targetDate, schedule, dailySchedules);
    const schedStart = daySchedule.startMinute / 60;
    const schedEnd = daySchedule.endMinute / 60;
    return buildDayTimeline(
      schedStart,
      schedEnd,
      dayIntervals,
      daySessions,
      isToday ? nowH : undefined,
    );
  }, [allWorkIntervals, sessions, targetDate, schedule, dailySchedules, isToday, nowH]);

  const lineChartData = useMemo(() => {
    if (!showLineChart) return [];
    return computeMovingAverage(timeline, 0.5, 5, isToday ? nowH : undefined);
  }, [showLineChart, timeline, isToday, nowH]);

  const xTicks = useMemo(() => {
    if (!showLineChart) return [];
    const ticks: number[] = [];
    const range = timeline.axisEnd - timeline.axisStart;
    const step = range > 6 ? 2 : 1;
    const start = Math.ceil(timeline.axisStart / step) * step;
    for (let h = start; h <= timeline.axisEnd; h += step) {
      ticks.push(h);
    }
    return ticks;
  }, [showLineChart, timeline]);

  return (
    <div className="px-4 py-3 shrink-0">
      {/* Navigation header */}
      {todayOnly ? (
        <div className="flex items-center justify-center mb-3">
          <span className="text-[11px] font-medium text-muted-foreground">Today</span>
        </div>
      ) : fixedDate ? (
        <div className="flex items-center justify-between mb-3">
          <button onClick={onPrev} className={navBtnClass}>
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-[11px] font-medium text-muted-foreground">
            {isToday ? "Today" : fixedDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <button onClick={onNext} disabled={isToday} className={navBtnClass}>
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setDayOffset((o) => o - 1)}
            className={navBtnClass}
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-[11px] font-medium text-muted-foreground">
            {formatDateLabel(dayOffset)}
          </span>
          <button
            onClick={() => setDayOffset((o) => o + 1)}
            disabled={dayOffset >= 0}
            className={navBtnClass}
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}

      {/* Chart view toggle */}
      {showLineChart ? (
        <ActivityLineChart
          data={lineChartData}
          xTicks={xTicks}
          domain={[timeline.axisStart, timeline.axisEnd]}
          legendLabel="Working % (30m avg)"
          gradientId="dailyWorkGradient"
          onToggle={() => setShowLineChart(false)}
        />
      ) : (
        <DailyTimelineChart
          timeline={timeline}
          isToday={isToday}
          nowH={nowH}
          onToggleLineChart={() => setShowLineChart(true)}
        />
      )}
    </div>
  );
}
