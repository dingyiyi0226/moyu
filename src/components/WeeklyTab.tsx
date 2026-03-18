import { useMemo, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { WeeklyChart } from "@/components/WeeklyChart";
import { formatDuration, getWeekSunday } from "@/lib/timeUtils";
import { aggregateWeekStats } from "@/lib/statsUtils";
import { useCurrency } from "@/hooks/useCurrency";
import { HistoryList } from "@/components/HistoryList";

function WeeklySummary({ weekOffset }: { weekOffset: number }) {
  const sessions = useAppStore((s) => s.sessions);
  const workIntervals = useAppStore((s) => s.workIntervals);
  const pauseIntervals = useAppStore((s) => s.pauseIntervals);
  const { formatCurrency } = useCurrency();

  const stats = useMemo(() => {
    const days = aggregateWeekStats(sessions, workIntervals, weekOffset, pauseIntervals);
    let totalWorkSec = 0;
    let totalBreakSec = 0;
    let totalEarnings = 0;
    for (const day of days) {
      totalWorkSec += day.workSec;
      totalBreakSec += day.breakSec;
      totalEarnings += day.earnings;
    }
    return { earnings: totalEarnings, workDuration: totalWorkSec, breakDuration: totalBreakSec };
  }, [sessions, workIntervals, pauseIntervals, weekOffset]);

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return "This Week";
    const sunday = getWeekSunday(weekOffset);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${fmt(sunday)} – ${fmt(saturday)}`;
  }, [weekOffset]);

  return (
    <div className="px-4 py-3 text-center">
      <div className="text-[10px] text-muted-foreground">
        Your earnings {weekOffset === 0 ? "this week" : `in ${weekLabel}`}
      </div>
      <div className="text-2xl font-semibold mt-0.5">
        {formatCurrency(stats.earnings)}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        Work {formatDuration(stats.workDuration)} &middot; Break {formatDuration(stats.breakDuration)}
      </div>
    </div>
  );
}

export function WeeklyTab({ onBarClick }: { onBarClick?: (date: Date) => void }) {
  const sessions = useAppStore((s) => s.sessions);
  const [weekOffset, setWeekOffset] = useState(0);

  return (
    <>
      <WeeklySummary weekOffset={weekOffset} />
      <div className="h-px bg-border mx-4" />
      <WeeklyChart sessions={sessions} onBarClick={onBarClick} weekOffset={weekOffset} onWeekOffsetChange={setWeekOffset} />
      <div className="h-px bg-border mx-4" />
      <HistoryList filterWeekStart={getWeekSunday(weekOffset)} />
    </>
  );
}
