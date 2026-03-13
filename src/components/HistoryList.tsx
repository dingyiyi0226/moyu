import { useMemo } from "react";
import { useAppStore, type BreakSession } from "@/store/appStore";
import { useSalaryCalc } from "@/hooks/useSalaryCalc";

interface DayGroup {
  date: string;
  sessions: BreakSession[];
  total: number;
}

export function HistoryList() {
  const sessions = useAppStore((s) => s.sessions);
  const { formatCurrency } = useSalaryCalc();

  const groupedByDay = useMemo((): DayGroup[] => {
    const groups: Record<string, BreakSession[]> = {};
    const sorted = [...sessions].sort((a, b) => b.startTime - a.startTime);
    for (const session of sorted) {
      const dateKey = new Date(session.startTime).toLocaleDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(session);
    }
    return Object.entries(groups).map(([date, sessions]) => ({
      date,
      sessions,
      total: sessions.reduce((sum, s) => sum + s.earnings, 0),
    }));
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <p className="text-center text-[11px] text-muted-foreground py-5">
        Lock your screen to start tracking breaks.
      </p>
    );
  }

  return (
    <div className="max-h-[220px] overflow-y-auto">
      {groupedByDay.map((group, groupIdx) => (
        <div key={group.date}>
          {groupIdx > 0 && <div className="h-px bg-border mx-4" />}
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                {group.date}
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-emerald-600">
                {formatCurrency(group.total)}
              </span>
            </div>
            {group.sessions.map((session) => {
              const totalSec = Math.round(
                (session.endTime - session.startTime) / 1000,
              );
              const m = Math.floor(totalSec / 60);
              const s = totalSec % 60;
              const duration = m > 0 ? `${m}m ${s}s` : `${s}s`;
              const time = new Date(session.startTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between py-1 text-[12px]"
                >
                  <span className="text-muted-foreground">
                    {time} &middot; {duration}
                  </span>
                  <span className="tabular-nums text-foreground/80">
                    {formatCurrency(session.earnings)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
