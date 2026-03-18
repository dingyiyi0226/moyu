import { useMemo } from "react";
import { useAppStore } from "@/store/appStore";
import { formatDuration, formatWeekLabel } from "@/lib/timeUtils";
import {
  computeAllTimeTotals,
  computeDayStats,
  getAllDateKeys,
  longestSingleBreak,
  longestWorkWithoutBreak,
  maxDayRecord,
  maxWeekRecord,
  timeOfDayRecords,
  type KeyedDayStats,
  type StatRecord,
} from "@/lib/statsUtils";
import { useCurrency } from "@/hooks/useCurrency";

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

  const stats = useMemo(() => {
    const dateKeys = getAllDateKeys(workIntervals, sessions);
    if (dateKeys.length === 0) return [];

    const dayStats: KeyedDayStats[] = dateKeys.map((dk) => {
      const date = new Date(dk + "T00:00:00");
      const s = computeDayStats(sessions, workIntervals, date, pauseIntervals);
      return { key: dk, workSec: s.workSec, breakSec: s.breakSec };
    });

    const weekMap = new Map<string, { workSec: number; breakSec: number }>();
    for (const ds of dayStats) {
      const wk = formatWeekLabel(ds.key);
      const existing = weekMap.get(wk) ?? { workSec: 0, breakSec: 0 };
      existing.workSec += ds.workSec;
      existing.breakSec += ds.breakSec;
      weekMap.set(wk, existing);
    }

    const clockOutTs = workIntervals
      .filter((iv): iv is typeof iv & { end: number } => iv.end != null)
      .map((iv) => iv.end);

    return [
      maxDayRecord(dayStats, "workSec", "Most work in a day"),
      maxWeekRecord(weekMap, "workSec", "Most work in a week"),
      maxDayRecord(dayStats, "breakSec", "Most break in a day"),
      maxWeekRecord(weekMap, "breakSec", "Most break in a week"),
      longestWorkWithoutBreak(workIntervals, sessions),
      ...timeOfDayRecords(workIntervals.map((iv) => iv.start), "Earliest clock in", "Latest clock in"),
      ...timeOfDayRecords(clockOutTs, "Earliest clock out", "Latest clock out"),
      longestSingleBreak(sessions),
    ].filter((r): r is StatRecord => r != null);
  }, [sessions, workIntervals, pauseIntervals]);

  if (stats.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-[11px] text-muted-foreground">
        No data yet. Clock in to start tracking.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto max-h-[calc(100vh-100px)]">
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
    </div>
  );
}
