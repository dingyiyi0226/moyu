import { useMemo, useState } from "react";
import { useAppStore } from "@/store/appStore";
import { useNow } from "@/hooks/useNow";
import { useCurrency } from "@/hooks/useCurrency";
import { formatDuration } from "@/lib/timeUtils";
import { computeDayStats } from "@/lib/statsUtils";
import { BreakControls } from "@/components/BreakControls";
import { DailyControls } from "@/components/DailyControls";
import { DailyChartSection } from "@/components/chart";
import { HistoryList } from "@/components/HistoryList";

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function DailySummary({ date }: { date: Date }) {
  const sessions = useAppStore((s) => s.sessions);
  const workIntervals = useAppStore((s) => s.workIntervals);
  const pauseIntervals = useAppStore((s) => s.pauseIntervals);
  const { formatCurrency } = useCurrency();
  const now = useNow();
  const isToday = date.toDateString() === now.toDateString();

  const dayStats = useMemo(() => {
    const statsDate = isToday ? now : date;
    const stats = computeDayStats(sessions, workIntervals, statsDate, pauseIntervals);
    return { earnings: stats.earnings, breakDuration: stats.breakSec, workDuration: stats.workSec };
  }, [sessions, workIntervals, pauseIntervals, now, date, isToday]);

  return (
    <div className="px-4 py-3 text-center shrink-0">
      <div className="text-[10px] text-muted-foreground">
        {isToday
          ? "Your earnings today"
          : `Your earnings on ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`}
      </div>
      <div className="text-2xl font-semibold mt-0.5">
        {formatCurrency(dayStats.earnings)}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        Work {formatDuration(dayStats.workDuration)} &middot; Break {formatDuration(dayStats.breakDuration)}
      </div>
    </div>
  );
}

export function DailyTab({
  onOpenSettings,
  initialDate,
}: {
  onOpenSettings: () => void;
  initialDate?: Date | null;
}) {
  const isOnBreak = useAppStore((s) => s.isOnBreak);
  const salary = useAppStore((s) => s.salary);
  const sessions = useAppStore((s) => s.sessions);

  const [selectedDate, setSelectedDate] = useState<Date>(
    () => initialDate ?? today(),
  );

  const now = useNow();
  const isToday = selectedDate.toDateString() === now.toDateString();

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {salary.amount === 0 ? (
        <div className="text-center py-10 px-4 shrink-0">
          <p className="text-sm text-muted-foreground mb-3">
            No salary configured
          </p>
          <button
            onClick={onOpenSettings}
            className="text-sm font-medium text-foreground hover:text-foreground/70 underline underline-offset-4 transition-colors"
          >
            Set up salary
          </button>
        </div>
      ) : (
        <>
          {isToday && (
            <div className="px-4 pt-2 shrink-0">
              {isOnBreak ? <BreakControls /> : <DailyControls date={selectedDate} />}
            </div>
          )}
          <DailySummary date={selectedDate} />
        </>
      )}

      <div className="h-px bg-border shrink-0" />

      <DailyChartSection
        sessions={sessions}
        fixedDate={selectedDate}
        onPrev={() => {
          const d = new Date(selectedDate);
          d.setDate(d.getDate() - 1);
          setSelectedDate(d);
        }}
        onNext={() => {
          if (isToday) return;
          const d = new Date(selectedDate);
          d.setDate(d.getDate() + 1);
          setSelectedDate(d);
        }}
      />
      <div className="h-px bg-border mx-4 shrink-0" />
      <HistoryList filterDate={selectedDate} />
    </div>
  );
}
