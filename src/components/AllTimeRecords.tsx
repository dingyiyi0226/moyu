import { useMemo } from "react";
import { useAppStore } from "@/store/appStore";
import {
  longestSingleBreak,
  longestWorkSession,
  extremeDayRecord,
  extremeWeekRecord,
  type KeyedDayStats,
  type StatRecord,
} from "@/lib/statsUtils";

interface AllTimeRecordsProps {
  pastDayStats: KeyedDayStats[];
  pastWeekMap: Map<string, { workSec: number; breakSec: number }>;
}

export function AllTimeRecords({ pastDayStats, pastWeekMap }: AllTimeRecordsProps) {
  const sessions = useAppStore((s) => s.sessions);
  const workIntervals = useAppStore((s) => s.workIntervals);

  const stats = useMemo(() => {
    if (pastDayStats.length === 0) return [];

    return [
      extremeDayRecord(pastDayStats, "workSec", "max", "Most work in a day"),
      extremeDayRecord(pastDayStats, "workSec", "min", "Least work in a day"),
      extremeWeekRecord(pastWeekMap, "workSec", "max", "Most work in a week"),
      extremeWeekRecord(pastWeekMap, "workSec", "min", "Least work in a week"),
      extremeDayRecord(pastDayStats, "breakSec", "max", "Most break in a day"),
      extremeDayRecord(pastDayStats, "breakSec", "min", "Least break in a day"),
      extremeWeekRecord(pastWeekMap, "breakSec", "max", "Most break in a week"),
      extremeWeekRecord(pastWeekMap, "breakSec", "min", "Least break in a week"),
      longestWorkSession(workIntervals, sessions),
      longestSingleBreak(sessions),
    ].filter((r): r is StatRecord => r != null);
  }, [pastDayStats, pastWeekMap, workIntervals, sessions]);

  if (stats.length === 0) return null;

  return (
    <div className="px-2">
      <div className="text-[10px] text-muted-foreground text-center mb-2">
        All-time Records
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col">
            <span className="text-[9px] text-muted-foreground mb-1 text-center">
              {s.label}
            </span>
            <div className="flex flex-col items-center justify-center rounded-xl bg-muted/50 p-3 aspect-[2/1]">
              <span className="text-lg font-bold leading-tight">{s.value}</span>
              {s.detail && (
                <span className="text-[9px] text-muted-foreground mt-0.5">
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
