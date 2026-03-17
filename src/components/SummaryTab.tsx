import { useMemo, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { DailyChart } from "@/components/DailyChart";
import { WeeklyChart } from "@/components/WeeklyChart";
import { computeDayStats, formatDuration } from "@/lib/timeUtils";
import { useCurrency } from "@/hooks/useCurrency";
import { HistoryList } from "@/components/HistoryList";

function WeeklySummary({ weekOffset }: { weekOffset: number }) {
  const sessions = useAppStore((s) => s.sessions);
  const workIntervals = useAppStore((s) => s.workIntervals);
  const { formatCurrency } = useCurrency();

  const stats = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const sunday = new Date(now);
    sunday.setHours(0, 0, 0, 0);
    sunday.setDate(now.getDate() - dayOfWeek + weekOffset * 7);

    let totalWorkSec = 0;
    let totalBreakSec = 0;
    let totalEarnings = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      if (date > now) break;
      const day = computeDayStats(sessions, workIntervals, date);
      totalWorkSec += day.workSec;
      totalBreakSec += day.breakSec;
      totalEarnings += day.earnings;
    }
    return { earnings: totalEarnings, workDuration: totalWorkSec, breakDuration: totalBreakSec };
  }, [sessions, workIntervals, weekOffset]);

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return "This Week";
    const today = new Date();
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setHours(0, 0, 0, 0);
    sunday.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
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

export function SummaryTab() {
  const sessions = useAppStore((s) => s.sessions);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  return (
    <>
      <WeeklySummary weekOffset={weekOffset} />
      <div className="h-px bg-border mx-4" />
      {selectedDay ? (
        <>
          <DailyChart
            sessions={sessions}
            fixedDate={selectedDay}
            onPrev={() => { const d = new Date(selectedDay); d.setDate(d.getDate() - 1); setSelectedDay(d); }}
            onNext={() => { const d = new Date(selectedDay); d.setDate(d.getDate() + 1); setSelectedDay(d); }}
          />
          <div className="h-px bg-border mx-4" />
          <HistoryList filterDate={selectedDay} />
        </>
      ) : (
        <>
          <WeeklyChart sessions={sessions} onBarClick={setSelectedDay} weekOffset={weekOffset} onWeekOffsetChange={setWeekOffset} />
          <div className="h-px bg-border mx-4" />
          <HistoryList filterWeekStart={(() => {
            const now = new Date();
            const sunday = new Date(now);
            sunday.setHours(0, 0, 0, 0);
            sunday.setDate(now.getDate() - now.getDay() + weekOffset * 7);
            return sunday;
          })()} />
        </>
      )}
    </>
  );
}
